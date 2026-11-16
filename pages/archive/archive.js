const store = require('../../utils/store')
const util = require('../../utils/util')

Page({
  data: {
    ready: false,
    items: [],
    playingId: ''
  },

  onShow() {
    this.load()
  },

  load() {
    const items = store.getArchive().map(item => Object.assign({}, item, {
      dateText: util.cnDate(item.date),
      durationText: util.clock(item.duration || 0)
    }))
    this.setData({ ready: true, items })
  },

  togglePlay(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.items.find(x => x.id === id)
    if (!item) return

    if (this.data.playingId === id) {
      if (this.ctx) this.ctx.pause()
      this.setData({ playingId: '' })
      return
    }

    if (this.ctx) {
      try { this.ctx.destroy() } catch (err) { /* ignore */ }
      this.ctx = null
    }

    const ctx = wx.createInnerAudioContext()
    ctx.src = item.path
    ctx.onPlay(() => this.setData({ playingId: id }))
    ctx.onEnded(() => this.setData({ playingId: '' }))
    ctx.onStop(() => this.setData({ playingId: '' }))
    ctx.onError(() => {
      this.setData({ playingId: '' })
      wx.showToast({ title: '录音文件已失效', icon: 'none' })
    })
    ctx.play()
    this.ctx = ctx
    this.setData({ playingId: id })
  },

  openReport(e) {
    const id = e.currentTarget.dataset.report
    if (!id) {
      wx.showToast({ title: '这条录音没有关联点评', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/report/report?id=' + id })
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条录音？',
      content: '录音文件会从本机永久删除，点评文字仍会保留。',
      confirmText: '删除',
      confirmColor: '#B25A48',
      success: res => {
        if (!res.confirm) return
        if (this.data.playingId === id && this.ctx) {
          try { this.ctx.stop() } catch (err) { /* ignore */ }
        }
        store.removeArchive(id)
        this.setData({ playingId: '' })
        this.load()
        wx.showToast({ title: '已删除', icon: 'none' })
      }
    })
  },

  goPractice() {
    wx.switchTab({ url: '/pages/practice/practice' })
  },

  onHide() {
    if (this.ctx) {
      try { this.ctx.pause() } catch (e) { /* ignore */ }
      this.setData({ playingId: '' })
    }
  },

  onUnload() {
    if (this.ctx) {
      try { this.ctx.destroy() } catch (e) { /* ignore */ }
      this.ctx = null
    }
  },

  onShareAppMessage() {
    return {
      title: '每一次开口，都留了档',
      path: '/pages/archive/archive'
    }
  }
})
