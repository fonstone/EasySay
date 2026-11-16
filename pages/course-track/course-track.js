const store = require('../../utils/store')
const courses = require('../../data/courses')

Page({
  data: {
    track: null,
    lessons: [],
    done: 0,
    total: 0,
    percent: 0,
    nextLesson: null,
    ctaText: ''
  },

  onLoad(options) {
    const id = (options && options.id) || 'cognition'
    const track = courses.getTrack(id) || courses.TRACKS[0]
    this.setData({ track })
    wx.setNavigationBarTitle({ title: track.name })
    this.refresh(track.id)
  },

  onShow() {
    if (this.data.track) this.refresh(this.data.track.id)
  },

  refresh(trackId) {
    const doneMap = store.getCourseProgress()
    const lessons = courses.getLessons(trackId).map(l => Object.assign({}, l, { done: !!doneMap[l.id] }))
    const done = lessons.filter(l => l.done).length
    const nextLesson = lessons.find(l => !l.done) || lessons[0] || null
    this.setData({
      lessons,
      done,
      total: lessons.length,
      percent: lessons.length ? Math.round(done / lessons.length * 100) : 0,
      nextLesson,
      ctaText: done === 0
        ? '从第一课开始'
        : (nextLesson ? '继续：' + nextLesson.title : '全部学完了')
    })
  },

  openLesson(e) {
    wx.navigateTo({ url: '/pages/lesson/lesson?id=' + e.currentTarget.dataset.id })
  },

  startNext() {
    if (this.data.nextLesson) {
      wx.navigateTo({ url: '/pages/lesson/lesson?id=' + this.data.nextLesson.id })
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.track ? this.data.track.name + ' · ' + this.data.track.desc : '清述课程',
      path: '/pages/course-track/course-track?id=' + (this.data.track ? this.data.track.id : 'cognition')
    }
  }
})
