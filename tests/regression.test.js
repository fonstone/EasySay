/* eslint-disable no-console */
/**
 * 全局问题回归测试
 * 覆盖：数据结构迁移、三处存储一致性、锁稿防刷分、
 *       额度扣减时机与退还、备份恢复、写入失败上报、导航兜底。
 * 这些用例对应的是会影响所有用户 / 所有页面的底座行为。
 */
const assert = require('assert')
const path = require('path')

const storage = {}
const calls = []
let failNextWrite = false
let onStartCb = null

function audioContext() {
  return {
    src: '',
    onPlay() {}, onPause() {}, onStop() {}, onEnded() {},
    onTimeUpdate() {}, onError() {},
    play() {}, pause() {}, stop() {}, destroy() {}
  }
}

const recorderManager = {
  onStart(fn) { onStartCb = fn },
  onStop() {}, onError() {}, onInterruptionBegin() {}, onInterruptionEnd() {},
  start() { calls.push(['recorder.start']) },
  stop() { calls.push(['recorder.stop']) },
  pause() {}, resume() {}
}

global.wx = {
  env: { USER_DATA_PATH: 'C:/fake_user_data' },
  getStorageSync: k => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => {
    if (failNextWrite) {
      failNextWrite = false
      throw new Error('exceed storage quota')
    }
    storage[k] = v
  },
  removeStorageSync: k => { delete storage[k] },
  getStorageInfoSync: () => ({ currentSize: 128, limitSize: 10240 }),
  getWindowInfo: () => ({ statusBarHeight: 44, windowWidth: 375 }),
  getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: 375 }),
  setNavigationBarTitle: () => {},
  showToast: opts => calls.push(['toast', opts && opts.title]),
  showModal: opts => {
    calls.push(['modal', opts && opts.title])
    if (opts && opts.success) opts.success({ confirm: true })
  },
  navigateTo: opts => calls.push(['navigateTo', opts && opts.url]),
  redirectTo: opts => calls.push(['redirectTo', opts && opts.url]),
  switchTab: opts => calls.push(['switchTab', opts && opts.url]),
  reLaunch: opts => calls.push(['reLaunch', opts && opts.url]),
  navigateBack: () => calls.push(['navigateBack']),
  pageScrollTo: () => {},
  setKeepScreenOn: () => {},
  vibrateShort: () => {},
  setClipboardData: () => {},
  getSetting: opts => { if (opts && opts.success) opts.success({ authSetting: {} }) },
  authorize: opts => { if (opts && opts.success) opts.success({}) },
  openSetting: opts => { if (opts && opts.success) opts.success({ authSetting: { 'scope.record': true } }) },
  getRecorderManager: () => recorderManager,
  createInnerAudioContext: () => audioContext(),
  getFileSystemManager: () => ({
    readFile: opts => { if (opts && opts.fail) opts.fail({ errMsg: 'mock' }) },
    writeFile: opts => { if (opts && opts.success) opts.success({}) },
    unlink: opts => { if (opts && opts.fail) opts.fail({}) }
  })
}

global.getApp = () => ({ globalData: { statusBarHeight: 44, windowWidth: 375 } })
global.getCurrentPages = () => [{ route: 'pages/today/today' }]
global.Page = def => { global.__pageDef = def }
global.App = () => {}

const store = require('../utils/store')
const scoring = require('../utils/scoring')
const util = require('../utils/util')
const questions = require('../data/questions')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (e) {
    failed++
    console.error('  ✗ ' + name)
    console.error('    ' + (e.stack || e.message))
  }
}

function fakeReport(id, at, overrides) {
  const q = questions.getQuestion('str1')
  return Object.assign({
    id,
    createdAt: at,
    date: util.dateKey(),
    source: 'practice',
    question: {
      id: q.id, title: q.title, categoryId: q.categoryId,
      categoryName: q.categoryName, minSeconds: q.minSeconds, maxSeconds: q.maxSeconds
    },
    audio: { duration: 30, waveform: new Array(16).fill(0.3) },
    overall: 70,
    grade: { label: '良好' },
    transcript: '',
    dimensions: []
  }, overrides || {})
}

function loadSession() {
  const full = path.join(__dirname, '../pages/session/session.js')
  delete require.cache[require.resolve(full)]
  global.__pageDef = null
  require(full)
  const def = global.__pageDef
  const instance = Object.assign({}, def)
  instance.data = JSON.parse(JSON.stringify(def.data))
  instance.setData = function (patch) {
    Object.keys(patch || {}).forEach(k => {
      if (k.indexOf('.') === -1) this.data[k] = patch[k]
    })
  }
  return instance
}

console.log('\n[数据结构迁移与一致性]')
test('首次初始化写入 schema 版本，迁移幂等', () => {
  store.resetAll()
  assert.strictEqual(store.getStorageHealth().schema, store.SCHEMA_VERSION)
  const again = store.migrate()
  assert.strictEqual(again.migrated, false)
})

test('旧数据自动补外键、锁稿标记，并清掉失效音频引用', () => {
  store.resetAll()
  delete storage['cs_schema']
  storage['cs_reports'] = {
    old1: {
      id: 'old1', createdAt: 1000, overall: 72,
      transcript: '旧版本留下的文字稿', text: { chars: 10 },
      audioPath: 'C:/already-deleted.wav'
    }
  }
  storage['cs_history'] = [
    { id: 'old1', title: '旧练习' },
    { reportId: 'gone', title: '悬空记录' }
  ]
  storage['cs_archive'] = [{ id: 'a1', path: 'C:/already-deleted.wav', score: 72 }]
  store.init()
  const r = store.getReport('old1')
  assert.strictEqual(r.transcriptLocked, true, '旧文字稿必须视为已锁定')
  assert.strictEqual(r.audioPath, '', '失效的 audioPath 必须被清空')
  assert.strictEqual(r.audioExpired, true)
  assert.strictEqual(store.getHistory(0).length, 1, '悬空历史必须被移除')
  assert.strictEqual(store.getHistory(0)[0].reportId, 'old1')
  assert.strictEqual(store.getArchive().length, 0, '孤儿音频必须被清理')
})

test('超过上限后报告 / 历史 / 录音档案保持同一批 id，无悬空记录', () => {
  store.resetAll()
  for (let i = 0; i < 45; i++) {
    const id = 'rep_' + i
    store.saveReport(fakeReport(id, 1000 + i))
    store.addHistory({ id, reportId: id, title: '练习 ' + i, createdAt: 1000 + i })
    store.addArchive({ id: 'a' + i, reportId: id, path: 'C:/wav/' + i + '.wav', createdAt: 1000 + i })
  }
  assert.strictEqual(Object.keys(storage['cs_reports']).length, store.MAX_REPORTS)
  const history = store.getHistory(0)
  assert.ok(history.length > 0)
  history.forEach(h => {
    assert.ok(store.getReport(h.reportId), '每条历史都应能点开对应报告: ' + h.reportId)
  })
  const archive = store.getArchive()
  archive.forEach(a => {
    assert.ok(store.getReport(a.reportId), '每条录音都应能对应报告: ' + a.reportId)
  })
  const live = {}
  archive.forEach(a => { live[a.reportId] = a.path })
  Object.keys(storage['cs_reports']).forEach(id => {
    const r = storage['cs_reports'][id]
    if (r.audioPath) {
      assert.strictEqual(live[id], r.audioPath, 'audioPath 必须指向仍存在的档案: ' + id)
    }
  })
})

test('addHistory 对同一份报告去重', () => {
  store.resetAll()
  store.saveReport(fakeReport('dup', 2000))
  store.addHistory({ id: 'dup', reportId: 'dup', title: '第一次' })
  store.addHistory({ id: 'dup', reportId: 'dup', title: '第二次' })
  assert.strictEqual(store.getHistory(0).length, 1)
})

console.log('\n[补稿锁与录音绑定]')
test('文字稿提交后数据层拒绝再次改写，分数不能被刷高', () => {
  store.resetAll()
  const q = questions.getQuestion('str1')
  const audio = { duration: 40, waveform: new Array(16).fill(0.4) }
  const original = scoring.buildReport({ id: 'lock1', question: q, audio })
  assert.strictEqual(original.transcriptLocked, false)
  assert.ok(original.audioKey)
  store.saveReport(original)

  const first = scoring.buildReport({
    id: 'lock1', question: q, audio,
    transcript: '我认为先把结论说清楚，再补上理由和例子，听的人会更容易跟得住。',
    transcriptLocked: true,
    transcriptSubmittedAt: Date.now()
  })
  first.createdAt = original.createdAt
  store.updateReport(first)
  assert.strictEqual(store.getReport('lock1').transcriptLocked, true)

  const retry = Object.assign({}, store.getReport('lock1'), {
    transcript: '换一段完全不同的文字稿，堆满关键词看看分数会不会被顶上去。',
    overall: 99
  })
  store.updateReport(retry)
  assert.strictEqual(store.getReport('lock1').transcript, first.transcript)
  assert.strictEqual(store.getReport('lock1').overall, first.overall)
})

test('带文字稿直接生成的报告默认锁定；录音指纹可复现且随录音变化', () => {
  const q = questions.getQuestion('str1')
  const audio = { duration: 40 }
  const withText = scoring.buildReport({ question: q, audio, transcript: '这是一段足够长的文字稿内容。' })
  assert.strictEqual(withText.transcriptLocked, true)
  const a = { duration: 30.5, speechRatio: 0.7, pauseCount: 3, longestPause: 1.2, volumeMean: 0.1, energyCV: 0.3 }
  assert.strictEqual(scoring.audioFingerprint(a), scoring.audioFingerprint(Object.assign({}, a)))
  assert.notStrictEqual(
    scoring.audioFingerprint(a),
    scoring.audioFingerprint(Object.assign({}, a, { duration: 60 }))
  )
})

console.log('\n[额度时机与统一口径]')
test('只读预检不扣次数，可退还且不会变负', () => {
  store.resetAll()
  store.saveSettings({ chances: 2 })
  const check = store.canUseTodayAttempt()
  assert.strictEqual(check.ok, true)
  assert.strictEqual(store.getTodayState().attempts, 0, '预检绝不能消耗次数')
  store.useTodayAttempt()
  assert.strictEqual(store.getTodayState().attempts, 1)
  store.refundTodayAttempt()
  assert.strictEqual(store.getTodayState().attempts, 0)
  store.refundTodayAttempt()
  assert.strictEqual(store.getTodayState().attempts, 0)
})

test('统一额度视图同时给出点评次数与本题重录次数', () => {
  store.resetAll()
  const quota = store.getDailyQuota()
  assert.strictEqual(quota.freeLeft, store.FREE_DAILY_REVIEWS)
  assert.strictEqual(quota.reviewLeft, store.FREE_DAILY_REVIEWS)
  assert.ok(quota.summary.indexOf('点评') !== -1)
  assert.ok(quota.chancesLabel.indexOf('重录') !== -1)
  assert.strictEqual(quota.canPractice, true)
})

test('麦克风启动前不扣今日机会；设备故障后自动退还', () => {
  store.resetAll()
  store.saveSettings({ chances: 2 })
  const s = loadSession()
  s.onLoad({ source: 'today' })
  assert.strictEqual(s.data.isToday, true)
  s.skipPrepare()
  assert.strictEqual(store.getTodayState().attempts, 0, 'recorder.start 之前不扣')
  assert.ok(calls.some(c => c[0] === 'recorder.start'))
  if (!onStartCb) throw new Error('onStart handler not registered')
  onStartCb()
  assert.strictEqual(store.getTodayState().attempts, 1, '麦克风真正启动后才扣')
  s.failAnalysis('模拟设备故障')
  assert.strictEqual(store.getTodayState().attempts, 0, '没有生成点评就不该扣')
  s.onUnload()
})

console.log('\n[备份与写入失败]')
test('导出 / 清空 / 恢复可完整往返，非法备份被拒绝', () => {
  store.resetAll()
  store.saveReport(fakeReport('backup1', 3000))
  store.addHistory({ id: 'backup1', reportId: 'backup1', title: '备份练习' })
  const backup = JSON.stringify(store.exportData())
  assert.ok(backup.indexOf('backup1') !== -1)
  store.clearPractice()
  assert.strictEqual(store.getRecentReports(20).length, 0)
  const result = store.importData(backup)
  assert.strictEqual(result.ok, true)
  assert.ok(result.restored > 0)
  assert.ok(store.getReport('backup1'), '报告应被恢复')
  assert.ok(store.getHistory(0).some(h => h.reportId === 'backup1'))
  assert.throws(() => store.importData('{}'))
})

test('存储写入失败被记录，可通过 getStorageHealth 查询', () => {
  store.resetAll()
  failNextWrite = true
  store.saveSettings({ prepSeconds: 45 })
  const h = store.getStorageHealth()
  assert.ok(h.lastWriteError, '写入失败不能静默')
  assert.strictEqual(h.lastWriteError.key, 'cs_settings')
  assert.ok(h.writeFailures >= 1)
  assert.strictEqual(store.getSettings().prepSeconds, 30, '失败的写入不应改变已读到的默认值')
})

console.log('\n[导航兜底]')
test('冷启动无返回栈时回首页，有栈时才 navigateBack', () => {
  global.getCurrentPages = () => []
  calls.length = 0
  util.goBack()
  assert.ok(calls.some(c => c[0] === 'switchTab'), '栈深为 0 必须回首页而不是白屏')

  global.getCurrentPages = () => [{ route: 'a' }, { route: 'b' }]
  calls.length = 0
  util.goBack()
  assert.ok(calls.some(c => c[0] === 'navigateBack'))
})

test('再练一次走替换而非压栈', () => {
  calls.length = 0
  util.replacePage('/pages/session/session?source=practice&qid=str1')
  assert.ok(calls.some(c => c[0] === 'redirectTo'))
  assert.ok(!calls.some(c => c[0] === 'navigateTo'))
})

console.log('\n----------------------------------------')
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项')
if (failed) process.exit(1)
console.log('GLOBAL REGRESSION PASSED')
