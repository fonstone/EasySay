/**
 * 清述本地数据层
 * -------------------------------------------------
 * 所有数据保存在 wx storage；音频文件保存在 USER_DATA_PATH。
 * 不依赖后端。storage 封装带内存兜底，方便 Node 测试。
 */

const util = require('./util')
const questionData = require('../data/questions')

const KEYS = {
  PROFILE: 'cs_profile',
  SETTINGS: 'cs_settings',
  STATS: 'cs_stats',
  PROGRESS: 'cs_progress',
  HISTORY: 'cs_history',
  REPORTS: 'cs_reports',
  ARCHIVE: 'cs_archive',
  QUOTES: 'cs_quotes',
  MEMBERSHIP: 'cs_membership',
  REVIEWS: 'cs_reviews',
  COACH: 'cs_coach',
  THINKING: 'cs_thinking',
  PRONOUNCE: 'cs_pronounce',
  TODAY: 'cs_today'
}

const MEMORY = {}
const hasWx = typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function'

function read(key, fallback) {
  let value
  if (hasWx) {
    try {
      value = wx.getStorageSync(key)
    } catch (e) {
      value = null
    }
  } else {
    value = MEMORY[key]
  }
  if (value === '' || value === null || value === undefined) {
    return clone(fallback)
  }
  return value
}

function write(key, value) {
  if (hasWx) {
    try {
      wx.setStorageSync(key, value)
      return true
    } catch (e) {
      console.warn('[store] setStorageSync failed', key, e)
      return false
    }
  }
  MEMORY[key] = value
  return true
}

function remove(key) {
  if (hasWx) {
    try {
      wx.removeStorageSync(key)
    } catch (e) {
      // ignore
    }
  } else {
    delete MEMORY[key]
  }
}

function clone(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function today() {
  return util.dateKey()
}

/* ==========================================================
   默认值
   ========================================================== */

function defaultProfile() {
  return {
    nickname: '练习者',
    avatarText: '',
    goalId: 'work',
    goalName: '职场汇报',
    level: '刚开始',
    dailyMinutes: 5,
    joinedAt: today(),
    onboarded: false
  }
}

function defaultSettings() {
  return {
    prepSeconds: 30,
    chances: 2,
    dailyGoal: 1,
    autoPlay: true,
    sound: true,
    haptic: true
  }
}

function defaultStats() {
  return {
    sessions: 0,
    seconds: 0,
    thinkingDone: 0,
    thinkingCorrect: 0,
    reviews: 0,
    streak: 0,
    bestStreak: 0,
    lastCheckIn: '',
    days: {}
  }
}

function defaultMembership() {
  return {
    type: 'free',
    expireAt: null,
    points: 0,
    trialUsed: false,
    dailyUsed: 0,
    dailyDate: today(),
    activatedAt: null
  }
}

function defaultProgress() {
  return {
    questions: {},
    lessons: {},
    categories: {}
  }
}

function init() {
  if (!read(KEYS.PROFILE, null)) write(KEYS.PROFILE, defaultProfile())
  if (!read(KEYS.SETTINGS, null)) write(KEYS.SETTINGS, defaultSettings())
  if (!read(KEYS.STATS, null)) write(KEYS.STATS, defaultStats())
  if (!read(KEYS.MEMBERSHIP, null)) write(KEYS.MEMBERSHIP, defaultMembership())
  if (!read(KEYS.PROGRESS, null)) write(KEYS.PROGRESS, defaultProgress())
  if (!read(KEYS.HISTORY, null)) write(KEYS.HISTORY, [])
  if (!read(KEYS.REPORTS, null)) write(KEYS.REPORTS, {})
  if (!read(KEYS.ARCHIVE, null)) write(KEYS.ARCHIVE, [])
  if (!read(KEYS.QUOTES, null)) write(KEYS.QUOTES, [])
  if (!read(KEYS.REVIEWS, null)) write(KEYS.REVIEWS, [])
  if (!read(KEYS.THINKING, null)) write(KEYS.THINKING, [])
  getMembership()
  getTodayState()
}

/* ==========================================================
   资料 / 设置
   ========================================================== */

function getProfile() {
  return Object.assign(defaultProfile(), read(KEYS.PROFILE, {}))
}

function saveProfile(patch) {
  const next = Object.assign(getProfile(), patch || {})
  write(KEYS.PROFILE, next)
  return next
}

function isOnboarded() {
  return !!getProfile().onboarded
}

function completeOnboarding(data) {
  const profile = saveProfile({
    nickname: (data && data.nickname) || '练习者',
    goalId: (data && data.goalId) || 'work',
    goalName: (data && data.goalName) || '职场汇报',
    level: (data && data.level) || '刚开始',
    dailyMinutes: (data && data.dailyMinutes) || 5,
    onboarded: true,
    joinedAt: today()
  })
  if (data && data.dailyMinutes) {
    saveSettings({ dailyGoal: data.dailyMinutes <= 5 ? 1 : 2 })
  }
  return profile
}

function getSettings() {
  return Object.assign(defaultSettings(), read(KEYS.SETTINGS, {}))
}

function saveSettings(patch) {
  const next = Object.assign(getSettings(), patch || {})
  next.prepSeconds = util.clamp(Number(next.prepSeconds) || 30, 0, 120)
  next.chances = util.clamp(Number(next.chances) || 2, 1, 5)
  next.dailyGoal = util.clamp(Number(next.dailyGoal) || 1, 1, 5)
  write(KEYS.SETTINGS, next)
  return next
}

/* ==========================================================
   统计 / 打卡
   ========================================================== */

function getStats() {
  const s = Object.assign(defaultStats(), read(KEYS.STATS, {}))
  if (!s.days || typeof s.days !== 'object') s.days = {}
  return s
}

function saveStats(stats) {
  write(KEYS.STATS, stats)
  return stats
}

function ensureDay(stats, date) {
  if (!stats.days[date]) {
    stats.days[date] = {
      sessions: 0,
      seconds: 0,
      checkedIn: false,
      thinking: 0,
      reading: 0,
      scoreSum: 0,
      scoreCount: 0
    }
  }
  const d = stats.days[date]
  if (typeof d.sessions !== 'number') d.sessions = 0
  if (typeof d.seconds !== 'number') d.seconds = 0
  if (typeof d.thinking !== 'number') d.thinking = 0
  if (typeof d.reading !== 'number') d.reading = 0
  if (typeof d.scoreSum !== 'number') d.scoreSum = 0
  if (typeof d.scoreCount !== 'number') d.scoreCount = 0
  return d
}

function getDay(date) {
  const stats = getStats()
  return ensureDay(stats, date || today())
}

function markCheckIn(date) {
  const key = date || today()
  const stats = getStats()
  const day = ensureDay(stats, key)
  if (day.checkedIn) {
    return { streak: displayStreak(stats), already: true }
  }
  day.checkedIn = true

  const last = stats.lastCheckIn
  if (last === util.addDays(key, -1)) {
    stats.streak = (stats.streak || 0) + 1
  } else if (last === key) {
    stats.streak = stats.streak || 1
  } else {
    stats.streak = 1
  }
  stats.lastCheckIn = key
  stats.bestStreak = Math.max(stats.bestStreak || 0, stats.streak || 1)
  saveStats(stats)
  return { streak: stats.streak, already: false }
}

function displayStreak(statsArg) {
  const stats = statsArg || getStats()
  if (!stats.lastCheckIn) return 0
  const gap = util.daysBetween(stats.lastCheckIn, today())
  if (gap <= 1 && gap >= 0) return stats.streak || 0
  return 0
}

function getStreak() {
  const stats = getStats()
  return {
    current: displayStreak(stats),
    best: stats.bestStreak || 0,
    lastCheckIn: stats.lastCheckIn || ''
  }
}

function getWeekStrip(days) {
  const count = days || 7
  const list = []
  for (let i = count - 1; i >= 0; i--) {
    const key = util.addDays(today(), -i)
    const d = getDay(key)
    list.push({
      key,
      label: util.cnWeek(key).replace('周', ''),
      day: Number(key.slice(-2)),
      checkedIn: !!d.checkedIn,
      sessions: d.sessions || 0,
      isToday: i === 0
    })
  }
  return list
}

function getHeatmap(weeks) {
  const totalWeeks = weeks || 8
  const end = util.parseDateKey(today())
  const endDay = end.getDay() === 0 ? 7 : end.getDay()
  const start = new Date(end)
  start.setDate(end.getDate() - (totalWeeks - 1) * 7 - (endDay - 1))
  const columns = []
  for (let w = 0; w < totalWeeks; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      const key = util.dateKey(date)
      const day = getDay(key)
      const isFuture = util.daysBetween(today(), key) > 0
      let level = 0
      if (!isFuture && day.checkedIn) level = Math.min(4, 1 + Math.floor((day.sessions || 0) / 2))
      col.push({
        key,
        label: String(date.getDate()),
        level,
        isToday: key === today(),
        isFuture
      })
    }
    columns.push(col)
  }
  return columns
}

function getTodayTasks() {
  const day = getDay(today())
  const state = getTodayState()
  const thinkingToday = getThinkingLog().filter(x => x.date === today()).length
  return [
    { key: 'checkin', title: '完成一次练习', desc: '开口 1 次，完成打卡', done: !!state.done || day.sessions > 0, icon: '练' },
    { key: 'thinking', title: '做一道思维题', desc: '练脑子，也练判断', done: thinkingToday > 0, icon: '思' },
    { key: 'read', title: '朗读一段文字', desc: '让声音有形状', done: (day.reading || 0) > 0, icon: '读' }
  ]
}

/* ==========================================================
   今日挑战
   ========================================================== */

function getTodayState() {
  const key = today()
  let state = read(KEYS.TODAY, null)
  if (!state || state.date !== key) {
    state = {
      date: key,
      questionId: '',
      attempts: 0,
      done: false,
      reportId: ''
    }
  }
  if (!state.questionId) {
    const q = questionData.getDailyQuestion(key)
    state.questionId = q ? q.id : ''
  }
  write(KEYS.TODAY, state)
  return state
}

function saveTodayState(patch) {
  const state = Object.assign(getTodayState(), patch || {})
  write(KEYS.TODAY, state)
  return state
}

function useTodayAttempt() {
  const state = getTodayState()
  const chances = getSettings().chances
  if (state.done) {
    return { ok: true, left: 0, free: true }
  }
  if (state.attempts >= chances) {
    return { ok: false, left: 0, chances }
  }
  state.attempts += 1
  write(KEYS.TODAY, state)
  return { ok: true, left: Math.max(0, chances - state.attempts), chances }
}

function markTodayDone(reportId) {
  const state = getTodayState()
  state.done = true
  state.reportId = reportId || state.reportId || ''
  write(KEYS.TODAY, state)
  return state
}

/* ==========================================================
   练习记录 / 报告
   ========================================================== */

function addHistory(record) {
  const list = read(KEYS.HISTORY, [])
  list.unshift(record)
  write(KEYS.HISTORY, list.slice(0, 150))
}

function getHistory(limit) {
  const list = read(KEYS.HISTORY, [])
  return limit ? list.slice(0, limit) : list
}

function saveReport(report) {
  if (!report || !report.id) return null
  const reports = read(KEYS.REPORTS, {})
  reports[report.id] = report
  const entries = Object.keys(reports)
    .map(id => ({ id, at: reports[id].createdAt || 0 }))
    .sort((a, b) => b.at - a.at)
  entries.slice(40).forEach(e => { delete reports[e.id] })
  write(KEYS.REPORTS, reports)
  return report
}

function getReport(id) {
  const reports = read(KEYS.REPORTS, {})
  return reports[id] || null
}

function updateReport(report) {
  if (!report || !report.id) return null
  const previous = getReport(report.id)
  saveReport(report)
  if (previous && typeof previous.overall === 'number' && previous.overall !== report.overall) {
    const stats = getStats()
    const day = ensureDay(stats, report.date || today())
    if (day.scoreCount > 0) {
      day.scoreSum += (report.overall || 0) - previous.overall
      saveStats(stats)
    }
  }
  const history = read(KEYS.HISTORY, [])
  const item = history.find(x => x.reportId === report.id || x.id === report.id)
  if (item) {
    item.overall = report.overall
    item.gradeLabel = report.grade ? report.grade.label : ''
    item.hasTranscript = !!report.transcript
    item.title = report.question ? report.question.title : item.title
    write(KEYS.HISTORY, history)
  }
  const archive = read(KEYS.ARCHIVE, [])
  const audio = archive.find(x => x.reportId === report.id)
  if (audio) {
    audio.score = report.overall
    write(KEYS.ARCHIVE, archive)
  }
  return report
}

function isQuoteSaved(text) {
  if (!text) return false
  return read(KEYS.QUOTES, []).some(q => q.text === text)
}

function getRecentReports(limit) {
  const reports = read(KEYS.REPORTS, {})
  return Object.keys(reports)
    .map(id => reports[id])
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit || 20)
}

/** 记录一次完成的练习（报告生成后调用） */
function recordSession(report, source) {
  if (!report) return null
  const date = report.date || today()
  const stats = getStats()
  const day = ensureDay(stats, date)
  const duration = (report.audio && report.audio.duration) || 0

  stats.sessions = (stats.sessions || 0) + 1
  stats.seconds = (stats.seconds || 0) + duration
  day.sessions += 1
  day.seconds += duration
  day.scoreSum += report.overall || 0
  day.scoreCount += 1

  if ((report.question.categoryId === 'read') || (report.question.categoryId === 'pronounce')) {
    day.reading += 1
  }

  saveStats(stats)
  markCheckIn(date)

  addHistory({
    id: report.id,
    date,
    createdAt: report.createdAt,
    questionId: report.question.id,
    title: report.question.title,
    categoryId: report.question.categoryId,
    categoryName: report.question.categoryName,
    source: source || report.source || 'practice',
    overall: report.overall,
    gradeLabel: report.grade ? report.grade.label : '',
    duration: report.audio ? report.audio.duration : 0,
    hasTranscript: !!report.transcript,
    reportId: report.id
  })

  return report
}

/** 记录一次问题完成，用于闯关解锁 */
function markQuestionDone(questionId, score) {
  const progress = read(KEYS.PROGRESS, defaultProgress())
  if (!progress.questions) progress.questions = {}
  const prev = progress.questions[questionId] || { attempts: 0, best: 0, firstAt: Date.now() }
  progress.questions[questionId] = {
    attempts: (prev.attempts || 0) + 1,
    best: Math.max(prev.best || 0, score || 0),
    lastAt: Date.now(),
    firstAt: prev.firstAt || Date.now()
  }
  const q = questionData.getQuestion(questionId)
  if (q) {
    if (!progress.categories) progress.categories = {}
    if (!progress.categories[q.categoryId]) progress.categories[q.categoryId] = { sessions: 0 }
    progress.categories[q.categoryId].sessions += 1
  }
  write(KEYS.PROGRESS, progress)
  return progress.questions[questionId]
}

function getProgress() {
  const p = read(KEYS.PROGRESS, defaultProgress())
  if (!p.questions) p.questions = {}
  if (!p.lessons) p.lessons = {}
  if (!p.categories) p.categories = {}
  return p
}

function getCategoryProgress(categoryId) {
  const questions = questionData.getQuestions(categoryId)
  const progress = getProgress()
  const levels = questionData.getLevels(categoryId).map((lv, index) => {
    const items = lv.questions.map(q => {
      const p = progress.questions[q.id]
      return Object.assign({}, q, {
        done: !!p,
        attempts: p ? p.attempts : 0,
        best: p ? p.best : 0
      })
    })
    const done = items.filter(q => q.done).length
    const unlocked = index === 0 || levels_unlocked(questionData.getLevels(categoryId), index, progress)
    return {
      n: lv.n,
      name: lv.name,
      en: lv.en,
      desc: lv.desc,
      unlocked,
      done,
      total: items.length,
      questions: items
    }
  })
  const done = levels.reduce((s, l) => s + l.done, 0)
  return {
    total: questions.length,
    done,
    percent: questions.length ? Math.round(done / questions.length * 100) : 0,
    levels
  }
}

function levels_unlocked(allLevels, index, progress) {
  if (index === 0) return true
  const prev = allLevels[index - 1]
  const prevDone = prev.questions.filter(q => progress.questions[q.id]).length
  return prevDone >= 1
}

function getCourseProgress() {
  return getProgress().lessons
}

function markLessonDone(lessonId) {
  const progress = getProgress()
  progress.lessons[lessonId] = Date.now()
  write(KEYS.PROGRESS, progress)
  return progress.lessons
}

/* ==========================================================
   录音档案
   ========================================================== */

function getArchive() {
  return read(KEYS.ARCHIVE, [])
}

function addArchive(item) {
  const list = read(KEYS.ARCHIVE, [])
  list.unshift(item)
  const removed = list.splice(15)
  removed.forEach(r => removeAudioFile(r.path))
  write(KEYS.ARCHIVE, list)
  return list
}

function removeArchive(id) {
  const list = read(KEYS.ARCHIVE, [])
  const target = list.find(x => x.id === id)
  if (target) removeAudioFile(target.path)
  const next = list.filter(x => x.id !== id)
  write(KEYS.ARCHIVE, next)
  return next
}

function removeAudioFile(path) {
  if (!path || !hasWx) return
  try {
    wx.getFileSystemManager().unlink({
      filePath: path,
      fail() {}
    })
  } catch (e) {
    // ignore
  }
}

/* ==========================================================
   金句墙
   ========================================================== */

function getQuotes() {
  return read(KEYS.QUOTES, [])
}

function addQuote(item) {
  const list = read(KEYS.QUOTES, [])
  if (!item || !item.text) return list
  const text = String(item.text).trim()
  if (!text) return list
  if (list.some(q => q.text === text)) return list
  list.unshift({
    id: util.uid('q'),
    text,
    source: item.source || '',
    questionId: item.questionId || '',
    date: item.date || today(),
    score: item.score || 0,
    createdAt: Date.now()
  })
  write(KEYS.QUOTES, list.slice(0, 60))
  return getQuotes()
}

function removeQuote(id) {
  const list = read(KEYS.QUOTES, []).filter(q => q.id !== id)
  write(KEYS.QUOTES, list)
  return list
}

/* ==========================================================
   会员 / 点评额度
   ========================================================== */

const FREE_DAILY_REVIEWS = 5

function getMembership() {
  let m = Object.assign(defaultMembership(), read(KEYS.MEMBERSHIP, {}))
  const key = today()
  let changed = false
  if (m.dailyDate !== key) {
    m.dailyDate = key
    m.dailyUsed = 0
    changed = true
  }
  if (m.type !== 'free' && m.type !== 'lifetime' && m.expireAt && m.expireAt < Date.now()) {
    m.type = 'free'
    m.expireAt = null
    changed = true
  }
  if (changed) write(KEYS.MEMBERSHIP, m)
  return m
}

function saveMembership(patch) {
  const next = Object.assign(getMembership(), patch || {})
  write(KEYS.MEMBERSHIP, next)
  return next
}

function isMember() {
  const m = getMembership()
  if (m.type === 'lifetime') return true
  if (m.type !== 'free' && m.expireAt && m.expireAt > Date.now()) return true
  return false
}

function getReviewQuota() {
  const m = getMembership()
  const member = isMember()
  const freeLeft = Math.max(0, FREE_DAILY_REVIEWS - (m.dailyUsed || 0))
  return {
    member,
    type: m.type,
    freeLeft,
    freeTotal: FREE_DAILY_REVIEWS,
    points: m.points || 0,
    canReview: member || freeLeft > 0 || (m.points || 0) > 0
  }
}

/** 生成报告时消耗一次额度。会员不消耗。 */
function consumeReview() {
  const m = getMembership()
  if (isMember()) {
    return { ok: true, source: 'member', freeLeft: FREE_DAILY_REVIEWS, points: m.points || 0 }
  }
  if ((m.dailyUsed || 0) < FREE_DAILY_REVIEWS) {
    m.dailyUsed = (m.dailyUsed || 0) + 1
    write(KEYS.MEMBERSHIP, m)
    return { ok: true, source: 'free', freeLeft: FREE_DAILY_REVIEWS - m.dailyUsed, points: m.points || 0 }
  }
  if ((m.points || 0) > 0) {
    m.points -= 1
    write(KEYS.MEMBERSHIP, m)
    return { ok: true, source: 'points', freeLeft: 0, points: m.points }
  }
  return { ok: false, source: 'none', freeLeft: 0, points: 0 }
}

function addPoints(n) {
  const m = getMembership()
  m.points = Math.max(0, (m.points || 0) + (Number(n) || 0))
  write(KEYS.MEMBERSHIP, m)
  return m.points
}

function activateTrial() {
  const m = getMembership()
  if (m.trialUsed) return { ok: false, reason: 'used', membership: m }
  m.type = 'trial'
  m.trialUsed = true
  m.activatedAt = Date.now()
  m.expireAt = Date.now() + 7 * 86400000
  m.points = (m.points || 0) + 3
  write(KEYS.MEMBERSHIP, m)
  return { ok: true, membership: m }
}

const PLANS = {
  year: { id: 'year', name: '年卡', price: 38, days: 365, tag: '最常见' },
  twoyear: { id: 'twoyear', name: '两年卡', price: 48, days: 730, tag: '每天 7 分钱' },
  lifetime: { id: 'lifetime', name: '永久卡', price: 97, days: 0, tag: '一次买断' }
}

function activatePlan(planId) {
  const plan = PLANS[planId]
  if (!plan) return { ok: false }
  const m = getMembership()
  m.type = planId
  m.activatedAt = Date.now()
  m.expireAt = planId === 'lifetime' ? null : Date.now() + plan.days * 86400000
  write(KEYS.MEMBERSHIP, m)
  return { ok: true, membership: m }
}

/* ==========================================================
   复盘
   ========================================================== */

function getReviews() {
  return read(KEYS.REVIEWS, [])
}

function addReview(entry) {
  const list = read(KEYS.REVIEWS, [])
  const item = Object.assign({
    id: util.uid('rv'),
    date: today(),
    createdAt: Date.now()
  }, entry || {})
  list.unshift(item)
  write(KEYS.REVIEWS, list.slice(0, 60))
  const stats = getStats()
  stats.reviews = (stats.reviews || 0) + 1
  saveStats(stats)
  return item
}

function removeReview(id) {
  const list = read(KEYS.REVIEWS, []).filter(x => x.id !== id)
  write(KEYS.REVIEWS, list)
  return list
}

/* ==========================================================
   思维题
   ========================================================== */

function getThinkingLog() {
  return read(KEYS.THINKING, [])
}

function recordThinking(questionId, correct, type) {
  const list = read(KEYS.THINKING, [])
  list.unshift({
    id: questionId,
    type: type || '',
    correct: !!correct,
    date: today(),
    createdAt: Date.now()
  })
  write(KEYS.THINKING, list.slice(0, 300))

  const stats = getStats()
  stats.thinkingDone = (stats.thinkingDone || 0) + 1
  if (correct) stats.thinkingCorrect = (stats.thinkingCorrect || 0) + 1
  saveStats(stats)

  const day = ensureDay(stats, today())
  day.thinking = (day.thinking || 0) + 1
  saveStats(stats)
  return list[0]
}

function getThinkingStats() {
  const log = getThinkingLog()
  const uniqueDone = new Set(log.map(x => x.id)).size
  const correct = log.filter(x => x.correct).length
  return {
    attempts: log.length,
    uniqueDone,
    correct,
    accuracy: log.length ? Math.round(correct / log.length * 100) : 0,
    todayCount: log.filter(x => x.date === today()).length
  }
}

/* ==========================================================
   私教计划 / 纠音
   ========================================================== */

function getCoachPlan() {
  return read(KEYS.COACH, null)
}

function saveCoachPlan(plan) {
  write(KEYS.COACH, plan)
  return plan
}

function getPronounceDone() {
  return read(KEYS.PRONOUNCE, [])
}

function markPronounceDone(id) {
  const list = read(KEYS.PRONOUNCE, [])
  if (id && list.indexOf(id) === -1) {
    list.push(id)
    write(KEYS.PRONOUNCE, list)
  }
  return list
}

/* ==========================================================
   聚合查询
   ========================================================== */

function getOverview() {
  const stats = getStats()
  const day = getDay(today())
  const streak = getStreak()
  const quota = getReviewQuota()
  const reports = getRecentReports(20)
  const dims = require('./scoring').aggregateDimensions(reports)
  return {
    stats,
    today: day,
    streak,
    quota,
    dimensions: dims,
    todayState: getTodayState(),
    profile: getProfile()
  }
}

/* ==========================================================
   清空
   ========================================================== */

const RESET_KEYS = [
  KEYS.STATS, KEYS.PROGRESS, KEYS.HISTORY, KEYS.REPORTS, KEYS.ARCHIVE,
  KEYS.QUOTES, KEYS.REVIEWS, KEYS.COACH, KEYS.THINKING, KEYS.PRONOUNCE, KEYS.TODAY
]

function clearPractice() {
  const archive = getArchive()
  archive.forEach(a => removeAudioFile(a.path))
  RESET_KEYS.forEach(k => remove(k))
  write(KEYS.PROFILE, Object.assign(getProfile(), { joinedAt: today() }))
}

function resetAll() {
  const archive = getArchive()
  archive.forEach(a => removeAudioFile(a.path))
  Object.keys(KEYS).forEach(k => remove(KEYS[k]))
  init()
}

module.exports = {
  KEYS,
  PLANS,
  FREE_DAILY_REVIEWS,
  init,
  getProfile,
  saveProfile,
  isOnboarded,
  completeOnboarding,
  getSettings,
  saveSettings,
  getStats,
  saveStats,
  getDay,
  markCheckIn,
  getStreak,
  getWeekStrip,
  getHeatmap,
  getTodayTasks,
  getTodayState,
  saveTodayState,
  useTodayAttempt,
  markTodayDone,
  addHistory,
  getHistory,
  saveReport,
  getReport,
  updateReport,
  isQuoteSaved,
  getRecentReports,
  recordSession,
  markQuestionDone,
  getProgress,
  getCategoryProgress,
  getCourseProgress,
  markLessonDone,
  getArchive,
  addArchive,
  removeArchive,
  getQuotes,
  addQuote,
  removeQuote,
  getMembership,
  saveMembership,
  isMember,
  getReviewQuota,
  consumeReview,
  addPoints,
  activateTrial,
  activatePlan,
  getReviews,
  addReview,
  removeReview,
  getThinkingLog,
  recordThinking,
  getThinkingStats,
  getCoachPlan,
  saveCoachPlan,
  getPronounceDone,
  markPronounceDone,
  getOverview,
  clearPractice,
  resetAll
}
