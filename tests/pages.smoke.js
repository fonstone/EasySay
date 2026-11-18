/* eslint-disable no-console */
/**
 * 页面生命周期冒烟测试
 * 用最小 wx mock 逐个加载页面，执行 onLoad/onShow，捕获 JS 运行时错误。
 * 不渲染 WXML，只验证页面逻辑与初始数据。
 */
const assert = require('assert')
const path = require('path')
const fs = require('fs')

const storage = {}
const calls = []

const recorderManager = {
  onStart() {},
  onStop() {},
  onError() {},
  onInterruptionBegin() {},
  onInterruptionEnd() {},
  start() {},
  stop() {},
  pause() {},
  resume() {}
}

function audioContext() {
  const ctx = {
    src: '',
    currentTime: 0,
    onPlay(fn) { this._play = fn },
    onPause(fn) { this._pause = fn },
    onStop(fn) { this._stop = fn },
    onEnded(fn) { this._ended = fn },
    onTimeUpdate(fn) { this._time = fn },
    onError(fn) { this._error = fn },
    play() { if (this._play) this._play() },
    pause() { if (this._pause) this._pause() },
    stop() { if (this._stop) this._stop() },
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
  reLaunch: opts => calls.push(['reLaunch', opts && opts.url]),
  navigateBack: () => calls.push(['navigateBack']),
  pageScrollTo: () => {},
  setKeepScreenOn: () => {},
  vibrateShort: () => {},
  setClipboardData: opts => calls.push(['clipboard', opts && opts.data]),
  getSetting: opts => { if (opts.success) opts.success({ authSetting: {} }) },
  authorize: opts => { if (opts.success) opts.success({}) },
  openSetting: opts => { if (opts.success) opts.success({ authSetting: { 'scope.record': true } }) },
  getRecorderManager: () => recorderManager,
  createInnerAudioContext: () => audioContext(),
  getFileSystemManager: () => ({
    readFile: opts => { if (opts.fail) opts.fail({ errMsg: 'mock' }) },
    writeFile: opts => { if (opts.success) opts.success({}) },
    unlink: opts => { if (opts.fail) opts.fail({}) }
  }),
  createSelectorQuery: () => ({
    select: () => ({ fields: () => ({ exec: cb => cb([null]) }) })
  })
}

global.getApp = () => ({ globalData: { statusBarHeight: 44, windowWidth: 375 } })
global.getCurrentPages = () => [{ route: 'pages/today/today' }]

const appDef = {}
global.App = def => Object.assign(appDef, def)
global.Page = def => { global.__pageDef = def }
global.Component = def => { global.__componentDef = def }

const store = require('../utils/store')
const scoring = require('../utils/scoring')
const questions = require('../data/questions')

// 准备一个可读取的报告
function makePcm(duration) {
  const sr = 16000
  const total = Math.floor(sr * duration)
  const buffer = new ArrayBuffer(total * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < total; i++) {
    const t = i / sr
    const pause = (t > 8 && t < 10) || (t > 25 && t < 26)
    const v = pause ? 0 : Math.sin(2 * Math.PI * 180 * t) * 0.16
    view.setInt16(i * 2, Math.round(v * 32768), true)
  }
  return buffer
}

store.init()
store.completeOnboarding({ nickname: '测试者', goalId: 'work', goalName: '职场汇报', level: '刚开始', dailyMinutes: 5 })
const report = scoring.buildReport({
  id: 'smoke_report',
  question: questions.getQuestion('str1'),
  audio: scoring.analyzePcm(makePcm(40), 16000),
  transcript: '我认为早起最重要的不是多出两个小时，而是给一天一个安静的开始。因为早上没有人打扰，注意力最完整。比如我上周写方案，早上两小时比下午四小时写得还多。所以我会把最难的事放在早上。',
  source: 'practice',
  date: '2026-11-16'
})
store.saveReport(report)

function loadPage(pagePath, options) {
  const full = path.join(__dirname, '..', pagePath + '.js')
  delete require.cache[require.resolve(full)]
  global.__pageDef = null
  require(full)
  const def = global.__pageDef
  assert.ok(def, 'Page definition not found: ' + pagePath)
  const instance = Object.assign({}, def)
  instance.data = JSON.parse(JSON.stringify(def.data || {}))
  instance.setData = function (patch, cb) {
    Object.keys(patch || {}).forEach(key => {
      const parts = key.split('.')
      if (parts.length === 1) {
        this.data[key] = patch[key]
      } else {
        let target = this.data
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {}
          target = target[parts[i]]
        }
        target[parts[parts.length - 1]] = patch[key]
      }
    })
    if (cb) cb()
  }
  instance.createSelectorQuery = global.wx.createSelectorQuery

  if (instance.onLoad) instance.onLoad(options || {})
  if (instance.onShow) instance.onShow()
  if (instance.onReady) instance.onReady()
  return instance
}

const cases = [
  ['pages/onboarding/onboarding', {}],
  ['pages/today/today', {}],
  ['pages/practice/practice', {}],
  ['pages/discover/discover', {}],
  ['pages/course/course', {}],
  ['pages/mine/mine', {}],
  ['pages/practice-detail/practice-detail', { category: 'read' }],
  ['pages/search/search', {}],
  ['pages/session/session', { source: 'practice', qid: 'str1' }],
  ['pages/report/report', { id: 'smoke_report' }],
  ['pages/thinking/thinking', {}],
  ['pages/thinking-quiz/thinking-quiz', { id: 't1' }],
  ['pages/pronounce/pronounce', {}],
  ['pages/pronounce-detail/pronounce-detail', { id: 'zh1' }],
  ['pages/review/review', {}],
  ['pages/review-history/review-history', {}],
  ['pages/coach/coach', {}],
  ['pages/course-track/course-track', { id: 'cognition' }],
  ['pages/lesson/lesson', { id: 'c1' }],
  ['pages/archive/archive', {}],
  ['pages/quotes/quotes', {}],
  ['pages/member/member', {}],
  ['pages/settings/settings', {}],
  ['pages/privacy/privacy', {}]
]

let failed = 0
const instances = {}

const ALLOWED_ALIASES = new Set([
  'item', 'index', 'q', 'col', 'cell', 's', 'p', 'lesson', 'true', 'false', 'null', 'undefined'
])

function checkBindings(pagePath, instance) {
  const file = path.join(__dirname, '..', pagePath + '.wxml')
  if (!fs.existsSync(file)) return []
  const src = fs.readFileSync(file, 'utf8')
  const exprs = []
  const re = /\{\{([\s\S]*?)\}\}/g
  let m
  while ((m = re.exec(src))) exprs.push(m[1])
  const keys = new Set(Object.keys(instance.data || {}))
  const missing = new Set()
  exprs.forEach(expr => {
    const clean = expr.replace(/'[^']*'|"[^"]*"/g, '')
    const noProps = clean.replace(/\.[a-zA-Z_$][\w$]*/g, '')
    const ids = noProps.match(/[a-zA-Z_$][\w$]*/g) || []
    ids.forEach(id => {
      if (!keys.has(id) && !ALLOWED_ALIASES.has(id)) missing.add(id)
    })
  })
  return Array.from(missing)
}

for (const [page, options] of cases) {
  try {
    const instance = loadPage(page, options)
    instances[page] = instance
    const missing = checkBindings(page, instance)
    if (missing.length) {
      console.log('  ! ' + page + ' 可能缺少数据字段: ' + missing.join(', '))
    }
    console.log('  ✓ ' + page)
  } catch (e) {
    failed++
    console.error('  ✗ ' + page)
    console.error('    ' + e.stack)
  }
}

// 可选：导出页面初始数据，供 HTML 预览脚本使用
if (process.env.DUMP_PAGE_DATA) {
  const dump = {}
  Object.keys(instances).forEach(key => { dump[key] = instances[key].data })
  fs.writeFileSync(process.env.DUMP_PAGE_DATA, JSON.stringify(dump, null, 2))
}

// 可选：使用官方 wcc 编译器渲染每个页面，检查 WXML 运行时绑定
if (process.env.MINIPROGRAM_COMPILER) {
  try {
    global.window = global
    const compiler = require(process.env.MINIPROGRAM_COMPILER)
    const code = compiler.wxmlToJs(path.join(__dirname, '..'))
    const $gwx = new Function('global', code)(global)
    for (const [page, instance] of Object.entries(instances)) {
      try {
        const gen = $gwx(page + '.wxml')
        if (typeof gen !== 'function') throw new Error('no generate function')
        gen(instance.data)
        console.log('  ✓ render: ' + page)
      } catch (e) {
        failed++
        console.error('  ✗ render: ' + page)
        console.error('    ' + (e.message || e))
      }
    }
  } catch (e) {
    failed++
    console.error('  ✗ render compiler failed: ' + (e.message || e))
  }
}

// 交互冒烟
const interactions = [
  ['thinking-quiz choose', () => {
    const p = instances['pages/thinking-quiz/thinking-quiz']
    p.choose({ currentTarget: { dataset: { index: 1 } } })
    assert.strictEqual(p.data.answered, true)
  }],
  ['review toggleStuck', () => {
    const p = instances['pages/review/review']
    p.toggleStuck({ currentTarget: { dataset: { value: '语速太快' } } })
    assert.strictEqual(p.data.stuck.length, 1)
  }],
  ['review save', () => {
    const p = instances['pages/review/review']
    p.onNext({ detail: { value: '先说结论再补背景' } })
    p.save()
    assert.strictEqual(p.data.saved, true)
  }],
  ['coach createPlan', () => {
    const p = instances['pages/coach/coach']
    p.createPlan()
  }],
  ['settings pick', () => {
    const p = instances['pages/settings/settings']
    p.pickGoal({ currentTarget: { dataset: { id: 'interview' } } })
    p.pickPrep({ currentTarget: { dataset: { value: 15 } } })
    p.pickChances({ currentTarget: { dataset: { value: 3 } } })
    p.save()
    assert.strictEqual(store.getProfile().goalId, 'interview')
    assert.strictEqual(store.getSettings().prepSeconds, 15)
  }],
  ['member select', () => {
    const p = instances['pages/member/member']
    p.selectPlan({ currentTarget: { dataset: { id: 'twoyear' } } })
    assert.strictEqual(p.data.selected, 'twoyear')
  }],
  ['report transcript toggle', () => {
    const p = instances['pages/report/report']
    const before = p.data.transcriptOpen
    p.toggleTranscript()
    assert.strictEqual(p.data.transcriptOpen, !before)
    p.submitTranscript()
    assert.strictEqual(p.data.submitting, false)
  }],
  ['session toggle material', () => {
    const p = instances['pages/session/session']
    p.toggleMaterial()
    assert.strictEqual(p.data.materialExpanded, true)
  }],
  ['archive play missing', () => {
    const p = instances['pages/archive/archive']
    p.togglePlay({ currentTarget: { dataset: { id: 'none' } } })
  }],
  ['pronounce switch', () => {
    const p = instances['pages/pronounce/pronounce']
    p.switchSection({ currentTarget: { dataset: { id: 'tongue' } } })
    assert.ok(p.data.drills.length > 0)
  }],
  ['practice random', () => {
    const p = instances['pages/practice/practice']
    p.randomPractice()
  }],
  ['today start', () => {
    const p = instances['pages/today/today']
    p.startToday()
  }]
]

for (const [name, fn] of interactions) {
  try {
    fn()
    console.log('  ✓ interaction: ' + name)
  } catch (e) {
    failed++
    console.error('  ✗ interaction: ' + name)
    console.error('    ' + e.stack)
  }
}

// 清理页面定时器
Object.keys(instances).forEach(key => {
  const p = instances[key]
  if (p.clearTimers) p.clearTimers()
  if (p.onUnload) {
    try { p.onUnload() } catch (e) { /* ignore */ }
  }
})

console.log('\n----------------------------------------')
console.log(failed ? 'FAILED: ' + failed : 'ALL PAGES SMOKE PASSED')
process.exit(failed ? 1 : 0)
