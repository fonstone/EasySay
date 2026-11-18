const store = require('../../utils/store')
const util = require('../../utils/util')
const pronounce = require('../../data/pronounce')

Page({
  data: {
    drill: null,
    section: null,
    done: false,
    related: [],
    playing: false,
    audioError: false
  },

  onLoad(options) {
    const id = (options && options.id) || 'zh1'
    const drill = pronounce.getDrill(id) || pronounce.DRILLS[0]
    const section = pronounce.getSection(drill.section)
    const related = pronounce.DRILLS
      .filter(d => d.section === drill.section && d.id !== drill.id)
      .slice(0, 3)
    this.setData({ drill, section, related })
    wx.setNavigationBarTitle({ title: section.name })
    this.setupAudio(drill)
  },

  setupAudio(drill) {
    if (!drill.audio) return
    try {
      const ctx = wx.createInnerAudioContext()
      ctx.src = drill.audio
      ctx.onPlay(() => this.setData({ playing: true }))
      ctx.onPause(() => this.setData({ playing: false }))
      ctx.onStop(() => this.setData({ playing: false }))
      ctx.onEnded(() => this.setData({ playing: false }))
      ctx.onError(() => {
        this.setData({ playing: false, audioError: true })
      })
      this.audioCtx = ctx
    } catch (e) {
      this.setData({ audioError: true })
    }
  },

  toggleDemo() {
    if (!this.audioCtx) {
      wx.showToast({ title: '示范音频不可用', icon: 'none' })
      return
    }
    if (this.data.playing) {
      this.audioCtx.pause()
    } else {
      this.audioCtx.play()
    }
  },

  onUnload() {
    if (this.audioCtx) {
      try { this.audioCtx.destroy() } catch (e) { /* ignore */ }
      this.audioCtx = null
    }
  },

  onShow() {
    if (this.data.drill) {
      this.setData({ done: store.getPronounceDone().indexOf(this.data.drill.id) !== -1 })
    }
  },

  startPractice() {
    wx.navigateTo({
      url: '/pages/session/session?source=pronounce&drill=' + this.data.drill.id
    })
  },

  openRelated(e) {
    wx.redirectTo({ url: '/pages/pronounce-detail/pronounce-detail?id=' + e.currentTarget.dataset.id })
  },

  goBack() {
    util.goBack()
  },

  onShareAppMessage() {
    return {
      title: this.data.drill ? '跟我一起读：' + this.data.drill.title : '普通话纠音',
      path: '/pages/pronounce-detail/pronounce-detail?id=' + (this.data.drill ? this.data.drill.id : 'zh1')
    }
  }
})
