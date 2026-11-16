const store = require('../../utils/store')
const util = require('../../utils/util')

const MEMBER_LABEL = {
  free: '免费版',
  trial: '7 天体验会员',
  year: '年卡会员',
  twoyear: '两年卡会员',
  lifetime: '永久会员'
}

Page({
  data: {
    ready: false,
    membership: null,
    memberLabel: '免费版',
    expireText: '',
    isMember: false,
    trialUsed: false,
    quota: null,
    plans: [],
    selected: 'year',
    selectedPlan: null,
    benefits: [
      { title: '无限次教练点评', desc: '每天练几次都可以，包含内容、结构、声音七个维度' },
      { title: '全部课程与私教计划', desc: '三条学习线、七天训练计划、全部场景题库（演示版全部开放）' },
      { title: '录音档案与金句墙', desc: '回听每一次开口，收藏说得很好的瞬间' },
      { title: '后续新增内容', desc: '新题库、新课程、新场景，不再单独收费' }
    ]
  },

  onShow() {
    const membership = store.getMembership()
    const quota = store.getReviewQuota()
    const isMember = store.isMember()
    const plans = ['year', 'twoyear', 'lifetime'].map(id => {
      const p = store.PLANS[id]
      const days = p.days || 365
      return Object.assign({}, p, {
        perDay: p.days ? (p.price / p.days).toFixed(2) : '一次买断',
        perDayText: p.days ? '约 ¥' + (p.price / p.days).toFixed(2) + ' / 天' : '一次买断',
        highlight: id === 'twoyear'
      })
    })
    let expireText = ''
    if (membership.type === 'lifetime') expireText = '永久有效'
    else if (membership.expireAt) expireText = util.cnDate(util.dateKey(new Date(membership.expireAt))) + ' 到期'
    const selected = this.data.selected || 'year'
    this.setData({
      ready: true,
      membership,
      memberLabel: MEMBER_LABEL[membership.type] || '免费版',
      expireText,
      isMember,
      trialUsed: !!membership.trialUsed,
      quota,
      plans,
      selected,
      selectedPlan: plans.find(p => p.id === selected)
    })
  },

  selectPlan(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      selected: id,
      selectedPlan: this.data.plans.find(p => p.id === id)
    })
  },

  buyPlan() {
    const plan = this.data.selectedPlan
    if (!plan) return
    if (this.data.membership.type === 'lifetime') {
      wx.showToast({ title: '你已经是永久会员', icon: 'none' })
      return
    }
    wx.showModal({
      title: '模拟开通「' + plan.name + '」',
      content: '这是纯本地演示版，不会发起真实支付，也不会扣款。确认后将直接激活会员，方便体验完整功能。',
      confirmText: '模拟开通',
      confirmColor: '#1B5A47',
      success: res => {
        if (!res.confirm) return
        store.activatePlan(plan.id)
        wx.showToast({ title: '已模拟开通', icon: 'success' })
        this.onShow()
      }
    })
  },

  startTrial() {
    if (this.data.trialUsed) {
      wx.showToast({ title: '体验会员已经用过了', icon: 'none' })
      return
    }
    wx.showModal({
      title: '领取 7 天体验会员',
      content: '立即获得 7 天无限点评，并额外赠送 3 次点评点数。演示版直接激活。',
      confirmText: '立即领取',
      confirmColor: '#1B5A47',
      success: res => {
        if (!res.confirm) return
        const result = store.activateTrial()
        if (result.ok) {
          wx.showToast({ title: '体验会员已激活', icon: 'success' })
          this.onShow()
        } else {
          wx.showToast({ title: '已经领取过了', icon: 'none' })
        }
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '把练习变成日常，每天一毛钱',
      path: '/pages/member/member'
    }
  }
})
