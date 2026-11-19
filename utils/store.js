/**
 * 清述本地数据层
 * -------------------------------------------------
 * 所有数据保存在 wx storage；音频文件保存在 USER_DATA_PATH。
 * 不依赖后端。storage 封装带内存兜底，方便 Node 测试。
 */

const util = require('./util')
const backup = require('./backup')
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
  TODAY: 'cs_today',
  SCHEMA: 'cs_schema',
  FAVORITES: 'cs_favorites',
  RECENT_QUESTIONS: 'cs_recent_questions',
  SEARCH_HISTORY: 'cs_search_history',
  BACKUP: 'cs_backup_meta'
}

/**
 * 报告、练习记录、录音档案必须共用同一批 id。
 * 早期版本 HISTORY 保留 150 条 / REPORTS 保留 40 份，第 41 次练习开始
 * 就会出现点不开的悬空记录；这里统一为同一上限。
 */
const MAX_REPORTS = 40
/** 音频文件体积大，单独设更小的上限，淘汰时同步清理报告里的引用 */
const MAX_AUDIO_FILES = 15
const SCHEMA_VERSION = 4
const MAX_FAVORITES = 60
const MAX_RECENT_QUESTIONS = 12
const MAX_SEARCH_HISTORY = 10

const MEMORY = {}
const hasWx = typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function'
const health = { lastWriteError: null, writeFailures: 0 }

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
      health.lastWriteError = {
        key,
        at: Date.now(),
        message: String((e && (e.errMsg || e.message)) || e || 'unknown')
      }
      health.writeFailures++
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

function defaultBackupMeta() {
  return {
    lastBackupAt: 0,
    count: 0,
    channel: '',
    reportsAtBackup: 0
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
  if (KEYS.THINKING && !read(KEYS.THINKING, null)) write(KEYS.THINKING, [])
  if (!Array.isArray(read(KEYS.FAVORITES, null))) write(KEYS.FAVORITES, [])
  if (!Array.isArray(read(KEYS.RECENT_QUESTIONS, null))) write(KEYS.RECENT_QUESTIONS, [])
  if (!Array.isArray(read(KEYS.SEARCH_HISTORY, null))) write(KEYS.SEARCH_HISTORY, [])
  if (!read(KEYS.BACKUP, null)) write(KEYS.BACKUP, defaultBackupMeta())
  migrate()
  repairData()
  getMembership()
  getTodayState()
}

/**
 * 数据结构升级。所有迁移必须幂等，且能处理旧版本缺失字段。
 * v1 -> v2：补报告锁稿字段、补历史/档案的 reportId 外键、补音频有效性标记。
 * v2 -> v3：新增题目收藏、最近练习、搜索历史三个键，并清洗失效题目 id。
 * v3 -> v4：新增备份元数据；旧版固定题单标记为 legacy，交给 utils/plan 归一化。
 */
function migrate() {
  const current = Number(read(KEYS.SCHEMA, 0)) || 0
  if (current >= SCHEMA_VERSION) return { from: current, to: current, migrated: false }

  const reports = read(KEYS.REPORTS, {})
  if (reports && typeof reports === 'object') {
    Object.keys(reports).forEach(id => {
      const r = reports[id]
      if (!r || typeof r !== 'object') {
        delete reports[id]
        return
      }
      if (!r.createdAt) r.createdAt = Date.now()
      if (!r.version) r.version = '1.0'
      // 老报告已有文字稿的，视为已锁定，避免升级后继续被反复重算
      if (typeof r.transcriptLocked !== 'boolean') {
        r.transcriptLocked = !!(r.transcript && r.text)
      }
      if (typeof r.transcriptSubmittedAt !== 'number') {
        r.transcriptSubmittedAt = r.transcriptLocked ? r.createdAt : 0
      }
      if (typeof r.hasAudioFile !== 'boolean') r.hasAudioFile = !!r.audioPath
    })
    write(KEYS.REPORTS, reports)
  }

  const history = read(KEYS.HISTORY, [])
  if (Array.isArray(history)) {
    history.forEach(h => { if (h && !h.reportId) h.reportId = h.id || '' })
    write(KEYS.HISTORY, history)
  }
  const archive = read(KEYS.ARCHIVE, [])
  if (Array.isArray(archive)) {
    archive.forEach(a => { if (a && !a.reportId) a.reportId = a.id || '' })
    write(KEYS.ARCHIVE, archive)
  }

  // v3：新键缺失时补默认值；顺带清掉已不存在的题目 id，避免收藏页出现空卡
  const normalizeIds = (key, max) => {
    const raw = read(key, [])
    const seen = {}
    const list = (Array.isArray(raw) ? raw : [])
      .map(x => (typeof x === 'string' ? { id: x } : x))
      .filter(x => {
        if (!x || !x.id || !questionData.getQuestion(x.id) || seen[x.id]) return false
        seen[x.id] = true
        return true
      })
      .slice(0, max)
    if (list.length !== (Array.isArray(raw) ? raw.length : 0)) write(key, list)
    return list
  }
  normalizeIds(KEYS.FAVORITES, MAX_FAVORITES)
  normalizeIds(KEYS.RECENT_QUESTIONS, MAX_RECENT_QUESTIONS)
  const historyWords = read(KEYS.SEARCH_HISTORY, [])
  if (!Array.isArray(historyWords)) write(KEYS.SEARCH_HISTORY, [])

  // v4：备份元数据与旧计划的兼容标记
  if (!read(KEYS.BACKUP, null)) write(KEYS.BACKUP, defaultBackupMeta())
  const oldPlan = read(KEYS.COACH, null)
  if (oldPlan && oldPlan.goalId && !Array.isArray(oldPlan.days)) {
    oldPlan.engine = 'legacy-fixed-v0'
    write(KEYS.COACH, oldPlan)
  }

  write(KEYS.SCHEMA, SCHEMA_VERSION)
  return { from: current, to: SCHEMA_VERSION, migrated: true }
}

/**
 * 启动时做一次一致性修复：三处存储以 REPORTS 的 id 集合为准。
 * 解决「历史点开是空白报告」「报告回听指向已被删除的 wav」两类历史遗留问题。
 */
function repairData() {
  const reports = read(KEYS.REPORTS, {})
  const all = reports && typeof reports === 'object' ? reports : {}
  const entries = Object.keys(all)
    .map(id => ({ id, at: (all[id] && all[id].createdAt) || 0 }))
    .sort((a, b) => b.at - a.at)
  const removed = entries.slice(MAX_REPORTS).map(e => e.id)
  removed.forEach(id => { delete all[id] })

  const keepSet = {}
  Object.keys(all).forEach(id => { keepSet[id] = true })

  // 悬空历史：报告已不在的记录不再展示
  const rawHistory = read(KEYS.HISTORY, [])
  const seenHistory = {}
  const history = (Array.isArray(rawHistory) ? rawHistory : []).filter(h => {
    const id = (h && (h.reportId || h.id)) || ''
    if (!id || !keepSet[id] || seenHistory[id]) return false
    seenHistory[id] = true
    return true
  }).slice(0, MAX_REPORTS)
  if (!Array.isArray(rawHistory) || history.length !== rawHistory.length) {
    write(KEYS.HISTORY, history)
  }

  // 录音档案：去重、删除孤儿、淘汰超出上限的文件
  const rawArchive = read(KEYS.ARCHIVE, [])
  const seenAudio = {}
  const archive = (Array.isArray(rawArchive) ? rawArchive : []).filter(a => {
    const id = (a && a.reportId) || ''
    if (!id || !keepSet[id] || seenAudio[id]) return false
    seenAudio[id] = true
    return true
  })
  const kept = new Set(archive.slice(0, MAX_AUDIO_FILES))
  archive.forEach(a => { if (!kept.has(a)) removeAudioFile(a.path) })
  if (!Array.isArray(rawArchive) || kept.size !== rawArchive.length) {
    write(KEYS.ARCHIVE, Array.from(kept))
  }

  // 报告的 audioPath 必须仍指向一份存在的档案，否则回听必然报错
  const livePaths = {}
  Array.from(kept).forEach(a => { livePaths[a.reportId] = a.path || '' })
  let changed = removed.length > 0
  Object.keys(all).forEach(id => {
    const r = all[id]
    if (!r || !r.audioPath) return
    if (livePaths[id] !== r.audioPath) {
      r.audioPath = ''
      r.hasAudioFile = false
      r.audioExpired = true
      changed = true
    }
  })
  if (changed) write(KEYS.REPORTS, all)

  if (removed.length) pruneOrphans(removed)
  return {
    reports: Object.keys(all).length,
    history: history.length,
    audio: kept.size,
    removedReports: removed.length
  }
}

/** 报告被淘汰时，同步清掉历史记录与录音文件，避免悬空引用 */
function pruneOrphans(removedIds) {
  const gone = {}
  ;(removedIds || []).forEach(id => { gone[id] = true })
  const history = read(KEYS.HISTORY, [])
  if (Array.isArray(history)) {
    write(KEYS.HISTORY, history.filter(x => !gone[(x && (x.reportId || x.id)) || '']))
  }
  const archive = read(KEYS.ARCHIVE, [])
  if (Array.isArray(archive)) {
    const dropped = archive.filter(x => gone[(x && x.reportId) || ''])
    dropped.forEach(x => removeAudioFile(x.path))
    if (dropped.length) {
      write(KEYS.ARCHIVE, archive.filter(x => !gone[(x && x.reportId) || '']))
    }
  }
}

/** 存储写入失败不再静默：页面可据此提示用户先清理空间 */
function getStorageHealth() {
  let info = null
  if (hasWx) {
    try { info = wx.getStorageInfoSync() } catch (e) { /* ignore */ }
  }
  return {
    lastWriteError: health.lastWriteError,
    writeFailures: health.writeFailures,
    currentSize: info ? info.currentSize : null,
    limitSize: info ? info.limitSize : null,
    schema: Number(read(KEYS.SCHEMA, 0)) || 0,
    schemaVersion: SCHEMA_VERSION
  }
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

/** 只读预检，用于「开始录音」前判断，不消耗次数 */
function canUseTodayAttempt() {
  const state = getTodayState()
  if (state.done) return { ok: true, left: -1, chances: getSettings().chances, free: true }
  const chances = getSettings().chances
  const left = Math.max(0, chances - (state.attempts || 0))
  return { ok: left > 0, left, chances, free: false }
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

/** 录音失败 / 中途退出时归还次数：没有生成点评就不该扣用户的机会 */
function refundTodayAttempt() {
  const state = getTodayState()
  if (state.done) return state
  state.attempts = Math.max(0, (state.attempts || 0) - 1)
  write(KEYS.TODAY, state)
  return state
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
  const raw = read(KEYS.HISTORY, [])
  const list = Array.isArray(raw) ? raw : []
  const id = (record && (record.reportId || record.id)) || ''
  // 同一份报告只保留一条记录，避免重复练习记录把列表挤掉
  const next = [record].concat(list.filter(x => ((x && (x.reportId || x.id)) || '') !== id))
  write(KEYS.HISTORY, next.slice(0, MAX_REPORTS))
}

function getHistory(limit) {
  const reports = read(KEYS.REPORTS, {})
  const raw = read(KEYS.HISTORY, [])
  // 防御性过滤：即使迁移尚未运行，也不把悬空记录交给页面渲染
  const list = (Array.isArray(raw) ? raw : []).filter(x => {
    const id = (x && (x.reportId || x.id)) || ''
    return !!id && !!(reports && reports[id])
  })
  return limit ? list.slice(0, limit) : list
}

function saveReport(report) {
  if (!report || !report.id) return null
  const reports = read(KEYS.REPORTS, {})
  reports[report.id] = report
  const entries = Object.keys(reports)
    .map(id => ({ id, at: (reports[id] && reports[id].createdAt) || 0 }))
    .sort((a, b) => b.at - a.at)
  const removed = entries.slice(MAX_REPORTS).map(e => e.id)
  removed.forEach(id => { delete reports[id] })
  write(KEYS.REPORTS, reports)
  if (removed.length) pruneOrphans(removed)
  return report
}

function getReport(id) {
  const reports = read(KEYS.REPORTS, {})
  return reports[id] || null
}

function updateReport(report) {
  if (!report || !report.id) return null
  const previous = getReport(report.id)
  // 文字稿提交后锁死：阻止反复改写内容维度把总分刷高。
  // 这是数据层的最后一道防线，页面层的拦截可被绕过。
  if (previous && previous.transcriptLocked &&
      (report.transcript || '') !== (previous.transcript || '')) {
    console.warn('[store] transcript already locked', report.id)
    return previous
  }
  saveReport(report)
  if (previous && typeof previous.overall === 'number' &&
      typeof report.overall === 'number' && previous.overall !== report.overall) {
    const stats = getStats()
    const day = ensureDay(stats, report.date || today())
    if (day.scoreCount > 0) {
      day.scoreSum = Math.max(0, (day.scoreSum || 0) + report.overall - previous.overall)
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

/** 音频被删除后，报告里的 audioPath 必须一并失效，否则回听会指向不存在的文件 */
function clearAudioReference(reportId, path) {
  if (!reportId) return
  const reports = read(KEYS.REPORTS, {})
  const r = reports[reportId]
  if (!r || !r.audioPath) return
  if (path && r.audioPath !== path) return
  r.audioPath = ''
  r.hasAudioFile = false
  r.audioExpired = true
  write(KEYS.REPORTS, reports)
}

function addArchive(item) {
  const raw = read(KEYS.ARCHIVE, [])
  const list = Array.isArray(raw) ? raw : []
  const next = [item].concat(list.filter(x => !x || x.reportId !== item.reportId))
  const removed = next.splice(MAX_AUDIO_FILES)
  removed.forEach(r => {
    removeAudioFile(r.path)
    clearAudioReference(r.reportId, r.path)
  })
  write(KEYS.ARCHIVE, next)
  return next
}

function removeArchive(id) {
  const list = read(KEYS.ARCHIVE, [])
  const target = (list || []).find(x => x.id === id)
  if (target) {
    removeAudioFile(target.path)
    clearAudioReference(target.reportId, target.path)
  }
  const next = (list || []).filter(x => x.id !== id)
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

/**
 * 统一额度视图。
 * 「今日挑战机会」是同一道题的重录次数，「点评次数」是当天能生成几份完整点评，
 * 过去两套数字在首屏并列出现容易互相打架，这里给页面一个一致的口径。
 */
function getDailyQuota() {
  const review = getReviewQuota()
  const attempt = canUseTodayAttempt()
  return {
    member: review.member,
    type: review.type,
    points: review.points,
    reviewTotal: review.freeTotal,
    reviewLeft: review.freeLeft,
    // 兼容既有页面里 quota.freeLeft 的写法
    freeLeft: review.freeLeft,
    freeTotal: review.freeTotal,
    reviewLabel: review.member ? '会员 · 点评不限次' : ('今日可生成 ' + review.freeLeft + ' 份完整点评'),
    chances: attempt.chances,
    chancesLeft: attempt.left,
    chancesLabel: attempt.free ? '今日已完成，可自由加练' : ('这道题还可重录 ' + attempt.left + ' 次'),
    canPractice: attempt.ok && review.canReview,
    canReview: review.canReview,
    summary: review.member
      ? '会员 · 不限次练习'
      : ('今日点评 ' + review.freeLeft + '/' + review.freeTotal + ' · 本题可重录 ' + (attempt.left < 0 ? '不限' : attempt.left) + ' 次')
  }
}

/**
 * 权益单一真源。
 * 本版本没有任何支付、订单或服务端校验，会员状态只是本地演示开关。
 * 页面所有「是否会员 / 还有几次」都必须从这里取，避免又出现两套口径，
 * 也避免把本地开关包装成真实交易。
 */
function getEntitlement() {
  const quota = getDailyQuota()
  return Object.assign({}, quota, {
    source: 'local-demo',
    isRealPayment: false,
    demoNotice: '纯本地演示：不会发起微信支付，不产生订单，也不扣款。',
    memberSource: quota.member ? '本地演示开关' : '未开启'
  })
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
  m.source = 'local-demo'
  m.isRealPayment = false
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
  m.source = 'local-demo'
  m.isRealPayment = false
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
   找题：收藏 / 最近练习 / 搜索历史
   48 道题原先只能靠六个抽屉逐层翻找，这里提供跨页面共享的轻量索引。
   三个键都只存题目 id 与时间戳，避免题目文案更新后出现脏数据。
   ========================================================== */

function readIdList(key, max) {
  const raw = read(key, [])
  const seen = {}
  return (Array.isArray(raw) ? raw : [])
    .map(x => (typeof x === 'string' ? { id: x, at: 0 } : x))
    .filter(x => {
      if (!x || !x.id || !questionData.getQuestion(x.id) || seen[x.id]) return false
      seen[x.id] = true
      return true
    })
    .slice(0, max)
}

function getFavorites() {
  return readIdList(KEYS.FAVORITES, MAX_FAVORITES)
}

function getFavoriteIds() {
  return getFavorites().map(x => x.id)
}

function isFavorite(id) {
  return getFavoriteIds().indexOf(id) >= 0
}

function toggleFavorite(id) {
  if (!questionData.getQuestion(id)) {
    return { ok: false, favorited: false, total: getFavorites().length }
  }
  const list = getFavorites()
  const had = list.some(x => x.id === id)
  const next = had
    ? list.filter(x => x.id !== id)
    : [{ id, at: Date.now() }].concat(list)
  const trimmed = next.slice(0, MAX_FAVORITES)
  write(KEYS.FAVORITES, trimmed)
  return { ok: true, favorited: !had, total: trimmed.length }
}

function getRecentQuestionIds(limit) {
  const ids = readIdList(KEYS.RECENT_QUESTIONS, MAX_RECENT_QUESTIONS).map(x => x.id)
  return limit ? ids.slice(0, limit) : ids
}

function pushRecentQuestion(id) {
  if (!questionData.getQuestion(id)) return getRecentQuestionIds()
  const rest = getRecentQuestionIds().filter(x => x !== id)
  const next = [id].concat(rest).slice(0, MAX_RECENT_QUESTIONS)
    .map((qid, i) => ({ id: qid, at: Date.now() - i }))
  write(KEYS.RECENT_QUESTIONS, next)
  return next.map(x => x.id)
}

function getSearchHistory() {
  const raw = read(KEYS.SEARCH_HISTORY, [])
  return (Array.isArray(raw) ? raw : [])
    .filter(x => typeof x === 'string' && x.trim())
    .slice(0, MAX_SEARCH_HISTORY)
}

function pushSearchHistory(keyword) {
  const kw = String(keyword || '').trim().slice(0, 30)
  if (!kw) return getSearchHistory()
  const next = [kw].concat(getSearchHistory().filter(x => x !== kw)).slice(0, MAX_SEARCH_HISTORY)
  write(KEYS.SEARCH_HISTORY, next)
  return next
}

function clearSearchHistory() {
  write(KEYS.SEARCH_HISTORY, [])
  return []
}

/* ==========================================================
   备份 / 恢复
   纯本地小程序没有云端，卸载或清缓存就会丢全部练习记录。
   导出为 JSON 文本（录音文件本身不导出，仅导出记录与报告）。
   ========================================================== */

function getBackupMeta() {
  return Object.assign(defaultBackupMeta(), read(KEYS.BACKUP, {}))
}

/** 导出成功后记录时间，用于「多久没备份」提醒 */
function markBackupDone(channel) {
  const meta = getBackupMeta()
  meta.lastBackupAt = Date.now()
  meta.count = (meta.count || 0) + 1
  meta.channel = channel || ''
  meta.reportsAtBackup = Object.keys(read(KEYS.REPORTS, {})).length
  write(KEYS.BACKUP, meta)
  return meta
}

function getBackupStatus(now) {
  const meta = getBackupMeta()
  const reportsNow = Object.keys(read(KEYS.REPORTS, {})).length
  const since = Math.max(0, reportsNow - (meta.reportsAtBackup || 0))
  const reminder = backup.getBackupReminder({
    lastBackupAt: meta.lastBackupAt,
    reportsSinceBackup: since,
    now: now || Date.now()
  })
  return {
    lastBackupAt: meta.lastBackupAt,
    count: meta.count || 0,
    channel: meta.channel || '',
    reportsSinceBackup: since,
    reminder
  }
}

function exportData() {
  const data = {
    app: 'clearsay',
    version: SCHEMA_VERSION,
    exportedAt: Date.now(),
    keys: {}
  }
  Object.keys(KEYS).forEach(name => {
    data.keys[KEYS[name]] = read(KEYS[name], null)
  })
  return data
}

function importData(input) {
  let data = input
  if (typeof input === 'string') data = JSON.parse(input)
  if (!data || data.app !== 'clearsay' || !data.keys || typeof data.keys !== 'object') {
    throw new Error('不是有效的清述备份')
  }
  let restored = 0
  Object.keys(KEYS).forEach(name => {
    const key = KEYS[name]
    if (Object.prototype.hasOwnProperty.call(data.keys, key) && data.keys[key] !== null) {
      if (write(key, data.keys[key])) restored++
    }
  })
  write(KEYS.SCHEMA, SCHEMA_VERSION)
  init()
  return { ok: true, restored, exportedAt: data.exportedAt || 0 }
}

/* ==========================================================
   清空
   ========================================================== */

const RESET_KEYS = [
  KEYS.STATS, KEYS.PROGRESS, KEYS.HISTORY, KEYS.REPORTS, KEYS.ARCHIVE,
  KEYS.QUOTES, KEYS.REVIEWS, KEYS.COACH, KEYS.THINKING, KEYS.PRONOUNCE, KEYS.TODAY,
  KEYS.RECENT_QUESTIONS, KEYS.SEARCH_HISTORY, KEYS.BACKUP
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
  MAX_REPORTS,
  MAX_AUDIO_FILES,
  SCHEMA_VERSION,
  init,
  migrate,
  repairData,
  getStorageHealth,
  getBackupMeta,
  markBackupDone,
  getBackupStatus,
  exportData,
  importData,
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
  canUseTodayAttempt,
  useTodayAttempt,
  refundTodayAttempt,
  markTodayDone,
  addHistory,
  getHistory,
  getFavorites,
  getFavoriteIds,
  isFavorite,
  toggleFavorite,
  getRecentQuestionIds,
  pushRecentQuestion,
  getSearchHistory,
  pushSearchHistory,
  clearSearchHistory,
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
  getDailyQuota,
  getEntitlement,
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
