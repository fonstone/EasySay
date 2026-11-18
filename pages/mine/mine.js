const store = require('../../utils/store')
const util = require('../../utils/util')
const scoring = require('../../utils/scoring')
const guide = require('../../data/dimension-guide')

const MEMBER_LABEL = {
  free: '免费版',
  trial: '体验会员',
  year: '年卡会员',
  twoyear: '两年卡会员',
  lifetime: '永久会员'
}

Page({
  data: {
    ready: false,
    profile: null,
    avatarText: '练',
    membership: null,
    memberLabel: '免费版',
    memberExpire: '',
    stats: null,
    thinking: null,
    streak: null,
    radarDims: [],
    dims: [],
    radarSub: '',
    heatmap: [],
    heatColumns: [],
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    totalMinutes: 0,
    quotes: 0,
    archive: 0,
    reviews: 0,
    courses: 0,
    favoriteCount: 0,
    hasRadar: false,
    expandedDim: '',
    activeGuide: null,
    radarGuideOpen: false,
    radarGuide: {
      title: '能力图谱怎么读',
      lines: [
        '取最近 20 次练习里各维度的平均分，至少完成 3 次练习才会生成。',
        '来自录音的维度反映声音事实；内容、结构、用词只在补过文字稿的报告里计入。',
        '点下面的任意维度，看它依据什么、下一次具体怎么练。'
      ]
    }
  },

  onShow() {
    const profile = store.getProfile()
    const membership = store.getMembership()
    const stats = store.getStats()
    const thinking = store.getThinkingStats()
    const streak = store.getStreak()
    const reports = store.getRecentReports(20)
    const radarDims = scoring.aggregateDimensions(reports)
    const dims = radarDims.map(d => ({
      key: d.key,
      name: d.name,
      value: d.value,
      tone: d.value >= 85 ? 'high' : d.value >= 70 ? 'mid' : 'low',
      guide: guide.getDimensionGuide(d.key),
      fromLabel: guide.fromLabel(d.key)
    }))
    const memberLabel = MEMBER_LABEL[membership.type] || '免费版'
    let memberExpire = ''
    if (membership.type === 'lifetime') memberExpire = '永久有效'
    else if (membership.type !== 'free' && membership.expireAt) {
      memberExpire = '至 ' + util.cnDate(util.dateKey(new Date(membership.expireAt)))
    }

    const heatmap = store.getHeatmap(8)
    const heatColumns = heatmap.map((col, index) => ({ id: 'w' + index, cells: col }))
    const hasRadar = reports.length >= 3 && radarDims.length >= 3

    this.setData({
      ready: true,
      profile,
      avatarText: profile.nickname ? profile.nickname.slice(0, 1) : '练',
      membership,
      memberLabel,
      memberExpire,
      stats,
      thinking,
      streak,
      radarDims: hasRadar ? radarDims : [],
      dims: hasRadar ? dims : [],
      radarSub: hasRadar
        ? '基于最近 ' + reports.length + ' 次练习'
        : '记录每一次开口的形状',
      heatmap,
      heatColumns,
      totalMinutes: Math.round((stats.seconds || 0) / 60),
      quotes: store.getQuotes().length,
      archive: store.getArchive().length,
      reviews: store.getReviews().length,
      courses: Object.keys(store.getCourseProgress()).length,
      favoriteCount: store.getFavoriteIds().length,
      hasRadar
    })
  },

  toggleDim(e) {
    const key = e.currentTarget.dataset.key
    if (this.data.expandedDim === key) {
      this.setData({ expandedDim: '', activeGuide: null })
      return
    }
    const item = (this.data.dims || []).find(d => d.key === key)
    this.setData({
      expandedDim: key,
      activeGuide: item ? {
        name: item.name,
        fromLabel: item.fromLabel,
        basis: item.guide.basis,
        improve: item.guide.improve
      } : null
    })
  },

  toggleRadarGuide() {
    this.setData({ radarGuideOpen: !this.data.radarGuideOpen })
  },

  goFavorites() {
    wx.navigateTo({ url: '/pages/search/search?scope=favorites' })
  },

  goMember() {
    wx.navigateTo({ url: '/pages/member/member' })
  },

  goArchive() {
    wx.navigateTo({ url: '/pages/archive/archive' })
  },

  goQuotes() {
    wx.navigateTo({ url: '/pages/quotes/quotes' })
  },

  goReview() {
    wx.navigateTo({ url: '/pages/review/review' })
  },

  goCoach() {
    wx.navigateTo({ url: '/pages/coach/coach' })
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  goCourses() {
    wx.switchTab({ url: '/pages/course/course' })
  },

  onShareAppMessage() {
    return {
      title: '我在清述练了 ' + (this.data.stats ? this.data.stats.sessions : 0) + ' 次开口',
      path: '/pages/today/today'
    }
  }
})
