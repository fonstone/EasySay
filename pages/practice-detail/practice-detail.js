const store = require('../../utils/store')
const questionData = require('../../data/questions')

Page({
  data: {
    category: null,
    levels: [],
    done: 0,
    total: 0,
    percent: 0,
    expanded: 1,
    nextQuestion: null,
    ready: false
  },

  onLoad(options) {
    const id = (options && options.category) || 'structure'
    const category = questionData.getCategory(id) || questionData.CATEGORIES[0]
    wx.setNavigationBarTitle({ title: category.name })
    this.setData({ category })
    this.refresh(category.id)
  },

  onShow() {
    if (this.data.category) this.refresh(this.data.category.id)
  },

  refresh(categoryId) {
    const progress = store.getCategoryProgress(categoryId)
    const levels = progress.levels.map((lv, i) => Object.assign({}, lv, {
      prevName: i > 0 ? progress.levels[i - 1].name : ''
    }))
    let nextQuestion = null
    let expanded = this.data.expanded || 1
    levels.forEach(lv => {
      if (lv.unlocked && !nextQuestion) {
        const q = lv.questions.find(x => !x.done)
        if (q) {
          nextQuestion = q
          if (!this.data.ready) expanded = lv.n
        }
      }
    })
    if (!nextQuestion) {
      const first = progress.levels[0] && progress.levels[0].questions[0]
      nextQuestion = first || null
    }
    this.setData({
      ready: true,
      levels,
      done: progress.done,
      total: progress.total,
      percent: progress.percent,
      nextQuestion,
      expanded
    })
  },

  toggleLevel(e) {
    const n = Number(e.currentTarget.dataset.n)
    const level = this.data.levels.find(l => l.n === n)
    if (!level || !level.unlocked) {
      wx.showToast({ title: '先完成上一关任意一题', icon: 'none' })
      return
    }
    this.setData({ expanded: this.data.expanded === n ? 0 : n })
  },

  startQuestion(e) {
    const id = e.currentTarget.dataset.id
    const level = Number(e.currentTarget.dataset.level)
    const lv = this.data.levels.find(l => l.n === level)
    if (lv && !lv.unlocked) {
      wx.showToast({ title: '这一关还没解锁', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/session/session?source=practice&qid=' + id })
  },

  startNext() {
    if (!this.data.nextQuestion) return
    wx.navigateTo({ url: '/pages/session/session?source=practice&qid=' + this.data.nextQuestion.id })
  },

  onShareAppMessage() {
    return {
      title: this.data.category ? this.data.category.name + ' · ' + this.data.category.tagline : '清述口才练习',
      path: '/pages/practice-detail/practice-detail?category=' + (this.data.category ? this.data.category.id : 'structure')
    }
  }
})
