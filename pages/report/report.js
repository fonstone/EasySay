const store = require('../../utils/store')
const util = require('../../utils/util')
const scoring = require('../../utils/scoring')
const guide = require('../../data/dimension-guide')

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
    report: null,
    dims: [],
    facts: [],
    dateText: '',
    sourceLabel: '',
    durationClock: '00:00',
    currentClock: '00:00',
    playing: false,
    audioError: false,
    bars: [],
    activeBars: 0,
    transcriptInput: '',
    transcriptOpen: false,
    transcriptLocked: false,
    audioExpired: false,
    quoteSaved: false,
    questionFavorited: false,
    locked: false,
    isDelivery: false,
    textCoverage: '—',
    submitting: false,
    expandedDim: '',
    scoreGuideOpen: false,
    scoreGuide: guide.SCORE_GUIDE
  },

  onLoad(options) {
    this.reportId = (options && options.id) || ''
    this.load(this.reportId)
  },

  onShow() {
    if (this.data.report && this.data.report.locked && store.isMember()) {
      const report = this.data.report
      report.locked = false
      store.updateReport(report)
      this.setData({ report, locked: false })
    }
  },

  load(id) {
    const report = id ? store.getReport(id) : null
    if (!report) {
      wx.showToast({ title: '点评不存在或已归档', icon: 'none' })
      setTimeout(() => util.goBack(), 700)
      return
    }
    const locked = !!report.locked && !store.isMember()
    const transcriptLocked = !!report.transcriptLocked
    const audioExpired = !!report.audioExpired || !report.audioPath
    const isDelivery = report.question.mode === 'read' ||
      report.question.scoreProfile === 'delivery' ||
      report.question.categoryId === 'pronounce' ||
      report.question.categoryId === 'read'

    const dims = (report.dimensions || []).map(d => {
      const g = guide.getDimensionGuide(d.key)
      return {
        key: d.key,
        name: d.name,
        detail: d.detail,
        score: d.score,
        tone: d.score >= 85 ? 'high' : d.score >= 70 ? 'mid' : 'low',
        muted: d.weight === 0,
        guide: g,
        fromLabel: guide.fromLabel(d.key),
        fromTone: g.from === 'text' ? 'text' : 'voice'
      }
    })

    const bars = ((report.audio && report.audio.waveform) || []).map((v, i) => ({
      id: i,
      h: Math.round(10 + v * 58)
    }))

    const text = report.text
    const facts = [
      { label: '录音时长', value: Math.round((report.audio && report.audio.duration) || 0), unit: '秒' },
      { label: '有效发声', value: Math.round(((report.audio && report.audio.speechRatio) || 0) * 100), unit: '%' },
      { label: '最长停顿', value: ((report.audio && report.audio.longestPause) || 0).toFixed(1), unit: '秒' },
      text
        ? { label: '语速', value: text.pace, unit: '字/分' }
        : { label: '声音起伏', value: ((report.audio && report.audio.energyCV) || 0).toFixed(2), unit: '' }
    ]

    this.setData({
      ready: true,
      report,
      dims,
      facts,
      locked,
      transcriptLocked,
      audioExpired,
      isDelivery,
      dateText: util.cnDate(report.date),
      sourceLabel: SOURCE_LABEL[report.source] || '练习',
      durationClock: util.clock((report.audio && report.audio.duration) || 0),
      bars,
      transcriptInput: report.transcript || '',
      transcriptOpen: !!report.transcript,
      quoteSaved: store.isQuoteSaved(report.quote),
      questionFavorited: report.question ? store.isFavorite(report.question.id) : false,
      textCoverage: report.text && report.text.coverage !== null
        ? report.text.matchedPoints.length + '/' + (report.question.keyPoints ? report.question.keyPoints.length : 1)
        : '—'
    })

    this.setupAudio(report)
  },

  setupAudio(report) {
    if (!report.audioPath) return
    try {
      const ctx = wx.createInnerAudioContext()
      ctx.src = report.audioPath
      ctx.onPlay(() => this.setData({ playing: true }))
      ctx.onPause(() => this.setData({ playing: false }))
      ctx.onStop(() => this.setData({ playing: false, activeBars: 0 }))
      ctx.onEnded(() => this.setData({
        playing: false,
        activeBars: 0,
        currentClock: '00:00'
      }))
      ctx.onTimeUpdate(() => {
        const duration = (report.audio && report.audio.duration) || 0
        const current = ctx.currentTime || 0
        const percent = duration ? Math.min(1, current / duration) : 0
        this.setData({
          currentClock: util.clock(current),
          activeBars: Math.round(percent * (this.data.bars.length || 0))
        })
      })
      ctx.onError(() => {
        this.setData({ audioError: true, playing: false })
      })
      this.audioCtx = ctx
    } catch (e) {
      this.setData({ audioError: true })
    }
  },

  onHide() {
    if (this.audioCtx && this.data.playing) {
      try { this.audioCtx.pause() } catch (e) { /* ignore */ }
    }
  },

  onUnload() {
    if (this.audioCtx) {
      try { this.audioCtx.destroy() } catch (e) { /* ignore */ }
      this.audioCtx = null
    }
  },

  togglePlay() {
    if (!this.audioCtx) {
      wx.showToast({ title: '这条录音没有本地文件', icon: 'none' })
      return
    }
    if (this.data.playing) {
      this.audioCtx.pause()
    } else {
      this.audioCtx.play()
    }
  },

  toggleTranscript() {
    this.setData({ transcriptOpen: !this.data.transcriptOpen })
  },

  onTranscriptInput(e) {
    this.setData({ transcriptInput: e.detail.value })
  },

  submitTranscript() {
    if (this.data.locked) {
      this.goMember()
      return
    }
    if (this.data.transcriptLocked) {
      wx.showToast({ title: '文字稿只能补充一次，避免分数被反复改写', icon: 'none' })
      return
    }
    if (this.data.submitting) return
    const text = (this.data.transcriptInput || '').trim()
    if (text.replace(/\s/g, '').length < 12) {
      wx.showToast({ title: '至少写 12 个字，分析才有意义', icon: 'none' })
      return
    }

    const report = this.data.report
    // 声音事实必须与当次录音一致，防止用别的录音数据重算这份报告
    if (report.audioKey && scoring.audioFingerprint(report.audio) !== report.audioKey) {
      wx.showModal({
        title: '录音数据已变化',
        content: '这段点评对应的声音数据不完整，无法补写文字稿。可以再练一次生成新的点评。',
        showCancel: false
      })
      return
    }

    this.setData({ submitting: true })
    const question = {
      id: report.question.id,
      title: report.question.title,
      prompt: report.question.prompt,
      categoryId: report.question.categoryId,
      categoryName: report.question.categoryName,
      minSeconds: report.question.minSeconds,
      maxSeconds: report.question.maxSeconds,
      keyPoints: report.question.keyPoints || [],
      mode: report.question.mode,
      scoreProfile: report.question.scoreProfile
    }

    const rebuilt = scoring.buildReport({
      id: report.id,
      question,
      audio: report.audio,
      transcript: text,
      source: report.source,
      date: report.date,
      locked: false,
      transcriptLocked: true,
      transcriptSubmittedAt: Date.now()
    })
    // 保留原始身份与本地资源引用，重算只影响文字维度
    rebuilt.createdAt = report.createdAt || rebuilt.createdAt
    rebuilt.audioPath = report.audioPath
    rebuilt.hasAudioFile = report.hasAudioFile
    rebuilt.audioExpired = report.audioExpired
    rebuilt.audioKey = report.audioKey || rebuilt.audioKey
    rebuilt.quotaSource = report.quotaSource
    rebuilt.quoteAdded = report.quoteAdded

    let quoteAdded = false
    if (rebuilt.overall >= 86 && rebuilt.quote && !store.isQuoteSaved(rebuilt.quote)) {
      store.addQuote({
        text: rebuilt.quote,
        source: question.title,
        questionId: question.id,
        date: rebuilt.date,
        score: rebuilt.overall
      })
      rebuilt.quoteAdded = true
      quoteAdded = true
    }

    store.updateReport(rebuilt)

    const dims = rebuilt.dimensions.map(d => ({
      key: d.key,
      name: d.name,
      detail: d.detail,
      score: d.score,
      tone: d.score >= 85 ? 'high' : d.score >= 70 ? 'mid' : 'low',
      muted: d.weight === 0
    }))

    this.setData({
      report: rebuilt,
      dims,
      transcriptOpen: true,
      transcriptInput: text,
      transcriptLocked: true,
      quoteSaved: store.isQuoteSaved(rebuilt.quote),
      textCoverage: rebuilt.text && rebuilt.text.coverage !== null
        ? rebuilt.text.matchedPoints.length + '/' + (rebuilt.question.keyPoints ? rebuilt.question.keyPoints.length : 1)
        : '—',
      submitting: false
    })

    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    wx.showToast({
      title: quoteAdded ? '已生成完整点评，并收入金句墙' : '已生成完整点评',
      icon: 'none'
    })
  },

  addQuote() {
    const report = this.data.report
    if (!report || !report.quote) {
      wx.showToast({ title: '这次还没有可收藏的完整句子', icon: 'none' })
      return
    }
    store.addQuote({
      text: report.quote,
      source: report.question.title,
      questionId: report.question.id,
      date: report.date,
      score: report.overall
    })
    this.setData({ quoteSaved: true })
    wx.showToast({ title: '已收入金句墙', icon: 'success' })
  },

  copyQuote() {
    if (!this.data.report || !this.data.report.quote) return
    wx.setClipboardData({ data: this.data.report.quote })
  },

  toggleDim(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ expandedDim: this.data.expandedDim === key ? '' : key })
  },

  toggleScoreGuide() {
    this.setData({ scoreGuideOpen: !this.data.scoreGuideOpen })
  },

  toggleQuestionFavorite() {
    const report = this.data.report
    if (!report || !report.question) return
    const res = store.toggleFavorite(report.question.id)
    if (!res.ok) return
    this.setData({ questionFavorited: res.favorited })
    wx.showToast({
      title: res.favorited ? '已收藏，可在练习页找到' : '已取消收藏',
      icon: 'none'
    })
  },

  practiceAgain() {
    const report = this.data.report
    if (!report) return
    const qid = report.question.id
    // 用替换而非压栈：否则「报告 → 再练一次 → 报告」会让页面栈线性增长
    if (qid.indexOf('pr_') === 0) {
      util.replacePage('/pages/session/session?source=pronounce&drill=' + qid.slice(3))
    } else {
      util.replacePage('/pages/session/session?source=practice&qid=' + qid)
    }
  },

  goToday() {
    util.switchTabSafe('/pages/today/today')
  },

  goMember() {
    wx.navigateTo({ url: '/pages/member/member' })
  },

  goPractice() {
    wx.switchTab({ url: '/pages/practice/practice' })
  },

  onShareAppMessage() {
    const report = this.data.report
    if (!report) {
      return { title: '每天三分钟，练一次好好说话', path: '/pages/today/today' }
    }
    return {
      title: '这句「' + util.truncate(report.quote || report.question.title, 18) + '」，我练了 ' + report.overall + ' 分',
      path: '/pages/today/today'
    }
  }
})
