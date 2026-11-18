const store = require('../../utils/store')
const util = require('../../utils/util')
const questionData = require('../../data/questions')

const CATEGORY_TABS = [{ id: '', name: '全部方向' }].concat(
  questionData.CATEGORIES.map(c => ({ id: c.id, name: c.name }))
)
const LEVEL_TABS = [{ n: 0, name: '全部关卡' }].concat(
  questionData.LEVELS.map(l => ({ n: l.n, name: '第 ' + l.n + ' 关' }))
)
const SORT_TABS = [
  { key: 'recommend', name: '推荐' },
  { key: 'recent', name: '最近练过' },
  { key: 'short', name: '时间最短' },
  { key: 'hard', name: '难度最高' }
]

Page({
  data: {
    ready: false,
    keyword: '',
    focus: false,
    history: [],
    hints: questionData.SEARCH_HINTS,
    totalQuestions: questionData.QUESTIONS.length,
    categories: CATEGORY_TABS,
    levels: LEVEL_TABS,
    sorts: SORT_TABS,
    categoryId: '',
    level: 0,
    sort: 'recommend',
    sortTouched: false,
    onlyFavorites: false,
    scope: 'all',
    results: [],
    resultTitle: '全部题目',
    showIntro: true,
    favoriteCount: 0,
    recentCount: 0,
    activeFilterCount: 0,
    emptyTitle: '没找到相关的题',
    emptyDesc: '换个词试试，或者清空筛选看全部题目。',
    emptyAction: '清空筛选'
  },

  onLoad(options) {
    const scope = (options && options.scope) || 'all'
    const keyword = (options && options.keyword) || ''
    this.setData({
      scope: scope === 'favorites' || scope === 'recent' ? scope : 'all',
      keyword,
      onlyFavorites: scope === 'favorites',
      sort: scope === 'recent' ? 'recent' : 'recommend',
      focus: !keyword
    })
    this.updateTitle()
    this.refresh()
  },

  onShow() {
    if (this.data.ready) this.refresh()
  },

  updateTitle() {
    const map = { all: '找题', favorites: '我的收藏', recent: '最近练过' }
    wx.setNavigationBarTitle({ title: map[this.data.scope] || '找题' })
  },

  refresh() {
    const favoriteIds = store.getFavoriteIds()
    const recentIds = store.getRecentQuestionIds()
    const progress = store.getProgress()
    const doneIds = Object.keys(progress.questions || {})
    const keyword = (this.data.keyword || '').trim()
    const sort = this.data.sortTouched
      ? this.data.sort
      : (keyword ? 'relevance' : (this.data.scope === 'recent' ? 'recent' : 'recommend'))

    let list = questionData.searchQuestions(keyword, {
      categoryId: this.data.categoryId,
      level: this.data.level,
      onlyFavorites: this.data.onlyFavorites,
      favoriteIds,
      recentIds,
      doneIds,
      sort
    })

    if (this.data.scope === 'recent') {
      const rank = {}
      recentIds.forEach((id, i) => { rank[id] = i })
      list = list.filter(q => rank[q.id] !== undefined)
        .sort((a, b) => rank[a.id] - rank[b.id])
    }

    const results = list.slice(0, 60).map(q => {
      const p = progress.questions[q.id]
      return {
        id: q.id,
        title: q.title,
        subtitle: q.subtitle,
        categoryName: q.categoryName,
        levelName: q.levelName,
        duration: q.minSeconds + '–' + q.maxSeconds + ' 秒',
        glyph: q.categoryGlyph,
        color: q.categoryColor,
        soft: q.categorySoft,
        done: !!p,
        best: p ? p.best : 0,
        favorite: favoriteIds.indexOf(q.id) >= 0,
        recent: recentIds.indexOf(q.id) >= 0
      }
    })

    const activeFilterCount =
      (this.data.categoryId ? 1 : 0) + (this.data.level ? 1 : 0) +
      (this.data.onlyFavorites ? 1 : 0) + (keyword ? 1 : 0)

    const emptyPresets = {
      favorites: {
        title: '还没有收藏题目',
        desc: '在题目右侧点 ☆，或练完在点评页收藏这道题，下次直接从这里开始。',
        action: '看看全部题目'
      },
      recent: {
        title: '最近还没练过题',
        desc: '完成一次录音后，这道题会自动出现在最近练过里。',
        action: '看看全部题目'
      },
      keyword: {
        title: '没找到相关的题',
        desc: '换个词试试，比如「汇报」「讲故事」，或者清空筛选看全部 48 道题。',
        action: '清空筛选'
      },
      filter: {
        title: '这个条件下没有题目',
        desc: '方向、关卡或收藏条件收得太紧了，放宽一个试试。',
        action: '清空筛选'
      }
    }
    const preset = !results.length
      ? (this.data.scope === 'favorites'
        ? emptyPresets.favorites
        : this.data.scope === 'recent'
          ? emptyPresets.recent
          : keyword ? emptyPresets.keyword : emptyPresets.filter)
      : null

    let resultTitle = '全部题目'
    if (keyword) resultTitle = '“' + keyword + '”的结果'
    else if (this.data.scope === 'favorites') resultTitle = '我收藏的题'
    else if (this.data.scope === 'recent') resultTitle = '最近练过'
    else if (activeFilterCount) resultTitle = '筛选结果'

    this.setData({
      ready: true,
      results,
      resultTitle,
      history: store.getSearchHistory(),
      favoriteCount: favoriteIds.length,
      recentCount: recentIds.length,
      activeFilterCount,
      showIntro: !keyword && !activeFilterCount && this.data.scope === 'all',
      emptyTitle: preset ? preset.title : '',
      emptyDesc: preset ? preset.desc : '',
      emptyAction: preset ? preset.action : '清空筛选'
    })
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value || '' })
    this.refresh()
  },

  onConfirm(e) {
    const kw = (e.detail.value || this.data.keyword || '').trim()
    if (kw) store.pushSearchHistory(kw)
    this.setData({ keyword: kw, focus: false })
    this.refresh()
  },

  applyHint(e) {
    const kw = e.currentTarget.dataset.word || ''
    if (!kw) return
    store.pushSearchHistory(kw)
    this.setData({ keyword: kw, focus: false })
    this.refresh()
  },

  clearKeyword() {
    this.setData({ keyword: '', focus: true })
    this.refresh()
  },

  clearHistory() {
    store.clearSearchHistory()
    this.refresh()
    wx.showToast({ title: '搜索记录已清空', icon: 'none' })
  },

  pickCategory(e) {
    this.setData({ categoryId: e.currentTarget.dataset.id || '' })
    this.refresh()
  },

  pickLevel(e) {
    this.setData({ level: Number(e.currentTarget.dataset.n) || 0 })
    this.refresh()
  },

  pickSort(e) {
    this.setData({ sort: e.currentTarget.dataset.key || 'recommend', sortTouched: true })
    this.refresh()
  },

  toggleFavoritesOnly() {
    this.setData({ onlyFavorites: !this.data.onlyFavorites })
    this.refresh()
  },

  openFavorites() {
    this.setData({ scope: 'favorites', onlyFavorites: true, keyword: '', sortTouched: false })
    this.updateTitle()
    this.refresh()
  },

  openRecent() {
    this.setData({ scope: 'recent', onlyFavorites: false, keyword: '', sort: 'recent', sortTouched: false })
    this.updateTitle()
    this.refresh()
  },

  resetFilters() {
    this.setData({
      scope: 'all', keyword: '', categoryId: '', level: 0,
      onlyFavorites: false, sort: 'recommend', sortTouched: false
    })
    this.updateTitle()
    this.refresh()
  },

  onEmptyAction() {
    this.resetFilters()
  },

  toggleFav(e) {
    const id = e.currentTarget.dataset.id
    const res = store.toggleFavorite(id)
    if (!res.ok) return
    wx.showToast({ title: res.favorited ? '已收藏，可在找题页查看' : '已取消收藏', icon: 'none' })
    this.refresh()
  },

  openQuestion(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/session/session?source=practice&qid=' + id })
  },

  goBack() {
    util.goBack()
  },

  onShareAppMessage() {
    return { title: '48 道表达练习题，搜一道就开练', path: '/pages/search/search' }
  }
})
