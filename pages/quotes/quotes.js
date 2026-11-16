const store = require('../../utils/store')
const util = require('../../utils/util')

Page({
  data: {
    ready: false,
    quotes: []
  },

  onShow() {
    const quotes = store.getQuotes().map((q, i) => Object.assign({}, q, {
      dateText: util.cnDateShort(q.date),
      label: i + 1 < 10 ? '0' + (i + 1) : String(i + 1)
    }))
    this.setData({ ready: true, quotes })
  },

  copy(e) {
    const text = e.currentTarget.dataset.text
    if (!text) return
    wx.setClipboardData({ data: text })
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '从金句墙移除？',
      content: '这句话仍会保留在对应的点评里。',
      confirmText: '移除',
      success: res => {
        if (res.confirm) {
          store.removeQuote(id)
          this.onShow()
        }
      }
    })
  },

  goPractice() {
    wx.switchTab({ url: '/pages/practice/practice' })
  },

  onShareAppMessage() {
    const first = this.data.quotes[0]
    return {
      title: first ? '「' + util.truncate(first.text, 22) + '」' : '把说得很好的瞬间留下来',
      path: '/pages/quotes/quotes'
    }
  }
})
