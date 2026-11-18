const store = require('../../utils/store')
const util = require('../../utils/util')
const thinking = require('../../data/thinking')

Page({
  data: {
    question: null,
    type: '',
    options: [],
    selected: -1,
    answered: false,
    isCorrect: false,
    nextId: '',
    progressText: '',
    typeAccuracy: 0,
    streakText: ''
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    const type = (options && options.type) || ''
    this.render(id, type)
  },

  render(id, type) {
    const question = thinking.getQuestion(id) || thinking.QUESTIONS[0]
    const filterType = type || question.type
    const list = thinking.QUESTIONS.filter(q => q.type === filterType)
    const index = list.findIndex(q => q.id === question.id)
    const next = list[index + 1] || list[0]
    const log = store.getThinkingLog().filter(x => x.type === filterType)
    const correct = log.filter(x => x.correct).length

    this.setData({
      question,
      type: filterType,
      options: question.options.map((text, i) => ({ text, key: ['A', 'B', 'C', 'D'][i], state: '' })),
      selected: -1,
      answered: false,
      isCorrect: false,
      nextId: next ? next.id : '',
      progressText: index >= 0 ? '第 ' + (index + 1) + ' / ' + list.length + ' 题' : '',
      typeAccuracy: log.length ? Math.round(correct / log.length * 100) : 0
    })
    wx.setNavigationBarTitle({ title: question.typeShort || '思维题' })
  },

  choose(e) {
    if (this.data.answered) return
    const index = Number(e.currentTarget.dataset.index)
    const question = this.data.question
    const isCorrect = index === question.answer
    const options = this.data.options.map((opt, i) => {
      let state = 'dim'
      if (i === question.answer) state = 'correct'
      if (i === index && !isCorrect) state = 'wrong'
      return Object.assign({}, opt, { state })
    })

    store.recordThinking(question.id, isCorrect, question.type)
    const attempts = store.getThinkingLog().filter(x => x.type === question.type)
    const correct = attempts.filter(x => x.correct).length

    this.setData({
      selected: index,
      answered: true,
      isCorrect,
      options,
      typeAccuracy: attempts.length ? Math.round(correct / attempts.length * 100) : 0
    })
  },

  next() {
    if (!this.data.nextId) {
      util.goBack()
      return
    }
    wx.redirectTo({
      url: '/pages/thinking-quiz/thinking-quiz?id=' + this.data.nextId + '&type=' + this.data.type
    })
  },

  back() {
    util.goBack()
  },

  goBack() {
    util.goBack()
  },

  onShareAppMessage() {
    return {
      title: this.data.question ? this.data.question.stem : '一道思维小题',
      path: '/pages/thinking/thinking'
    }
  }
})
