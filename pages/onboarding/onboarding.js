const store = require('../../utils/store')
const coach = require('../../data/coach')

Page({
  data: {
    statusBarHeight: 20,
    step: 0,
    dots: [0, 1, 2, 3],
    goals: coach.GOALS,
    goalId: 'work',
    levels: [
      { id: '刚开始', name: '刚开始', desc: '一开口就紧张，经常不知道说什么', glyph: '始' },
      { id: '能说但不清楚', name: '能说，但不够清楚', desc: '话不少，别人却抓不住重点', glyph: '清' },
      { id: '想更稳', name: '已经能说，想更稳', desc: '想练结构、节奏和临场反应', glyph: '稳' }
    ],
    level: '刚开始',
    times: [
      { minutes: 3, name: '3 分钟', desc: '一题就够' },
      { minutes: 5, name: '5 分钟', desc: '推荐' },
      { minutes: 10, name: '10 分钟', desc: '认真练一轮' }
    ],
    minutes: 5,
    nickname: '练习者'
  },

  onLoad() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      this.setData({ statusBarHeight: info.statusBarHeight || 20 })
    } catch (e) {
      // ignore
    }
  },

  pickGoal(e) {
    this.setData({ goalId: e.currentTarget.dataset.id })
  },

  pickLevel(e) {
    this.setData({ level: e.currentTarget.dataset.id })
  },

  pickTime(e) {
    this.setData({ minutes: Number(e.currentTarget.dataset.minutes) })
  },

  onNickname(e) {
    this.setData({ nickname: e.detail.value })
  },

  next() {
    if (this.data.step < 3) {
      this.setData({ step: this.data.step + 1 })
      wx.pageScrollTo({ scrollTop: 0, duration: 200 })
    } else {
      this.finish()
    }
  },

  prev() {
    if (this.data.step > 0) {
      this.setData({ step: this.data.step - 1 })
    }
  },

  finish() {
    const goal = coach.getGoal(this.data.goalId) || coach.GOALS[0]
    store.completeOnboarding({
      nickname: (this.data.nickname || '').trim() || '练习者',
      goalId: goal.id,
      goalName: goal.name,
      level: this.data.level,
      dailyMinutes: this.data.minutes
    })
    wx.switchTab({ url: '/pages/today/today' })
  },

  skip() {
    store.saveProfile({ onboarded: true })
    wx.switchTab({ url: '/pages/today/today' })
  },

  onShareAppMessage() {
    return {
      title: '先说清楚，再被听见',
      path: '/pages/today/today'
    }
  }
})
