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
    entitlement: null,
    demoNotice: '纯本地演示：不会发起微信支付，不产生订单，也不扣款。',
    plans: [],
    selected: 'year',
    selectedPlan: null,
    benefits: [
      { title: '不限次完整点评', desc: '本地演示：开启后不再受每天 5 份点评的限制' },
      { title: '课程与私教计划', desc: '本版本对所有用户开放，会员开关不会额外解锁内容' },
      { title: '录音档案与金句墙', desc: '回听与收藏对所有用户开放，不是付费门槛' },
      { title: '价格仅为正式版示意', desc: '本版本不接微信支付、不生成订单、不扣款，无任何真实交易' }
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
      entitlement: store.getEntitlement(),
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
      title: '开启本地体验 · ' + plan.name,
      content: '纯本地演示：这里只是把本机的额度开关打开，不会调用微信支付、不生成订单、不扣款。页面上的价格是正式版示意，与本版本无关。',
      confirmText: '直接开启',
      confirmColor: '#1B5A47',
      success: res => {
        if (!res.confirm) return
        store.activatePlan(plan.id)
        wx.showToast({ title: '已开启本地不限次体验', icon: 'success' })
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
      title: '开启 7 天本地体验',
      content: '纯本地演示：直接打开本机不限次开关并加 3 次点数，不扣款、不产生订单，也不代表正式版权益。',
      confirmText: '直接开启',
      confirmColor: '#1B5A47',
      success: res => {
        if (!res.confirm) return
        const result = store.activateTrial()
        if (result.ok) {
          wx.showToast({ title: '本地体验已开启', icon: 'success' })
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
