const store = require('../../utils/store')
const util = require('../../utils/util')

const SORTS = [
  { key: 'new', name: '最新留下' },
  { key: 'score', name: '分数最高' },
  { key: 'short', name: '最短' }
]

Page({
  data: {
    ready: false,
    quotes: [],
    filtered: [],
    total: 0,
    keyword: '',
    sort: 'new',
    sorts: SORTS,
    emptyMode: 'none',
    emptyTitle: '还没有金句',
    emptyDesc: '补上文字稿且评分达到 86 分，或在点评页主动收藏，那句话就会留在这里。',
    emptyAction: '去练一次'
  },

  onShow() {
    const quotes = store.getQuotes().map((q, i) => Object.assign({}, q, {
      dateText: util.cnDateShort(q.date),
      label: i + 1 < 10 ? '0' + (i + 1) : String(i + 1)
    }))
    this.setData({ ready: true, quotes, total: quotes.length })
    this.applyFilters()
  },

  applyFilters() {
    const all = this.data.quotes || []
    const kw = String(this.data.keyword || '').trim().toLowerCase()
    let list = all.filter(q => {
      if (!kw) return true
      return String(q.text || '').toLowerCase().indexOf(kw) >= 0 ||
        String(q.source || '').toLowerCase().indexOf(kw) >= 0
    })
    if (this.data.sort === 'score') {
      list = list.slice().sort((a, b) => (b.score || 0) - (a.score || 0))
    } else if (this.data.sort === 'short') {
      list = list.slice().sort((a, b) => String(a.text || '').length - String(b.text || '').length)
    }
    const filtered = list.map((q, i) => Object.assign({}, q, {
      label: i + 1 < 10 ? '0' + (i + 1) : String(i + 1)
    }))
    const noResult = !!kw && all.length > 0 && filtered.length === 0
    this.setData({
      filtered,
      emptyMode: noResult ? 'search' : 'none',
      emptyTitle: noResult ? '没有匹配的金句' : '还没有金句',
      emptyDesc: noResult
        ? '换个词试试，搜的是句子内容和它来自的题目。'
        : '补上文字稿且评分达到 86 分，或在点评页主动收藏，那句话就会留在这里。',
      emptyAction: noResult ? '清空搜索' : '去练一次'
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
    else this.goPractice()
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
