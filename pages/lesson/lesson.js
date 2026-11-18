const store = require('../../utils/store')
const util = require('../../utils/util')
const courses = require('../../data/courses')
const questionData = require('../../data/questions')

Page({
  data: {
    lesson: null,
    track: null,
    practice: null,
    done: false,
    nextLesson: null
  },

  onLoad(options) {
    const id = (options && options.id) || 'c1'
    const lesson = courses.getLesson(id) || courses.LESSONS[0]
    const track = courses.getTrack(lesson.trackId)
    const practice = lesson.practice ? questionData.getQuestion(lesson.practice.questionId) : null
    const doneMap = store.getCourseProgress()
    const trackLessons = courses.getLessons(lesson.trackId)
    const idx = trackLessons.findIndex(l => l.id === lesson.id)
    const nextLesson = trackLessons[idx + 1] || null

    this.setData({
      lesson,
      track,
      practice,
      done: !!doneMap[lesson.id],
      nextLesson
    })
    wx.setNavigationBarTitle({ title: track.name })
  },

  onShow() {
    if (this.data.lesson) {
      const doneMap = store.getCourseProgress()
      this.setData({ done: !!doneMap[this.data.lesson.id] })
    }
  },

  startPractice() {
    if (!this.data.practice) {
      this.markDone()
      return
    }
    wx.navigateTo({
      url: '/pages/session/session?source=course&qid=' + this.data.practice.id + '&lesson=' + this.data.lesson.id
    })
  },

  markDone() {
    store.markLessonDone(this.data.lesson.id)
    this.setData({ done: true })
    wx.showToast({ title: '已标记完成', icon: 'success' })
  },

  openNext() {
    if (!this.data.nextLesson) {
      util.goBack()
      return
    }
    wx.redirectTo({ url: '/pages/lesson/lesson?id=' + this.data.nextLesson.id })
  },

  onShareAppMessage() {
    return {
      title: this.data.lesson ? this.data.lesson.title : '清述课程',
      path: '/pages/lesson/lesson?id=' + (this.data.lesson ? this.data.lesson.id : 'c1')
    }
  }
})
