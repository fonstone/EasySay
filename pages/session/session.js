const store = require('../../utils/store')
const util = require('../../utils/util')
const scoring = require('../../utils/scoring')
const recorder = require('../../utils/recorder')
const waveform = require('../../utils/live-waveform')
const analysis = require('../../utils/analysis')
const asr = require('../../utils/asr')
const questionData = require('../../data/questions')
const pronounceData = require('../../data/pronounce')

const SOURCE_LABEL = {
  today: '今日挑战',
  practice: '自由练习',
  coach: '私教计划',
  course: '课程练习',
  pronounce: '普通话纠音'
}

Page({
  data: {
    ready: false,
    statusBarHeight: 20,
    phase: 'intro',
    question: null,
    source: 'practice',
    sourceLabel: '自由练习',
    levelName: '',
    isToday: false,
    chancesLeft: 0,
    lessonId: '',
    prepTotal: 30,
    prepLeft: 30,
    recordSeconds: 0,
    recordClock: '00:00',
    recordPercent: 0,
    recordActive: false,
    demoPlaying: false,
    demoError: false,
    maxSeconds: 90,
    minSeconds: 45,
    progressPercent: 0,
    materialExpanded: false,
    materialLong: false,
    tips: [],
    recordTip: '',
    recordTipIndex: 0,
    analyzingStage: 0,
    analyzingProgress: 0,
    // 阶段来自 analysis.createRun()，每个步骤带真实耗时，不再用定时器伪装
    analyzingStages: [],
    analyzingNote: '每一步都对应真实的计算，右侧是本机实测耗时',
    // 波形只由 onFrameRecorded 的真实 PCM 帧驱动
    waveBars: [],
    waveLive: false,
    waveNote: '等待音频帧',
    preparedPoints: []
  },

  onLoad(options) {
    const source = (options && options.source) || 'practice'
    let question = null
    let lessonId = (options && options.lesson) || ''

    if (options && options.drill) {
      const drill = pronounceData.getDrill(options.drill)
      question = pronounceData.toQuestion(drill)
    } else {
      let qid = (options && options.qid) || ''
      if (source === 'today') {
        const state = store.getTodayState()
        qid = state.questionId || qid
      }
      question = questionData.getQuestion(qid)
      if (!question && source === 'today') {
        question = questionData.getDailyQuestion(util.dateKey())
      }
    }

    if (!question) {
      wx.showToast({ title: '题目不存在', icon: 'none' })
      setTimeout(() => util.goBack(), 600)
      return
    }

    const settings = store.getSettings()
    const state = store.getTodayState()
    const isToday = source === 'today'
    const chancesLeft = isToday
      ? (state.done ? -1 : Math.max(0, settings.chances - (state.attempts || 0)))
      : 0

    if (isToday && !state.done && chancesLeft <= 0) {
      wx.showModal({
        title: '今日机会已用完',
        content: '今天这道题的机会用完了。去练习区选一道别的题继续，或者明天再来。',
        showCancel: false,
        success: () => util.goBack()
      })
      return
    }

    const prepTotal = question.mode === 'read'
      ? Math.min(settings.prepSeconds || 15, question.prepSeconds || 15)
      : (settings.prepSeconds || 30)

    let statusBarHeight = 20
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      statusBarHeight = info.statusBarHeight || 20
    } catch (e) {
      // ignore
    }

    // 真实波形容器：初始全部为静音柱，只有拿到音频帧才会长高
    this.wave = waveform.createLiveWaveform(24)
    const waveBars = this.wave.getBars()
    const preparedPoints = (question.keyPoints || []).map((p, i) => ({
      id: i,
      label: p.label,
      checked: false
    }))

    this.setData({
      ready: true,
      statusBarHeight,
      question,
      source,
      sourceLabel: SOURCE_LABEL[source] || '练习',
      levelName: question.levelName || '',
      isToday,
      chancesLeft,
      lessonId,
      prepTotal,
      prepLeft: prepTotal,
      maxSeconds: question.maxSeconds || 90,
      minSeconds: question.minSeconds || 45,
      tips: question.tips || [],
      recordTip: (question.tips && question.tips[0]) || '',
      waveBars,
      waveLive: false,
      waveNote: recorder.supportsFrames()
        ? '等待录音帧 · 波形来自真实音量'
        : '本机未回吐音频帧 · 波形保持静音',
      preparedPoints,
      materialLong: !!(question.material && question.material.length > 120)
    })

    wx.setNavigationBarTitle({ title: question.categoryName || '练习' })
    this.setupDemoAudio(question)
    recorder.setHandlers({
      onStart: () => this.handleRecordStart(),
      onStop: res => this.handleStop(res),
      onError: err => this.handleRecordError(err),
      onInterruption: type => this.handleInterruption(type),
      onFrame: res => this.handleFrame(res)
    })
  },

  onUnload() {
    this.clearTimers()
    wx.setKeepScreenOn({ keepScreenOn: false })
    // 页面被销毁但没有生成点评时，归还今日机会（故障 / 切后台 / 系统回收）
    if (!this.reportSaved) this.refundAttemptIfUnused()
    if (this.demoCtx) {
      try { this.demoCtx.destroy() } catch (e) { /* ignore */ }
      this.demoCtx = null
    }
    if (this.data.recordActive && !this.leaving) {
      this.leaving = true
      this.stopHandled = true
      try { recorder.stop() } catch (e) { /* ignore */ }
    }
  },

  onHide() {
    this.pauseDemo()
    if (this.data.recordActive && !this.leaving) {
      this.clearTimers()
      try { recorder.stop() } catch (e) { /* ignore */ }
      return
    }
    if (this.data.phase === 'prepare' && !this.leaving) {
      this.cancelPrepare()
    }
  },

  clearTimers() {
    if (this.prepTimer) clearInterval(this.prepTimer)
    if (this.recordTimer) clearInterval(this.recordTimer)
    if (this.tipTimer) clearInterval(this.tipTimer)
    if (this.analysisTimer) clearInterval(this.analysisTimer)
    if (this.navigateTimer) clearTimeout(this.navigateTimer)
    if (this.startTimeout) clearTimeout(this.startTimeout)
    if (this.stopTimeout) clearTimeout(this.stopTimeout)
    this.prepTimer = null
    this.recordTimer = null
    this.tipTimer = null
    this.analysisTimer = null
    this.navigateTimer = null
    this.startTimeout = null
    this.stopTimeout = null
  },

  toggleMaterial() {
    this.setData({ materialExpanded: !this.data.materialExpanded })
  },

  /** 开口前标记要点：这是自评清单，不参与打分，只随报告留档 */
  togglePreparedPoint(e) {
    const index = Number(e.currentTarget.dataset.index)
    const list = (this.data.preparedPoints || []).slice()
    if (!list[index]) return
    list[index] = Object.assign({}, list[index], { checked: !list[index].checked })
    this.setData({ preparedPoints: list })
  },

  /** 真实音频帧 → RMS → 波形。没有帧时一根柱子都不会凭空长出来 */
  handleFrame(res) {
    if (this.cancelled || this.data.phase !== 'recording' || !this.wave) return
    const buffer = res.frameBuffer || res.data
    if (!buffer || !buffer.byteLength) return
    this.wave.pushFrame(buffer)
    const now = Date.now()
    if (now - (this.lastWavePaint || 0) < 100) return
    this.lastWavePaint = now
    this.setData({
      waveBars: this.wave.getBars(),
      waveLive: true,
      waveNote: '真实音频帧 · ' + this.wave.getStats().frames + ' 帧 RMS 振幅'
    })
  },

  /** 把真实阶段（含本机耗时）推到 analyzing 视图 */
  renderAnalysis(snapshot) {
    if (this.cancelled || !snapshot) return
    this.setData({
      analyzingStages: snapshot.steps,
      analyzingProgress: snapshot.percent,
      analyzingStage: snapshot.currentIndex < 0 ? snapshot.steps.length : snapshot.currentIndex
    })
  },

  setupDemoAudio(question) {
    if (!question || !question.audio) return
    try {
      const ctx = wx.createInnerAudioContext()
      ctx.src = question.audio
      ctx.onPlay(() => this.setData({ demoPlaying: true }))
      ctx.onPause(() => this.setData({ demoPlaying: false }))
      ctx.onStop(() => this.setData({ demoPlaying: false }))
      ctx.onEnded(() => this.setData({ demoPlaying: false }))
      ctx.onError(() => this.setData({ demoPlaying: false, demoError: true }))
      this.demoCtx = ctx
    } catch (e) {
      this.setData({ demoError: true })
    }
  },

  toggleDemo() {
    if (!this.demoCtx) {
      wx.showToast({ title: '示范音频不可用', icon: 'none' })
      return
    }
    if (this.data.demoPlaying) {
      this.demoCtx.pause()
    } else {
      this.demoCtx.play()
    }
  },

  pauseDemo() {
    if (this.demoCtx && this.data.demoPlaying) {
      try { this.demoCtx.pause() } catch (e) { /* ignore */ }
    }
  },

  /* ========================================================
     准备阶段
     ======================================================== */

  startPrepare() {
    this.pauseDemo()
    if (this.data.prepTotal <= 0) {
      this.beginRecording()
      return
    }
    this.setData({ phase: 'prepare', prepLeft: this.data.prepTotal })
    this.prepStartedAt = Date.now()
    let lastLeft = this.data.prepTotal
    this.prepTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.prepStartedAt) / 1000)
      const left = Math.max(0, this.data.prepTotal - elapsed)
      if (left !== lastLeft) {
        lastLeft = left
        this.setData({ prepLeft: left })
        if (left <= 3 && left > 0) this.vibrate()
      }
      if (left <= 0) {
        clearInterval(this.prepTimer)
        this.prepTimer = null
        this.beginRecording()
      }
    }, 200)
  },

  skipPrepare() {
    if (this.prepTimer) clearInterval(this.prepTimer)
    this.prepTimer = null
    this.beginRecording()
  },

  cancelPrepare() {
    if (this.prepTimer) clearInterval(this.prepTimer)
    this.prepTimer = null
    this.setData({ phase: 'intro', prepLeft: this.data.prepTotal })
  },

  /* ========================================================
     录音阶段
     ======================================================== */

  beginRecording() {
    if (this.data.phase === 'recording' || this.data.phase === 'analyzing') return
    this.pauseDemo()

    this.ensurePermission(() => {
      // 只读预检：麦克风尚未启动，绝不在这里扣次数
      if (this.data.isToday) {
        const check = store.canUseTodayAttempt()
        if (!check.ok) {
          this.showNoChance()
          return
        }
        this.setData({ chancesLeft: check.left < 0 ? 0 : check.left })
      }

      this.cancelled = false
      this.stopHandled = false
      this.recordStartedAt = 0
      this.lastWavePaint = 0
      if (this.wave) this.wave.reset()
      this.setData({
        phase: 'recording',
        recordSeconds: 0,
        recordActive: false,
        progressPercent: 0,
        recordTip: (this.data.tips && this.data.tips[0]) || '',
        waveBars: this.wave ? this.wave.getBars() : [],
        waveLive: false,
        waveNote: recorder.supportsFrames()
          ? '等待音频帧'
          : '本机未回吐音频帧 · 波形保持静音'
      })
      wx.setKeepScreenOn({ keepScreenOn: true })
      this.vibrate()

      try {
        recorder.start({
          duration: this.data.maxSeconds * 1000,
          sampleRate: 16000,
          numberOfChannels: 1,
          format: 'PCM'
        })
        this.startTimeout = setTimeout(() => {
          if (!this.data.recordActive && this.data.phase === 'recording') {
            this.failAnalysis('麦克风没有启动成功，请检查权限后重试。')
          }
        }, 5000)
      } catch (e) {
        this.handleRecordError(e)
      }
    })
  },

  /** 麦克风 onStart 之后才真正扣次数：启动失败、权限异常都不会白扣 */
  consumeTodayChance() {
    if (this.chanceConsumed || store.getTodayState().done) return true
    const attempt = store.useTodayAttempt()
    if (!attempt.ok) {
      this.showNoChance()
      return false
    }
    this.chanceConsumed = true
    this.setData({ chancesLeft: attempt.left })
    return true
  },

  /** 没有生成点评就离开时归还次数，并同步刷新页面上的剩余次数 */
  refundAttemptIfUnused() {
    if (!this.chanceConsumed || this.reportSaved) return
    this.chanceConsumed = false
    store.refundTodayAttempt()
    const left = store.canUseTodayAttempt().left
    this.setData({ chancesLeft: left < 0 ? 0 : left })
  },

  showNoChance() {
    wx.showModal({
      title: '今日机会已用完',
      content: '这道题今天不能再录了。去练习区选一道别的题继续，或者明天再来。',
      confirmText: '去练习',
      showCancel: false,
      success: () => {
        this.leaving = true
        util.switchTabSafe('/pages/practice/practice')
      }
    })
  },

  ensurePermission(callback) {
    const deny = () => {
      this.resetToIntro()
    }
    wx.getSetting({
      success: res => {
        if (res.authSetting && res.authSetting['scope.record'] === false) {
          wx.showModal({
            title: '需要麦克风权限',
            content: '练习需要录下你的声音。录音只保存在本机，不会上传。',
            confirmText: '去开启',
            success: r => {
              if (r.confirm) {
                wx.openSetting({
                  success: s => {
                    if (s.authSetting && s.authSetting['scope.record']) callback()
                    else {
                      wx.showToast({ title: '没有麦克风权限', icon: 'none' })
                      deny()
                    }
                  },
                  fail: deny
                })
              } else {
                deny()
              }
            },
            fail: deny
          })
          return
        }
        wx.authorize({
          scope: 'scope.record',
          success: () => callback(),
          fail: () => {
            wx.showModal({
              title: '需要麦克风权限',
              content: '你可以在右上角「···」-「设置」里打开麦克风权限，再回来练习。',
              showCancel: false,
              success: deny,
              fail: deny
            })
          }
        })
      },
      // 探测失败不能当作「已授权」直接放行，否则 recorder.start 必然失败
      fail: () => {
        wx.authorize({
          scope: 'scope.record',
          success: () => callback(),
          fail: () => {
            wx.showToast({ title: '暂时无法确认麦克风权限，请稍后重试', icon: 'none' })
            deny()
          }
        })
      }
    })
  },

  resetToIntro() {
    this.clearTimers()
    this.recordStartedAt = 0
    this.stopHandled = true
    this.stopping = false
    wx.setKeepScreenOn({ keepScreenOn: false })
    this.setData({
      phase: 'intro',
      recordActive: false,
      recordSeconds: 0,
      recordClock: '00:00',
      recordPercent: 0
    })
  },

  handleRecordStart() {
    if (this.cancelled) return
    if (this.startTimeout) {
      clearTimeout(this.startTimeout)
      this.startTimeout = null
    }
    // 到这里麦克风才真的启动成功，此刻扣次数才有意义
    if (this.data.isToday && !this.consumeTodayChance()) {
      this.stopHandled = true
      try { recorder.stop() } catch (e) { /* ignore */ }
      this.resetToIntro()
      return
    }
    // 只有麦克风真正启动，才算「练过这道题」，最近练习据此更新
    const recentId = this.data.question && this.data.question.id
    if (recentId) store.pushRecentQuestion(recentId)
    this.recordStartedAt = Date.now()
    this.setData({ recordActive: true, phase: 'recording' })
    this.startRecordTimer()
    this.startTipRotation()
  },

  startRecordTimer() {
    if (this.recordTimer) clearInterval(this.recordTimer)
    this.recordTimer = setInterval(() => {
      if (!this.recordStartedAt) return
      const elapsed = Math.min(
        this.data.maxSeconds,
        Math.max(0, (Date.now() - this.recordStartedAt) / 1000)
      )
      const seconds = Math.floor(elapsed)
      if (seconds !== this.data.recordSeconds) {
        this.setData({
          recordSeconds: seconds,
          recordClock: util.clock(seconds),
          recordPercent: Math.min(100, elapsed / this.data.maxSeconds * 100)
        })
      }
      if (elapsed >= this.data.maxSeconds) {
        this.stopRecording(true)
      }
    }, 200)
  },

  startTipRotation() {
    if (!this.data.tips || this.data.tips.length < 2) return
    this.tipTimer = setInterval(() => {
      const index = (this.data.recordTipIndex + 1) % this.data.tips.length
      this.setData({ recordTipIndex: index, recordTip: this.data.tips[index] })
    }, 7000)
  },

  stopRecording(auto) {
    if (this.data.phase !== 'recording') return
    const elapsed = this.recordStartedAt ? (Date.now() - this.recordStartedAt) / 1000 : 0

    if (!auto && elapsed < 5) {
      wx.showModal({
        title: '才说了几秒',
        content: '录音太短，分析会不准。确定要现在结束吗？',
        confirmText: '结束',
        cancelText: '继续说',
        success: res => {
          if (res.confirm) this.doStop()
        }
      })
      return
    }
    if (!auto && elapsed < this.data.minSeconds) {
      wx.showModal({
        title: '还没到目标时长',
        content: '目标是至少 ' + this.data.minSeconds + ' 秒。现在结束也可以，但完成度会低一些。',
        confirmText: '结束',
        cancelText: '继续说',
        success: res => {
          if (res.confirm) this.doStop()
        }
      })
      return
    }
    this.doStop()
  },

  doStop() {
    if (this.stopping) return
    this.stopping = true
    this.analysisStart = Date.now()
    this.clearTimers()
    wx.setKeepScreenOn({ keepScreenOn: false })
    this.vibrate()
    // 进度绑定真实计算阶段：读取文件 / 分帧 / VAD / 停顿 / 组装 / 落库
    this.run = analysis.createRun(snapshot => this.renderAnalysis(snapshot))
    this.setData({
      phase: 'analyzing',
      recordActive: false,
      analyzingStage: 0,
      analyzingProgress: 0,
      analyzingStages: this.run.snapshot().steps
    })
    this.run.begin('read')
    try {
      recorder.stop()
      this.stopTimeout = setTimeout(() => {
        if (!this.stopHandled) {
          this.failAnalysis('录音没有正常结束，请再试一次。')
        }
      }, 5000)
    } catch (e) {
      this.failAnalysis('录音结束失败，请再试一次。')
    }
  },

  handleStop(res) {
    if (this.stopHandled || this.cancelled) return
    this.stopHandled = true
    this.stopping = false
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout)
      this.stopTimeout = null
    }

    if (!this.analysisStart) this.analysisStart = Date.now()
    if (!res || !res.tempFilePath) {
      this.failAnalysis('没有拿到录音文件，请再试一次。')
      return
    }

    const duration = (res.duration || 0) / 1000 || (this.recordStartedAt ? (Date.now() - this.recordStartedAt) / 1000 : 0)
    if (duration < 1.2) {
      this.failAnalysis('这段录音太短，至少要说 2 秒才能分析。')
      return
    }

    this.analyzeFile(res.tempFilePath, duration, res.fileSize || 0)
  },

  handleRecordError(err) {
    console.warn('[session] record error', err)
    this.failAnalysis('录音启动失败，请检查麦克风权限后重试。')
  },

  handleInterruption(type) {
    if (type === 'begin' && this.data.recordActive) {
      this.failAnalysis('录音被系统中断了，请重新开始。')
    }
  },

  failAnalysis(message) {
    this.refundAttemptIfUnused()
    this.clearTimers()
    wx.setKeepScreenOn({ keepScreenOn: false })
    this.stopHandled = true
    this.stopping = false
    this.recordStartedAt = 0
    this.setData({
      phase: 'intro',
      recordActive: false,
      recordSeconds: 0,
      recordClock: '00:00',
      recordPercent: 0,
      analyzingProgress: 0,
      analyzingStage: 0
    })
    wx.showModal({
      title: '录音没有完成',
      content: message,
      showCancel: false,
      confirmText: '再试一次'
    })
  },

  analyzeFile(filePath, duration, fileSize) {
    const fs = wx.getFileSystemManager()
    const run = this.run
    fs.readFile({
      filePath,
      success: res => {
        if (this.cancelled) return
        if (run && run.end) run.end('read')
        let audio = null
        try {
          audio = scoring.analyzePcm(res.data, 16000, run)
        } catch (e) {
          console.warn('[session] analyze pcm failed', e)
        }
        if (!audio || !audio.duration) {
          this.failAnalysis('这台设备暂时无法读取录音数据，请再试一次。')
          return
        }
        this.saveReportAndGo(res.data, audio, filePath, duration, fileSize)
      },
      fail: err => {
        console.warn('[session] readFile failed', err)
        if (run && run.skip) run.skip('read')
        this.failAnalysis('读取录音文件失败，请再试一次。')
      }
    })
  },

  async saveReportAndGo(buffer, audio, tempFilePath, duration, fileSize) {
    const id = util.uid('rep')
    const question = this.data.question
    let wavPath = ''

    try {
      const wav = scoring.pcmToWav(buffer, 16000)
      const path = wx.env.USER_DATA_PATH + '/cs_' + id + '.wav'
      await this.writeFile(path, wav)
      wavPath = path
    } catch (e) {
      console.warn('[session] save wav failed', e)
    }

    // await 写文件期间用户可能已取消，这里再确认一次
    if (this.cancelled) return

    // 只有配置了「文件转写」提供者时才会自动得到文字稿；
    // 未配置时保持空稿，由报告页明确告诉用户去补写自述稿，绝不假装识别过。
    const asrCapability = asr.getCapability()
    let transcript = ''
    let transcriptSource = 'none'
    if (asrCapability.available && asrCapability.mode === 'file' && wavPath) {
      try {
        const recognized = await asr.recognizeAudio({
          filePath: wavPath,
          duration: audio.duration,
          sampleRate: 16000
        })
        transcript = recognized.text
        transcriptSource = recognized.source
      } catch (e) {
        console.warn('[session] asr unavailable, fallback to manual transcript', e && e.code)
      }
    }
    if (this.cancelled) return

    const preparedPoints = (this.data.preparedPoints || [])
      .filter(p => p.checked)
      .map(p => p.label)

    const quota = this.isDeliveryQuestion(question)
      ? { ok: true, source: 'delivery' }
      : store.consumeReview()
    const report = scoring.buildReport({
      id,
      question,
      audio,
      transcript,
      transcriptSource,
      asrCapability,
      preparedPoints,
      run: this.run,
      source: this.data.source,
      date: util.dateKey(),
      locked: !quota.ok
    })
    report.quotaSource = quota.source
    report.audioPath = wavPath || tempFilePath
    report.hasAudioFile = !!wavPath
    if (this.run) this.run.begin('save')
    store.saveReport(report)
    // 报告已落库，这次机会才算真正用掉
    this.reportSaved = true

    store.recordSession(report, this.data.source)
    store.markQuestionDone(question.id, report.overall)

    if (this.data.source === 'today') {
      store.markTodayDone(report.id)
    }

    if (this.data.lessonId) {
      store.markLessonDone(this.data.lessonId)
    }

    if (question.isDrill && question.id.indexOf('pr_') === 0) {
      store.markPronounceDone(question.id.slice(3))
    }

    if (this.data.source === 'coach') {
      const plan = store.getCoachPlan()
      if (plan) {
        const completed = plan.completed || []
        if (completed.indexOf(question.id) === -1) completed.push(question.id)
        store.saveCoachPlan(Object.assign({}, plan, { completed: completed.slice(0, 7) }))
      }
    }

    if (wavPath) {
      store.addArchive({
        id: util.uid('audio'),
        reportId: report.id,
        questionId: question.id,
        title: question.title,
        categoryName: question.categoryName || '',
        date: report.date,
        createdAt: report.createdAt,
        path: wavPath,
        duration: audio.duration,
        size: fileSize || 0,
        score: report.overall
      })
    }

    if (report.overall >= 86 && report.quote) {
      store.addQuote({
        text: report.quote,
        source: question.title,
        questionId: question.id,
        date: report.date,
        score: report.overall
      })
      report.quoteAdded = true
      store.saveReport(report)
    }

    if (this.run) {
      this.run.end('save')
      this.run.finish()
    }
    this.clearTimers()
    this.leaving = true
    // 只保留极短的视觉过渡，不再是「至少 1.6 秒假装在算」
    const elapsed = Date.now() - (this.analysisStart || Date.now())
    const wait = Math.max(0, 420 - elapsed)
    this.setData({ analyzingProgress: 100 })
    this.navigateTimer = setTimeout(() => {
      wx.redirectTo({ url: '/pages/report/report?id=' + report.id })
    }, wait)
  },

  isDeliveryQuestion(question) {
    return !!question && (
      question.mode === 'read' ||
      question.scoreProfile === 'delivery' ||
      question.categoryId === 'read' ||
      question.categoryId === 'pronounce'
    )
  },

  writeFile(filePath, data) {    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().writeFile({
        filePath,
        data,
        success: resolve,
        fail: reject
      })
    })
  },

  vibrate() {
    const settings = store.getSettings()
    if (!settings.haptic) return
    try {
      wx.vibrateShort({ type: 'light' })
    } catch (e) {
      // ignore
    }
  },

  backHome() {
    wx.switchTab({ url: '/pages/practice/practice' })
  },

  goBack() {
    if (this.data.phase === 'analyzing') {
      wx.showModal({
        title: '正在生成点评',
        content: '现在离开会放弃这一次练习，今日机会不会消耗。确定退出吗？',
        confirmText: '退出',
        cancelText: '再等等',
        success: res => {
          if (!res.confirm) return
          this.cancelled = true
          this.stopHandled = true
          this.clearTimers()
          this.refundAttemptIfUnused()
          this.resetToIntro()
          wx.showToast({ title: '已取消，可以重新开始', icon: 'none' })
        }
      })
      return
    }
    if (this.data.phase === 'recording') {
      wx.showModal({
        title: '正在录音',
        content: '现在离开会放弃这次录音，今日机会不会消耗。确定要退出吗？',
        confirmText: '退出',
        cancelText: '继续练',
        success: res => {
          if (res.confirm) {
            this.leaving = true
            this.stopHandled = true
            this.clearTimers()
            this.refundAttemptIfUnused()
            try { recorder.stop() } catch (e) { /* ignore */ }
            util.goBack()
          }
        }
      })
      return
    }
    if (this.data.phase === 'prepare') {
      this.cancelPrepare()
      return
    }
    util.goBack()
  }
})
