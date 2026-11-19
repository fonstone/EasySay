const store = require('../../utils/store')
const coach = require('../../data/coach')
const planEngine = require('../../utils/plan')

/** 收集排题所需的真实数据：报告、收藏、最近练习、已练题目 */
function planContext() {
  const progress = store.getProgress()
  return {
    reports: store.getRecentReports(8),
    favorites: store.getFavoriteIds(),
    recentIds: store.getRecentQuestionIds(),
    doneIds: Object.keys(progress.questions || {}),
    sessionCount: store.getStats().sessions || 0
  }
}

function buildPreviewItems(plan) {
  return (plan.days || []).map(d => ({
    day: d.day,
    qid: d.qid,
    title: d.title,
    categoryName: d.categoryName,
    reason: d.reason
  }))
}

Page({
  data: {
    ready: false,
    goals: coach.GOALS,
    selectedId: 'work',
    selectedGoal: null,
    previewItems: [],
    previewFocus: '',
    previewNote: '',
    plan: null,
    planGoal: null,
    planItems: [],
    planDayLabel: '',
    completedCount: 0,
    nextItem: null,
    profile: null,
    allDone: false,
    planFocusText: '',
    planEngineLabel: '',
    isLegacy: false,
    basisText: ''
  },

  onShow() {
    const profile = store.getProfile()
    const rawPlan = store.getCoachPlan()
    const plan = planEngine.normalizePlan(rawPlan)
    const goals = coach.GOALS
    let selectedId = this.data.selectedId
    if (plan && plan.goalId) selectedId = plan.goalId
    const selectedGoal = coach.getGoal(selectedId) || goals[0]
    const preview = planEngine.buildPlan(Object.assign({ goalId: selectedGoal.id }, planContext()))

    const data = {
      ready: true,
      goals,
      selectedId,
      selectedGoal,
      previewItems: buildPreviewItems(preview),
      previewFocus: preview.focusText,
      previewNote: '按最近 ' + preview.basis.reports + ' 份报告与练习量试排 · 不联网 · 生成后仍可重排',
      profile,
      plan: rawPlan || null
    }

    if (plan) {
      const planGoal = coach.getGoal(plan.goalId)
      const completed = plan.completed || []
      const planItems = (plan.days || []).map((d, index) => ({
        day: d.day,
        qid: d.qid,
        title: d.title,
        subtitle: d.subtitle,
        categoryName: d.categoryName,
        minutes: d.minutes || 3,
        reason: d.reason || '',
        focus: d.focus || '',
        done: completed.indexOf(d.qid) !== -1,
        current: false
      }))
      const firstUndone = planItems.findIndex(item => !item.done)
      if (firstUndone >= 0) planItems[firstUndone].current = true
      data.planGoal = planGoal
      data.planItems = planItems
      data.completedCount = planItems.filter(x => x.done).length
      data.nextItem = firstUndone >= 0 ? planItems[firstUndone] : null
      data.allDone = firstUndone === -1
      data.planDayLabel = firstUndone === -1
        ? '7 / 7 已完成'
        : '第 ' + (firstUndone + 1) + ' / ' + planItems.length + ' 天'
      data.planFocusText = plan.focusText || ''
      data.isLegacy = plan.engine === 'legacy-fixed-v0'
      data.planEngineLabel = data.isLegacy ? '旧版固定课表' : '按你的练习数据动态排题'
      data.basisText = '依据 ' + (plan.basis ? plan.basis.reports : 0) +
        ' 份报告 · 目标关卡 ' + (plan.basis ? plan.basis.targetLevel : 1) +
        ' · ' + (plan.basis ? plan.basis.generatedFrom : '本地规则')
    }

    this.setData(data)
  },

  selectGoal(e) {
    if (this.data.plan) return
    const id = e.currentTarget.dataset.id
    const selectedGoal = coach.getGoal(id)
    const preview = planEngine.buildPlan(Object.assign({ goalId: id }, planContext()))
    this.setData({
      selectedId: id,
      selectedGoal,
      previewItems: buildPreviewItems(preview),
      previewFocus: preview.focusText,
      previewNote: '按最近 ' + preview.basis.reports + ' 份报告与练习量试排 · 不联网 · 生成后仍可重排'
    })
  },

  createPlan() {
    const goal = coach.getGoal(this.data.selectedId)
    if (!goal) return
    const built = planEngine.buildPlan(Object.assign({ goalId: goal.id }, planContext()))
    store.saveCoachPlan(built)
    this.onShow()
    wx.showToast({ title: '已按你的数据排好七天', icon: 'success' })
  },

  /** 用最新练习数据重排，保留已完成记录，不再回到固定课表 */
  rebuildPlan() {
    const current = planEngine.normalizePlan(store.getCoachPlan())
    if (!current) return
    const built = planEngine.buildPlan(Object.assign({
      goalId: current.goalId,
      completed: current.completed || []
    }, planContext()))
    store.saveCoachPlan(built)
    this.onShow()
    wx.showToast({ title: '已按最新数据重排', icon: 'success' })
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
      content: '当前计划的完成记录会保留在练习历史里，计划本身会按最新数据重新生成。',
      confirmText: '重新排',
      success: res => {
        if (res.confirm) {
          const current = planEngine.normalizePlan(store.getCoachPlan())
          if (current) {
            const built = planEngine.buildPlan(Object.assign({
              goalId: current.goalId,
              completed: current.completed || []
            }, planContext()))
            store.saveCoachPlan(built)
            this.setData({ plan: built })
            this.onShow()
            wx.showToast({ title: '已重新排好', icon: 'none' })
          } else {
            store.saveCoachPlan(null)
            this.setData({ plan: null, planGoal: null, planItems: [], allDone: false, nextItem: null })
            this.onShow()
          }
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
