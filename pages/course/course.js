const store = require('../../utils/store')
const courses = require('../../data/courses')

Page({
  data: {
    ready: false,
    tracks: [],
    totalDone: 0,
    totalLessons: courses.LESSONS.length,
    percent: 0,
    nextLesson: null,
    nextTrack: null
  },

  onShow() {
    const doneMap = store.getCourseProgress()
    const tracks = courses.getTracksWithProgress(doneMap)
    let totalDone = 0
    tracks.forEach(t => { totalDone += t.done })
    let nextLesson = null
    let nextTrack = null
    for (let i = 0; i < tracks.length; i++) {
      const lesson = tracks[i].lessons.find(l => !doneMap[l.id])
      if (lesson) {
        nextLesson = lesson
        nextTrack = tracks[i]
        break
      }
    }
    this.setData({
      ready: true,
      tracks,
      totalDone,
      percent: courses.LESSONS.length ? Math.round(totalDone / courses.LESSONS.length * 100) : 0,
      nextLesson,
      nextTrack
    })
  },

  openTrack(e) {
    wx.navigateTo({ url: '/pages/course-track/course-track?id=' + e.currentTarget.dataset.id })
  },

  openLesson(e) {
    wx.navigateTo({ url: '/pages/lesson/lesson?id=' + e.currentTarget.dataset.id })
  },

  continueLearning() {
    if (this.data.nextLesson) {
      wx.navigateTo({ url: '/pages/lesson/lesson?id=' + this.data.nextLesson.id })
    } else {
      wx.navigateTo({ url: '/pages/course-track/course-track?id=cognition' })
    }
  },

  onShareAppMessage() {
    return {
      title: '先把方法装进口袋，再开口',
      path: '/pages/course/course'
    }
  }
})
