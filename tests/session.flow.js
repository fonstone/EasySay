/* eslint-disable no-console */
/**
 * 端到端录音链路测试：
 * session 开始录音 -> onStop -> 读取 PCM -> 评分 -> 保存报告 -> 跳转报告
 * 用 mock 的 RecorderManager 和文件系统，验证核心链路不断。
 */
const assert = require('assert')
const path = require('path')

const storage = {}
const calls = []
let onStartCb = null
let onStopCb = null
let onFrameCb = null

function makePcm(duration, sampleRate) {
  const sr = sampleRate || 16000
  const total = Math.floor(sr * duration)
  const buffer = new ArrayBuffer(total * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < total; i++) {
    const t = i / sr
    const pause = (t > 9 && t < 11) || (t > 28 && t < 29)
    const v = pause ? 0 : Math.sin(2 * Math.PI * 180 * t) * 0.15
    view.setInt16(i * 2, Math.round(v * 32768), true)
  }
  return buffer
}

const PCM = makePcm(34)

const recorderManager = {
  onStart(fn) { onStartCb = fn },
  onStop(fn) { onStopCb = fn },
  onError() {},
  onInterruptionBegin() {},
  onInterruptionEnd() {},
  onFrameRecorded(fn) { onFrameCb = fn },
  start() {
    setTimeout(() => { if (onStartCb) onStartCb() }, 5)
    // 回吐一帧真实 PCM，验证录音页波形确实由音频帧驱动
    setTimeout(() => {
      if (onFrameCb) onFrameCb({ frameBuffer: PCM.slice(0, 3200), isLastFrame: false })
    }, 10)
  },
  stop() {
    setTimeout(() => {
      if (onStopCb) onStopCb({ tempFilePath: 'C:/fake/rec.pcm', duration: 34000, fileSize: PCM.byteLength })
    }, 5)
  },
  pause() {},
  resume() {}
}

function audioContext() {
  const ctx = {
    onPlay(fn) { this._play = fn },
    onPause(fn) { this._pause = fn },
    onStop(fn) { this._stop = fn },
    onEnded(fn) { this._ended = fn },
    onTimeUpdate(fn) { this._time = fn },
    onError(fn) { this._error = fn },
    play() {},
    pause() {},
    stop() {},
    destroy() {}
  }
  return ctx
}

global.wx = {
  env: { USER_DATA_PATH: 'C:/fake_user_data' },
  getStorageSync: k => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v },
  removeStorageSync: k => { delete storage[k] },
  getStorageInfoSync: () => ({ currentSize: 128, limitSize: 10240 }),
  getWindowInfo: () => ({ statusBarHeight: 44, windowWidth: 375, pixelRatio: 2 }),
  getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: 375, pixelRatio: 2 }),
  setNavigationBarTitle: () => {},
  showToast: opts => calls.push(['toast', opts && opts.title]),
  showModal: opts => calls.push(['modal', opts && opts.title]),
  navigateTo: opts => calls.push(['navigateTo', opts && opts.url]),
  redirectTo: opts => calls.push(['redirectTo', opts && opts.url]),
  switchTab: opts => calls.push(['switchTab', opts && opts.url]),
  reLaunch: () => {},
  navigateBack: () => calls.push(['navigateBack']),
  pageScrollTo: () => {},
  setKeepScreenOn: () => {},
  vibrateShort: () => {},
  setClipboardData: () => {},
  getSetting: opts => { if (opts.success) opts.success({ authSetting: {} }) },
  authorize: opts => { if (opts.success) opts.success({}) },
  openSetting: opts => { if (opts.success) opts.success({ authSetting: { 'scope.record': true } }) },
  getRecorderManager: () => recorderManager,
  createInnerAudioContext: () => audioContext(),
  getFileSystemManager: () => ({
    readFile: opts => {
      if (opts.success) opts.success({ data: PCM.slice(0) })
    },
    writeFile: opts => {
      calls.push(['writeFile', opts.filePath])
      if (opts.success) opts.success({})
    },
    unlink: opts => { if (opts.success) opts.success({}) }
  })
}

global.getApp = () => ({ globalData: { statusBarHeight: 44, windowWidth: 375 } })
global.getCurrentPages = () => [{ route: 'pages/session/session' }]
global.Page = def => { global.__pageDef = def }
global.App = () => {}

const store = require('../utils/store')
const scoring = require('../utils/scoring')
const util = require('../utils/util')

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
  instance.createSelectorQuery = global.wx.createSelectorQuery
  return instance
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function run() {
  store.resetAll()
  store.completeOnboarding({ nickname: '链路测试', goalId: 'work', goalName: '职场汇报', level: '刚开始', dailyMinutes: 5 })

  const session = loadSession()
  session.onLoad({ source: 'practice', qid: 'str1' })
  assert.ok(session.data.question)
  assert.strictEqual(session.data.ready, true)

  // 跳过构思，直接录音
  session.skipPrepare()
  await sleep(40)
  assert.strictEqual(session.data.recordActive, true)
  assert.strictEqual(session.data.waveLive, true, '波形必须由真实音频帧点亮')
  assert.ok(session.data.waveBars.some(b => b.live), '至少有一根柱子来自真实帧')

  // 手动结束录音
  session.doStop()
  assert.strictEqual(session.data.analyzingStages.length, 6, '进度必须是 6 个真实阶段')
  assert.strictEqual(session.data.analyzingStages[0].label, '读取录音数据')
  await sleep(2200)

  const history = store.getHistory(5)
  assert.strictEqual(history.length, 1, 'history should have one record')
  const report = store.getReport(history[0].reportId)
  assert.ok(report, 'report should be saved')
  assert.ok(report.overall >= 20 && report.overall <= 99, 'score=' + report.overall)
  assert.ok(report.audio.duration > 30, 'duration=' + report.audio.duration)
  assert.ok(report.coach.reasoning.length > 10)
  assert.ok(report.coach.nextFocus.length > 4)

  const archive = store.getArchive()
  assert.strictEqual(archive.length, 1, 'archive should have one file')
  assert.ok(archive[0].path.indexOf('.wav') !== -1, 'wav path=' + archive[0].path)

  const quota = store.getReviewQuota()
  assert.strictEqual(quota.freeLeft, 4, 'free quota should be 4 after one report')

  const redirect = calls.filter(c => c[0] === 'redirectTo')
  assert.ok(redirect.length >= 1, 'should redirect to report')
  assert.ok(redirect[0][1].indexOf('/pages/report/report?id=') === 0, 'redirect url=' + redirect[0][1])

  session.onUnload()

  // 朗读/跟读不消耗点评额度
  const before = store.getReviewQuota().freeLeft
  const session2 = loadSession()
  session2.onLoad({ source: 'pronounce', drill: 'zh1' })
  session2.skipPrepare()
  await sleep(40)
  session2.doStop()
  await sleep(2200)
  const after = store.getReviewQuota().freeLeft
  assert.strictEqual(after, before, 'delivery practice should not consume quota')
  assert.strictEqual(store.getPronounceDone().indexOf('zh1') !== -1, true)
  session2.onUnload()

  console.log('  ✓ session -> PCM -> report -> archive')
  console.log('  ✓ 评分 ' + report.overall + '，维度 ' + report.dimensions.length + '，点评证据 ' + report.coach.evidence.length)
  console.log('  ✓ 朗读/跟读不消耗点评额度')
  console.log('\nE2E PASSED')
  process.exit(0)
}

run().catch(e => {
  console.error(e.stack)
  process.exit(1)
})
