const store = require('../../utils/store')
const util = require('../../utils/util')
const scoring = require('../../utils/scoring')
const recorder = require('../../utils/recorder')
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
    analyzingProgress: 6,
    analyzingStages: ['提取声音特征', '核对表达节奏', '生成具体的教练反馈'],
    waveBars: []
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
      setTimeout(() => wx.navigateBack(), 600)
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
        success: () => wx.navigateBack()
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

    const waveBars = []
    for (let i = 0; i < 24; i++) {
      waveBars.push({
        id: i,
        h: 16 + Math.round(60 * (0.5 + 0.5 * Math.sin(i * 0.9)) * (0.6 + 0.4 * Math.cos(i * 0.37))),
        delay: util.round((i % 8) * 0.07, 2),
        dur: util.round(0.55 + (i % 5) * 0.09, 2)
      })
    }

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
      materialLong: !!(question.material && question.material.length > 120)
    })

    wx.setNavigationBarTitle({ title: question.categoryName || '练习' })
    this.setupDemoAudio(question)
    recorder.setHandlers({
      onStart: () => this.handleRecordStart(),
      onStop: res => this.handleStop(res),
      onError: err => this.handleRecordError(err),
      onInterruption: type => this.handleInterruption(type)
    })
  },

  onUnload() {
    this.clearTimers()
    wx.setKeepScreenOn({ keepScreenOn: false })
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
      if (this.data.isToday && !this.consumeTodayChance()) return

      this.stopHandled = false
      this.recordStartedAt = 0
      this.setData({
        phase: 'recording',
        recordSeconds: 0,
        recordActive: false,
        progressPercent: 0,
        recordTip: (this.data.tips && this.data.tips[0]) || ''
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

  consumeTodayChance() {
    const state = store.getTodayState()
    if (state.done) return true
    const attempt = store.useTodayAttempt()
    if (!attempt.ok) {
      wx.showModal({
        title: '今日机会已用完',
        content: '这道题今天不能再录了。去练习区选一道别的题继续，或者明天再来。',
        confirmText: '去练习',
        showCancel: false,
        success: () => {
          this.leaving = true
          wx.switchTab({ url: '/pages/practice/practice' })
        }
      })
      return false
    }
    this.setData({ chancesLeft: attempt.left })
    return true
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
      fail: () => callback()
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
    if (this.startTimeout) {
      clearTimeout(this.startTimeout)
      this.startTimeout = null
    }
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
    this.setData({
      phase: 'analyzing',
      recordActive: false,
      analyzingStage: 0,
      analyzingProgress: 8
    })
    this.startAnalysisAnimation()
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

  startAnalysisAnimation() {
    if (this.analysisTimer) clearInterval(this.analysisTimer)
    this.analysisTimer = setInterval(() => {
      const stage = Math.min(2, this.data.analyzingStage + 1)
      const progress = Math.min(92, this.data.analyzingProgress + 18)
      this.setData({ analyzingStage: stage, analyzingProgress: progress })
      if (progress >= 92) clearInterval(this.analysisTimer)
    }, 480)
  },

  handleStop(res) {
    if (this.stopHandled) return
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
    fs.readFile({
      filePath,
      success: res => {
        let audio = null
        try {
          audio = scoring.analyzePcm(res.data, 16000)
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

    const quota = this.isDeliveryQuestion(question)
      ? { ok: true, source: 'delivery' }
      : store.consumeReview()
    const report = scoring.buildReport({
      id,
      question,
      audio,
      transcript: '',
      source: this.data.source,
      date: util.dateKey(),
      locked: !quota.ok
    })
    report.quotaSource = quota.source
    report.audioPath = wavPath || tempFilePath
    report.hasAudioFile = !!wavPath
    store.saveReport(report)

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

    this.clearTimers()
    this.leaving = true
    const elapsed = Date.now() - (this.analysisStart || Date.now())
    const wait = Math.max(0, 1600 - elapsed)
    this.setData({ analyzingStage: 2, analyzingProgress: 100 })
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
    if (this.data.phase === 'recording' || this.data.phase === 'analyzing') {
      wx.showModal({
        title: '正在录音',
        content: '现在离开会放弃这次录音。确定要退出吗？',
        confirmText: '退出',
        cancelText: '继续练',
        success: res => {
          if (res.confirm) {
            this.leaving = true
            this.stopHandled = true
            this.clearTimers()
            try { recorder.stop() } catch (e) { /* ignore */ }
            wx.navigateBack()
          }
        }
      })
      return
    }
    if (this.data.phase === 'prepare') {
      this.cancelPrepare()
      return
    }
    wx.navigateBack()
  }
})
