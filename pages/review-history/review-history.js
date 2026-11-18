const store = require('../../utils/store')
const util = require('../../utils/util')

const SORTS = [
  { key: 'new', name: '最新' },
  { key: 'old', name: '最早' }
]

Page({
  data: {
    reviews: [],
    filtered: [],
    total: 0,
    keyword: '',
    sort: 'new',
    sorts: SORTS,
    ready: false,
    emptyMode: 'none',
    emptyTitle: '还没有复盘',
    emptyDesc: '完成一次练习后，花两分钟写一次。只记一个失误，写一个预案。',
    emptyAction: '去写第一次复盘'
  },

  onShow() {
    const reviews = store.getReviews().map(r => Object.assign({}, r, {
      dateText: util.cnDate(r.date || util.dateKey())
    }))
    this.setData({ reviews, total: reviews.length, ready: true })
    this.applyFilters()
  },

  applyFilters() {
    const all = this.data.reviews || []
    const kw = String(this.data.keyword || '').trim().toLowerCase()
    let list = all.filter(r => {
      if (!kw) return true
      const parts = [r.learned, r.stuckText, r.next, r.message, r.dateText]
        .concat(Array.isArray(r.stuck) ? r.stuck : [])
      return parts.some(p => String(p || '').toLowerCase().indexOf(kw) >= 0)
    })
    if (this.data.sort === 'old') {
      list = list.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    } else {
      list = list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    }
    const noResult = !!kw && all.length > 0 && list.length === 0
    this.setData({
      filtered: list,
      emptyMode: noResult ? 'search' : 'none',
      emptyTitle: noResult ? '没有匹配的复盘' : '还没有复盘',
      emptyDesc: noResult
        ? '换个词试试，搜的是练了什么、卡在哪里和下次要改的动作。'
        : '完成一次练习后，花两分钟写一次。只记一个失误，写一个预案。',
      emptyAction: noResult ? '清空搜索' : '去写第一次复盘'
    })
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value || '' })
    this.applyFilters()
  },

  pickSort(e) {
    this.setData({ sort: e.currentTarget.dataset.key || 'new' })
    this.applyFilters()
  },

  clearKeyword() {
    this.setData({ keyword: '' })
    this.applyFilters()
  },

  onEmptyAction() {
    if (this.data.emptyMode === 'search') this.clearKeyword()
    else this.goReview()
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
