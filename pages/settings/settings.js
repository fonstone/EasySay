const store = require('../../utils/store')
const coach = require('../../data/coach')

Page({
  data: {
    ready: false,
    nickname: '',
    goalId: 'work',
    goalName: '职场汇报',
    level: '刚开始',
    dailyMinutes: 5,
    prepSeconds: 30,
    chances: 2,
    dailyGoal: 1,
    haptic: true,
    goals: coach.GOALS,
    levels: ['刚开始', '能说但不清楚', '想更稳'],
    times: [3, 5, 10],
    preps: [15, 30, 45],
    chanceOptions: [1, 2, 3],
    dailyGoals: [1, 2, 3],
    membershipLabel: '免费版',
    storageText: '',
    version: '1.0.0'
  },

  onShow() {
    const profile = store.getProfile()
    const settings = store.getSettings()
    const membership = store.getMembership()
    const labels = { free: '免费版', trial: '体验会员', year: '年卡会员', twoyear: '两年卡会员', lifetime: '永久会员' }
    let storageText = ''
    try {
      const info = wx.getStorageInfoSync()
      storageText = (info.currentSize || 0) + ' KB / ' + (info.limitSize || 0) + ' KB'
    } catch (e) {
      storageText = '—'
    }
    this.setData({
      ready: true,
      nickname: profile.nickname || '练习者',
      goalId: profile.goalId || 'work',
      goalName: profile.goalName || '职场汇报',
      level: profile.level || '刚开始',
      dailyMinutes: profile.dailyMinutes || 5,
      prepSeconds: settings.prepSeconds,
      chances: settings.chances,
      dailyGoal: settings.dailyGoal,
      haptic: settings.haptic !== false,
      membershipLabel: labels[membership.type] || '免费版',
      storageText
    })
  },

  onNickname(e) {
    this.setData({ nickname: e.detail.value })
  },

  pickGoal(e) {
    const id = e.currentTarget.dataset.id
    const goal = coach.getGoal(id)
    this.setData({ goalId: id, goalName: goal ? goal.name : '职场汇报' })
  },

  pickLevel(e) {
    this.setData({ level: e.currentTarget.dataset.value })
  },

  pickTime(e) {
    this.setData({ dailyMinutes: Number(e.currentTarget.dataset.value) })
  },

  pickPrep(e) {
    this.setData({ prepSeconds: Number(e.currentTarget.dataset.value) })
  },

  pickChances(e) {
    this.setData({ chances: Number(e.currentTarget.dataset.value) })
  },

  pickDailyGoal(e) {
    this.setData({ dailyGoal: Number(e.currentTarget.dataset.value) })
  },

  toggleHaptic(e) {
    const value = e.detail.value
    this.setData({ haptic: value })
    store.saveSettings({ haptic: value })
  },

  save() {
    const nickname = (this.data.nickname || '').trim()
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    store.saveProfile({
      nickname,
      goalId: this.data.goalId,
      goalName: this.data.goalName,
      level: this.data.level,
      dailyMinutes: this.data.dailyMinutes
    })
    store.saveSettings({
      prepSeconds: this.data.prepSeconds,
      chances: this.data.chances,
      dailyGoal: this.data.dailyGoal,
      haptic: this.data.haptic
    })
    wx.showToast({ title: '设置已保存', icon: 'success' })
  },

  clearPractice() {
    wx.showModal({
      title: '清空练习数据？',
      content: '会删除练习记录、点评、录音、金句、复盘和闯关进度。会员与个人资料保留。此操作不可恢复。',
      confirmText: '清空',
      confirmColor: '#B25A48',
      success: res => {
        if (!res.confirm) return
        store.clearPractice()
        this.onShow()
        wx.showToast({ title: '练习数据已清空', icon: 'none' })
      }
    })
  },

  resetAll() {
    wx.showModal({
      title: '重置所有数据？',
      content: '所有本地数据都会被删除，包括个人资料、会员状态和录音文件。小程序会回到第一次打开的状态。',
      confirmText: '全部重置',
      confirmColor: '#B25A48',
      success: res => {
        if (!res.confirm) return
        store.resetAll()
        wx.reLaunch({ url: '/pages/onboarding/onboarding' })
      }
    })
  },

  goMember() {
    wx.navigateTo({ url: '/pages/member/member' })
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  onShareAppMessage() {
    return {
      title: '清述 · 每天三分钟，练一次好好说话',
      path: '/pages/today/today'
    }
  }
})
