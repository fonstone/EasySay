Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: 'pages/today/today',
        text: '今日',
        icon: '/assets/tab/home.png',
        activeIcon: '/assets/tab/home-active.png'
      },
      {
        pagePath: 'pages/discover/discover',
        text: '发现',
        icon: '/assets/tab/discover.png',
        activeIcon: '/assets/tab/discover-active.png'
      },
      {
        pagePath: 'pages/practice/practice',
        text: '练习',
        icon: '/assets/tab/practice.png',
        activeIcon: '/assets/tab/practice-active.png',
        center: true
      },
      {
        pagePath: 'pages/course/course',
        text: '课程',
        icon: '/assets/tab/course.png',
        activeIcon: '/assets/tab/course-active.png'
      },
      {
        pagePath: 'pages/mine/mine',
        text: '我的',
        icon: '/assets/tab/mine.png',
        activeIcon: '/assets/tab/mine-active.png'
      }
    ]
  },

  lifetimes: {
    attached() {
      this.updateSelected()
    }
  },

  pageLifetimes: {
    show() {
      this.updateSelected()
    }
  },

  methods: {
    updateSelected() {
      const pages = getCurrentPages()
      if (!pages || !pages.length) return
      const route = pages[pages.length - 1].route
      const index = this.data.list.findIndex(item => item.pagePath === route)
      if (index >= 0 && index !== this.data.selected) {
        this.setData({ selected: index })
      }
    },

    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const path = e.currentTarget.dataset.path
      if (index === this.data.selected) return
      this.setData({ selected: index })
      wx.switchTab({ url: '/' + path })
    }
  }
})
