const store = require('./utils/store')

App({
  globalData: {
    statusBarHeight: 20,
    windowWidth: 375,
    user: null
  },

  onLaunch() {
    store.init()

    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      this.globalData.statusBarHeight = info.statusBarHeight || 20
      this.globalData.windowWidth = info.windowWidth || 375
    } catch (e) {
      // 低版本基础库兜底
    }

    this.globalData.user = store.getProfile()
  },

  onShow() {
    this.globalData.user = store.getProfile()
  }
})
