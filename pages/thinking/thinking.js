const store = require('../../utils/store')
const thinking = require('../../data/thinking')

Page({
  data: {
    ready: false,
    stats: null,
    types: [],
    questions: [],
    total: thinking.QUESTIONS.length,
    done: 0,
    accuracy: 0
  },

  onLoad(options) {
    if (options && options.start === '1') {
      const seed = Number(String(new Date().getFullYear()) + String(new Date().getMonth() + 1) + String(new Date().getDate())) || 0
      const q = thinking.QUESTIONS[seed % thinking.QUESTIONS.length]
      wx.navigateTo({ url: '/pages/thinking-quiz/thinking-quiz?id=' + q.id })
    }
  },

  onShow() {
    const log = store.getThinkingLog()
    const doneMap = {}
    const lastMap = {}
    log.forEach(item => {
      if (!doneMap[item.id]) doneMap[item.id] = { correct: 0, total: 0 }
      doneMap[item.id].total += 1
      if (item.correct) doneMap[item.id].correct += 1
      if (!lastMap[item.id]) lastMap[item.id] = item.correct
    })

    const types = thinking.TYPES.map(t => {
      const list = thinking.QUESTIONS.filter(q => q.type === t.id)
      const logs = log.filter(x => x.type === t.id)
      const unique = new Set(logs.map(x => x.id)).size
      const correct = logs.filter(x => x.correct).length
      return Object.assign({}, t, {
        total: list.length,
        done: unique,
        attempts: logs.length,
        accuracy: logs.length ? Math.round(correct / logs.length * 100) : 0
      })
    })

    const questions = thinking.QUESTIONS.map(q => {
      const d = doneMap[q.id]
      return Object.assign({}, q, {
        done: !!d,
        lastCorrect: lastMap[q.id] === true
      })
    })

    const uniqueDone = Object.keys(doneMap).length
    const stats = store.getThinkingStats()

    this.setData({
      ready: true,
      stats,
      types,
      questions,
      done: uniqueDone,
      accuracy: stats.accuracy
    })
  },

  startQuestion(e) {
    wx.navigateTo({ url: '/pages/thinking-quiz/thinking-quiz?id=' + e.currentTarget.dataset.id })
  },

  startType(e) {
    const typeId = e.currentTarget.dataset.type
    const list = thinking.QUESTIONS.filter(q => q.type === typeId)
    const answered = new Set(store.getThinkingLog().map(x => x.id))
    const q = list.find(x => !answered.has(x.id)) || list[0]
    wx.navigateTo({ url: '/pages/thinking-quiz/thinking-quiz?id=' + q.id + '&type=' + typeId })
  },

  onShareAppMessage() {
    return {
      title: '能不能把话说清楚，先看你分不分得清事实和观点',
      path: '/pages/thinking/thinking'
    }
  }
})
