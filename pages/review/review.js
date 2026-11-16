const store = require('../../utils/store')
const util = require('../../utils/util')

const STUCK_OPTIONS = [
  '开头不知道说什么',
  '中间卡住了',
  '语速太快',
  '口头禅太多',
  '收尾散了',
  '一紧张就乱',
  '内容没展开',
  '结构听不出来'
]

Page({
  data: {
    ready: false,
    learned: '',
    stuck: [],
    stuckText: '',
    next: '',
    message: '',
    options: STUCK_OPTIONS.map(label => ({ label, on: false })),
    lastSession: null,
    lastReview: null,
    reviewCount: 0,
    saved: false
  },

  onShow() {
    const history = store.getHistory(1)
    const reviews = store.getReviews()
    const last = reviews[0] || null
    const lastSession = history[0] || null
    if (!this.data.saved) {
      this.setData({
        learned: lastSession ? '今天练了「' + lastSession.title + '」，得了 ' + lastSession.overall + ' 分。' : '',
        lastSession
      })
    }
    this.setData({
      ready: true,
      lastReview: last,
      reviewCount: reviews.length
    })
  },

  toggleStuck(e) {
    const value = e.currentTarget.dataset.value
    const list = this.data.stuck.slice()
    const index = list.indexOf(value)
    if (index === -1) list.push(value)
    else list.splice(index, 1)
    const options = this.data.options.map(opt => Object.assign({}, opt, {
      on: list.indexOf(opt.label) !== -1
    }))
    this.setData({ stuck: list, options })
  },

  onLearned(e) {
    this.setData({ learned: e.detail.value })
  },

  onStuckText(e) {
    this.setData({ stuckText: e.detail.value })
  },

  onNext(e) {
    this.setData({ next: e.detail.value })
  },

  onMessage(e) {
    this.setData({ message: e.detail.value })
  },

  save() {
    if (!this.data.next.trim()) {
      wx.showToast({ title: '写下下次要改的那一件事', icon: 'none' })
      return
    }
    store.addReview({
      date: util.dateKey(),
      learned: this.data.learned.trim(),
      stuck: this.data.stuck,
      stuckText: this.data.stuckText.trim(),
      next: this.data.next.trim(),
      message: this.data.message.trim(),
      sessionTitle: this.data.lastSession ? this.data.lastSession.title : ''
    })
    this.setData({
      saved: true,
      lastReview: store.getReviews()[0],
      reviewCount: store.getReviews().length
    })
    wx.showToast({ title: '已存下这次复盘', icon: 'success' })
  },

  writeAnother() {
    this.setData({
      saved: false,
      stuck: [],
      stuckText: '',
      next: '',
      message: '',
      options: STUCK_OPTIONS.map(label => ({ label, on: false }))
    })
    this.onShow()
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/review-history/review-history' })
  },

  onShareAppMessage() {
    return {
      title: '只记一个失误，写一个预案',
      path: '/pages/review/review'
    }
  }
})
