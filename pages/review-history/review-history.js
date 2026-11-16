const store = require('../../utils/store')
const util = require('../../utils/util')

Page({
  data: {
    reviews: [],
    ready: false
  },

  onShow() {
    const reviews = store.getReviews().map(r => Object.assign({}, r, {
      dateText: util.cnDate(r.date || util.dateKey())
    }))
    this.setData({ reviews, ready: true })
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这次复盘？',
      content: '删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#B25A48',
      success: res => {
        if (res.confirm) {
          store.removeReview(id)
          this.onShow()
          wx.showToast({ title: '已删除', icon: 'none' })
        }
      }
    })
  },

  goReview() {
    wx.navigateTo({ url: '/pages/review/review' })
  },

  onShareAppMessage() {
    return {
      title: '把每次练习，变成下一次的预案',
      path: '/pages/review/review'
    }
  }
})
