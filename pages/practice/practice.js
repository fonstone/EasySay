const store = require('../../utils/store')
const util = require('../../utils/util')
const questionData = require('../../data/questions')

Page({
  data: {
    categories: [],
    totalDone: 0,
    totalQuestions: 0,
    monthSessions: 0,
    last: null,
    plan: null,
    planGoal: null,
    planDone: 0,
    planNext: null,
    ready: false
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    let totalDone = 0
    const categories = questionData.CATEGORIES.map(meta => {
      const progress = store.getCategoryProgress(meta.id)
      totalDone += progress.done
      let nextQuestion = null
      let currentLevel = 1
      progress.levels.forEach(lv => {
        if (!lv.unlocked) return
        if (!nextQuestion) {
          const q = lv.questions.find(x => !x.done)
          if (q) {
            nextQuestion = q
            currentLevel = lv.n
          }
        }
      })
      if (!nextQuestion) {
        nextQuestion = progress.levels[0].questions[0]
        currentLevel = progress.levels[progress.levels.length - 1].n
      }
      const allDone = progress.done >= progress.total
      return Object.assign({}, meta, {
        done: progress.done,
        total: progress.total,
        percent: progress.percent,
        nextQuestion,
        currentLevel,
        levelLabel: allDone ? '已通关' : '第 ' + currentLevel + ' 关',
        nextLabel: allDone ? '已通关，可重练' : '下一题',
        levelsDone: progress.levels.filter(l => l.done === l.total).length,
        levelsTotal: progress.levels.length
      })
    })

    const history = store.getHistory(1)
    const plan = store.getCoachPlan()
    let planGoal = null
    let planDone = 0
    let planNext = null
    if (plan && plan.goalId) {
      planGoal = require('../../data/coach').getGoal(plan.goalId)
      planDone = (plan.completed || []).length
      const nextIndex = (plan.completed || []).length
      if (planGoal && planGoal.plan[nextIndex]) {
        planNext = questionData.getQuestion(planGoal.plan[nextIndex])
      }
    }

    const stats = store.getStats()
    let monthSessions = 0
    const now = util.dateKey()
    Object.keys(stats.days || {}).forEach(key => {
      if (key.slice(0, 7) === now.slice(0, 7)) monthSessions += stats.days[key].sessions || 0
    })

    this.setData({
      ready: true,
      categories,
      totalDone,
      totalQuestions: questionData.QUESTIONS.length,
      monthSessions,
      last: history[0] || null,
      plan: plan || null,
      planGoal,
      planDone,
      planNext
    })
  },

  openCategory(e) {
    wx.navigateTo({
      url: '/pages/practice-detail/practice-detail?category=' + e.currentTarget.dataset.id
    })
  },

  openQuestion(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/session/session?source=practice&qid=' + id })
  },

  openLast() {
    if (!this.data.last) return
    if (this.data.last.reportId) {
      wx.navigateTo({ url: '/pages/report/report?id=' + this.data.last.reportId })
    } else {
      wx.navigateTo({ url: '/pages/session/session?source=practice&qid=' + this.data.last.questionId })
    }
  },

  randomPractice() {
    const list = questionData.QUESTIONS
    const q = list[Math.floor(Math.random() * list.length)]
    wx.navigateTo({ url: '/pages/session/session?source=practice&qid=' + q.id })
  },

  openPlan() {
    if (this.data.planNext) {
      wx.navigateTo({ url: '/pages/session/session?source=coach&qid=' + this.data.planNext.id })
    } else {
      wx.navigateTo({ url: '/pages/coach/coach' })
    }
  },

  goCoach() {
    wx.navigateTo({ url: '/pages/coach/coach' })
  },

  onShareAppMessage() {
    return {
      title: '六个抽屉，练六种表达能力',
      path: '/pages/practice/practice'
    }
  }
})
