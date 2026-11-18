const store = require('../../utils/store')
const util = require('../../utils/util')
const questionData = require('../../data/questions')

const QUOTES = [
  { text: '先把话说清楚，再把话说漂亮。', from: '清述' },
  { text: '你不是说得不够多，是说得太满了。', from: '认知篇' },
  { text: '停顿不是空白，是让重点落地。', from: '当众表达' },
  { text: '表达不是倒出来，是帮听众搭一个架子。', from: '认知篇' },
  { text: '好的收尾，是把话放到对方手里。', from: '当众表达' },
  { text: '即兴的底气，来自你练过的结构。', from: '脱稿表达' },
  { text: '先完成，再完美。今天先开口。', from: '清述' }
]

Page({
  data: {
    ready: false,
    greeting: '早上好',
    dateText: '',
    nickname: '练习者',
    streak: 0,
    bestStreak: 0,
    question: null,
    todayState: null,
    done: false,
    doneReport: null,
    chancesLeft: 0,
    chancesTotal: 2,
    prepSeconds: 30,
    tasks: [],
    taskDone: 0,
    taskTotal: 3,
    week: [],
    weekSessions: 0,
    weekMinutes: 0,
    weekAvg: 0,
    quota: null,
    quote: QUOTES[0],
    primaryLabel: '开始今天的练习',
    primarySub: '准备 30 秒 · 表达 60 秒'
  },

  onLoad() {
    this.setData({ dateText: util.cnDate(util.dateKey()) })
  },

  onShow() {
    if (!store.isOnboarded()) {
      wx.reLaunch({ url: '/pages/onboarding/onboarding' })
      return
    }
    this.refresh()
  },

  refresh() {
    const profile = store.getProfile()
    const settings = store.getSettings()
    const state = store.getTodayState()
    const question = questionData.getQuestion(state.questionId) || questionData.getDailyQuestion(util.dateKey())
    const streak = store.getStreak()
    const tasks = store.getTodayTasks()
    const quota = store.getDailyQuota()
    const week = store.getWeekStrip(7)

    let weekSessions = 0
    let weekSeconds = 0
    let scoreSum = 0
    let scoreCount = 0
    week.forEach(d => {
      const day = store.getDay(d.key)
      weekSessions += day.sessions || 0
      weekSeconds += day.seconds || 0
      scoreSum += day.scoreSum || 0
      scoreCount += day.scoreCount || 0
    })

    const doneReport = state.done && state.reportId ? store.getReport(state.reportId) : null
    const done = !!state.done
    const chancesLeft = done ? 0 : Math.max(0, settings.chances - (state.attempts || 0))
    const seed = Number(String(util.dateKey()).replace(/-/g, '')) || 0

    let primaryLabel = '开始今天的练习'
    let primarySub = '准备 ' + settings.prepSeconds + ' 秒 · 表达 ' + ((question && question.maxSeconds) || 90) + ' 秒'
    if (done) {
      primaryLabel = '查看今日点评'
      primarySub = doneReport ? '这次 ' + doneReport.overall + ' 分 · ' + doneReport.grade.label : '今天已经开口了'
    } else if (chancesLeft <= 0) {
      primaryLabel = '本题重录次数已用完'
      primarySub = '去练习区继续，或明天再来'
    } else {
      primarySub = quota.chancesLabel + ' · 准备 ' + settings.prepSeconds + ' 秒'
    }

    this.setData({
      ready: true,
      greeting: util.greeting(),
      dateText: util.cnDate(util.dateKey()),
      nickname: profile.nickname || '练习者',
      streak: streak.current,
      bestStreak: streak.best,
      question,
      todayState: state,
      done,
      doneReport,
      chancesLeft,
      chancesTotal: settings.chances,
      prepSeconds: settings.prepSeconds,
      tasks,
      taskDone: tasks.filter(t => t.done).length,
      taskTotal: tasks.length,
      week,
      weekSessions,
      weekMinutes: Math.round(weekSeconds / 60),
      weekAvg: scoreCount ? Math.round(scoreSum / scoreCount) : 0,
      quota,
      quote: QUOTES[seed % QUOTES.length],
      primaryLabel,
      primarySub
    })
  },

  startToday() {
    const state = this.data.todayState
    if (this.data.done) {
      if (state.reportId) {
        wx.navigateTo({ url: '/pages/report/report?id=' + state.reportId })
      } else {
        wx.showToast({ title: '今天的点评已归档', icon: 'none' })
      }
      return
    }

    if (this.data.chancesLeft <= 0) {
      wx.showModal({
        title: '今日机会用完了',
        content: '这是刻意设计的上限：模拟真实发言，只给你有限次重来。去练习区选一道题继续，或者明天再来。',
        confirmText: '去练习',
        cancelText: '明天再来',
        success: res => {
          if (res.confirm) wx.switchTab({ url: '/pages/practice/practice' })
        }
      })
      return
    }

    wx.navigateTo({
      url: '/pages/session/session?source=today&qid=' + (this.data.question ? this.data.question.id : '')
    })
  },

  handleTask(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'checkin') {
      this.startToday()
      return
    }
    if (key === 'thinking') {
      wx.navigateTo({ url: '/pages/thinking/thinking?start=1' })
      return
    }
    if (key === 'read') {
      wx.navigateTo({ url: '/pages/practice-detail/practice-detail?category=read' })
    }
  },

  goPractice() {
    wx.switchTab({ url: '/pages/practice/practice' })
  },

  goMine() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  goCoach() {
    wx.navigateTo({ url: '/pages/coach/coach' })
  },

  goScene() {
    wx.navigateTo({ url: '/pages/practice-detail/practice-detail?category=scene' })
  },

  goThinking() {
    wx.navigateTo({ url: '/pages/thinking/thinking' })
  },

  goMember() {
    wx.navigateTo({ url: '/pages/member/member' })
  },

  onShareAppMessage() {
    const score = this.data.doneReport ? this.data.doneReport.overall : ''
    return {
      title: score ? '我在清述练了 ' + score + ' 分，来练一次好好说话' : '每天三分钟，练一次好好说话',
      path: '/pages/today/today'
    }
  }
})
