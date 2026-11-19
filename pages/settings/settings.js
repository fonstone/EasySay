const store = require('../../utils/store')
const coach = require('../../data/coach')
const backup = require('../../utils/backup')

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
    backupHint: '',
    backupStatusText: '',
    backupNeeded: false,
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
    // 写入失败不再静默：直接告诉用户先备份、再清理空间
    const health = store.getStorageHealth()
    if (health.lastWriteError) {
      storageText += ' · 检测到写入失败，建议先导出备份'
    }
    const status = store.getBackupStatus()
    const backupHint = status.reminder.needed
      ? status.reminder.reason
      : '数据只在本机，卸载或清缓存前请导出备份'
    let backupStatusText = '从未导出过备份'
    if (status.lastBackupAt) {
      const d = new Date(status.lastBackupAt)
      backupStatusText = '上次导出 ' + (d.getMonth() + 1) + '月' + d.getDate() + '日' +
        ' · 此后新增 ' + status.reportsSinceBackup + ' 份点评'
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
      storageText,
      backupHint,
      backupStatusText,
      backupNeeded: !!status.reminder.needed
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

  /**
   * 纯本地小程序没有云端，导出文件是唯一能跨卸载保全数据的手段。
   * 优先写真实 .json 文件并尝试分享，剪贴板作为兜底；成功后记录备份时间。
   */
  async exportBackup() {
    let json = ''
    try {
      json = JSON.stringify(store.exportData())
    } catch (e) {
      wx.showToast({ title: '生成备份失败', icon: 'none' })
      return
    }

    const filePath = await backup.writeBackupFile(json)
    const shared = backup.shareBackupFile(filePath)
    const sizeText = Math.max(1, Math.round(json.length / 1024)) + ' KB'

    const done = channel => {
      store.markBackupDone(channel)
      this.onShow()
      wx.showModal({
        title: '备份已导出',
        content: (filePath
          ? (shared ? '已生成备份文件并调起分享，同时复制到剪贴板。' : '已生成本机备份文件，并复制到剪贴板。')
          : '本机不支持文件分享，已复制到剪贴板。') +
          '约 ' + sizeText + '，包含资料、练习记录与点评；录音文件不导出。' +
          (filePath ? '文件路径：' + filePath : '请立刻粘贴到备忘录或发给自己保存。'),
        showCancel: false,
        confirmText: '知道了'
      })
    }

    wx.setClipboardData({
      data: json,
      success: () => done(filePath ? (shared ? 'file+clipboard' : 'file') : 'clipboard'),
      fail: () => {
        if (filePath) done(shared ? 'file' : 'file')
        else wx.showToast({ title: '复制失败，请稍后重试', icon: 'none' })
      }
    })
  },

  importBackup() {
    wx.showModal({
      title: '从剪贴板恢复？',
      content: '会用剪贴板里的备份覆盖同名数据，当前记录可能被替换。建议先导出一次现有数据。',
      confirmText: '开始恢复',
      success: res => {
        if (!res.confirm) return
        wx.getClipboardData({
          success: r => {
            try {
              const result = store.importData(r.data)
              this.onShow()
              wx.showToast({ title: '已恢复 ' + result.restored + ' 项数据', icon: 'none' })
            } catch (e) {
              wx.showModal({
                title: '恢复失败',
                content: '剪贴板里不是有效的清述备份。' + (e && e.message ? e.message : ''),
                showCancel: false
              })
            }
          },
          fail: () => wx.showToast({ title: '读取剪贴板失败', icon: 'none' })
        })
      }
    })
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
