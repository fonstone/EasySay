const store = require('../../utils/store')
const coach = require('../../data/coach')
const questionData = require('../../data/questions')

function buildPreview(goal) {
  if (!goal) return []
  return goal.plan.map((qid, index) => {
    const q = questionData.getQuestion(qid)
    return {
      day: index + 1,
      qid,
      title: q ? q.title : '一道练习题',
      categoryName: q ? q.categoryName : ''
    }
  })
}

Page({
  data: {
    ready: false,
    goals: coach.GOALS,
    selectedId: 'work',
    selectedGoal: null,
    previewItems: [],
    plan: null,
    planGoal: null,
    planItems: [],
    planDayLabel: '',
    completedCount: 0,
    nextItem: null,
    profile: null,
    allDone: false
  },

  onShow() {
    const profile = store.getProfile()
    const plan = store.getCoachPlan()
    const goals = coach.GOALS
    let selectedId = this.data.selectedId
    if (plan && plan.goalId) selectedId = plan.goalId
    const selectedGoal = coach.getGoal(selectedId) || goals[0]

    const data = {
      ready: true,
      goals,
      selectedId,
      selectedGoal,
      previewItems: buildPreview(selectedGoal),
      profile,
      plan: plan || null
    }

    if (plan && plan.goalId) {
      const planGoal = coach.getGoal(plan.goalId)
      const completed = plan.completed || []
      const planItems = (planGoal ? planGoal.plan : []).map((qid, index) => {
        const q = questionData.getQuestion(qid)
        return {
          day: index + 1,
          qid,
          title: q ? q.title : '',
          subtitle: q ? q.subtitle : '',
          categoryName: q ? q.categoryName : '',
          minutes: q ? Math.max(2, Math.round((q.maxSeconds || 60) / 60) + 1) : 3,
          done: completed.indexOf(qid) !== -1,
          current: false
        }
      })
      const firstUndone = planItems.findIndex(item => !item.done)
      if (firstUndone >= 0) planItems[firstUndone].current = true
      data.planGoal = planGoal
      data.planItems = planItems
      data.completedCount = planItems.filter(x => x.done).length
      data.nextItem = firstUndone >= 0 ? planItems[firstUndone] : null
      data.allDone = firstUndone === -1
      data.planDayLabel = firstUndone === -1 ? '7 / 7 已完成' : '第 ' + (firstUndone + 1) + ' / 7 天'
    }

    this.setData(data)
  },

  selectGoal(e) {
    if (this.data.plan) return
    const id = e.currentTarget.dataset.id
    const selectedGoal = coach.getGoal(id)
    this.setData({
      selectedId: id,
      selectedGoal,
      previewItems: buildPreview(selectedGoal)
    })
  },

  createPlan() {
    const goal = coach.getGoal(this.data.selectedId)
    if (!goal) return
    store.saveCoachPlan({
      goalId: goal.id,
      createdAt: Date.now(),
      completed: []
    })
    this.onShow()
    wx.showToast({ title: '七天计划已生成', icon: 'success' })
  },

  startNext() {
    if (!this.data.nextItem) return
    wx.navigateTo({
      url: '/pages/session/session?source=coach&qid=' + this.data.nextItem.qid
    })
  },

  openItem(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.planItems[index]
    if (!item) return
    if (item.done) {
      const history = store.getHistory(50).filter(h => h.questionId === item.qid && h.reportId)
      if (history.length) {
        wx.navigateTo({ url: '/pages/report/report?id=' + history[0].reportId })
      } else {
        wx.navigateTo({ url: '/pages/session/session?source=coach&qid=' + item.qid })
      }
      return
    }
    if (item.current) {
      wx.navigateTo({ url: '/pages/session/session?source=coach&qid=' + item.qid })
    } else {
      wx.showToast({ title: '先完成第 ' + (index) + ' 天', icon: 'none' })
    }
  },

  resetPlan() {
    wx.showModal({
      title: '重新排一周？',
      content: '当前计划的完成记录会保留在练习历史里，计划本身会重新生成。',
      confirmText: '重新排',
      success: res => {
        if (res.confirm) {
          store.saveCoachPlan(null)
          this.setData({ plan: null, planGoal: null, planItems: [], allDone: false, nextItem: null })
          this.onShow()
        }
      }
    })
  },

  onShareAppMessage() {
    return {
      title: this.data.planGoal ? '我的' + this.data.planGoal.name + '七天训练计划' : '让私教替你排一周',
      path: '/pages/coach/coach'
    }
  }
})
