const store = require('../../utils/store')
const util = require('../../utils/util')
const thinkingData = require('../../data/thinking')
const pronounceData = require('../../data/pronounce')
const coachData = require('../../data/coach')

const MICRO_QUOTES = [
  '表达的上限，是你思考的上限。',
  '先把事实说清，再谈感受。',
  '一个具体例子，胜过三个形容词。',
  '停顿不是卡壳，是给重点让路。',
  '能复述，才算真的读懂。',
  '把「你总是」换成「这周有三次」。'
]

Page({
  data: {
    ready: false,
    thinking: null,
    pronounceDone: 0,
    reviews: 0,
    planGoal: null,
    planDone: 0,
    planStat: '',
    dailyQuestion: null,
    dailyMeta: '',
    drills: [],
    drillTotal: 0,
    quote: '',
    todayThinking: 0
  },

  onShow() {
    const thinking = store.getThinkingStats()
    const pronounceDone = store.getPronounceDone().length
    const reviews = store.getReviews().length
    const plan = store.getCoachPlan()
    let planGoal = null
    if (plan && plan.goalId) planGoal = coachData.getGoal(plan.goalId)

    const seed = Number(String(util.dateKey()).replace(/-/g, '')) || 0
    const dailyQuestion = thinkingData.QUESTIONS[seed % thinkingData.QUESTIONS.length]
    const drills = pronounceData.DRILLS.filter(d => d.section === 'initial').slice(0, 4)
    const quote = MICRO_QUOTES[seed % MICRO_QUOTES.length]
    const planDone = plan ? (plan.completed || []).length : 0
    const planStat = planGoal ? planGoal.name + ' · 第 ' + (planDone + 1) + ' 天' : '还没有训练计划'
    const dailyMeta = thinking.todayCount > 0
      ? '今天已做 ' + thinking.todayCount + ' 题'
      : '花 30 秒，判断一次'

    this.setData({
      ready: true,
      thinking,
      pronounceDone,
      reviews,
      planGoal,
      planDone,
      planStat,
      dailyQuestion,
      dailyMeta,
      drills,
      drillTotal: pronounceData.DRILLS.length,
      quote,
      todayThinking: thinking.todayCount
    })
  },

  startDailyThinking() {
    const q = this.data.dailyQuestion
    if (!q) return
    wx.navigateTo({ url: '/pages/thinking-quiz/thinking-quiz?id=' + q.id })
  },

  goThinking() {
    wx.navigateTo({ url: '/pages/thinking/thinking' })
  },

  goPronounce() {
    wx.navigateTo({ url: '/pages/pronounce/pronounce' })
  },

  goDrill(e) {
    wx.navigateTo({ url: '/pages/pronounce-detail/pronounce-detail?id=' + e.currentTarget.dataset.id })
  },

  goReview() {
    wx.navigateTo({ url: '/pages/review/review' })
  },

  goCoach() {
    wx.navigateTo({ url: '/pages/coach/coach' })
  },

  onShareAppMessage() {
    return {
      title: '换个角度，练脑子也练嘴',
      path: '/pages/discover/discover'
    }
  }
})
