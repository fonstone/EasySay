/* eslint-disable no-console */
/**
 * P1 易用性回归测试
 * 覆盖：找题（搜索 / 筛选 / 排序 / 收藏 / 最近练习 / 搜索历史）、
 *       备份对新键的覆盖、维度解释器、以及全局加载态 / 反馈 / 令牌的静态基线。
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const storage = {}

global.wx = {
  env: { USER_DATA_PATH: 'C:/fake_user_data' },
  getStorageSync: k => (k in storage ? storage[k] : ''),
  setStorageSync: (k, v) => { storage[k] = v },
  removeStorageSync: k => { delete storage[k] },
  getStorageInfoSync: () => ({ currentSize: 128, limitSize: 10240 }),
  setNavigationBarTitle: () => {},
  showToast: () => {},
  showModal: opts => { if (opts && opts.success) opts.success({ confirm: true }) },
  navigateTo: () => {},
  redirectTo: () => {},
  switchTab: () => {},
  reLaunch: () => {},
  navigateBack: () => {},
  setClipboardData: () => {},
  getWindowInfo: () => ({ pixelRatio: 2 }),
  getSystemInfoSync: () => ({ pixelRatio: 2 })
}
global.getApp = () => ({ globalData: {} })
global.App = () => {}
global.Page = def => { global.__pageDef = def }
global.Component = () => {}

const store = require('../utils/store')
const questions = require('../data/questions')
const guide = require('../data/dimension-guide')

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
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}
function dataset(obj) {
  return { currentTarget: { dataset: obj } }
}

store.init()

/* ---------------- 数据层：找题能力 ---------------- */

test('初始化补齐收藏 / 最近练习 / 搜索历史三个键，并升级到 schema v4', () => {
  assert.strictEqual(store.SCHEMA_VERSION, 4)
  assert.strictEqual(store.getStorageHealth().schema, 4)
  assert.ok(Array.isArray(storage[store.KEYS.FAVORITES]))
  assert.ok(Array.isArray(storage[store.KEYS.RECENT_QUESTIONS]))
  assert.ok(Array.isArray(storage[store.KEYS.SEARCH_HISTORY]))
})

test('收藏可切换、拒绝无效题目、并清洗已删除的题目 id', () => {
  const a = store.toggleFavorite('str1')
  assert.strictEqual(a.favorited, true)
  assert.strictEqual(store.isFavorite('str1'), true)
  assert.strictEqual(store.toggleFavorite('str1').favorited, false)
  assert.strictEqual(store.toggleFavorite('no_such_question').ok, false)
  storage[store.KEYS.FAVORITES] = [{ id: 'str1', at: 1 }, { id: 'gone_999', at: 2 }]
  delete storage[store.KEYS.SCHEMA]
  store.init()
  assert.strictEqual(storage[store.KEYS.FAVORITES].length, 1)
  assert.deepStrictEqual(store.getFavoriteIds(), ['str1'])
})

test('最近练习去重、最新在前、上限 12 条', () => {
  store.pushRecentQuestion('r1')
  store.pushRecentQuestion('str1')
  store.pushRecentQuestion('r1')
  assert.deepStrictEqual(store.getRecentQuestionIds(), ['r1', 'str1'])
  const ids = questions.QUESTIONS.slice(0, 20).map(q => q.id)
  ids.forEach(id => store.pushRecentQuestion(id))
  assert.ok(store.getRecentQuestionIds().length <= 12)
  assert.strictEqual(store.getRecentQuestionIds()[0], ids[ids.length - 1])
})

test('搜索历史去重、保留最近 10 条、可清空', () => {
  store.pushSearchHistory('汇报')
  store.pushSearchHistory('讲故事')
  store.pushSearchHistory('汇报')
  assert.deepStrictEqual(store.getSearchHistory().slice(0, 3), ['汇报', '讲故事'])
  for (let i = 0; i < 14; i++) store.pushSearchHistory('词' + i)
  assert.strictEqual(store.getSearchHistory().length, 10)
  assert.deepStrictEqual(store.clearSearchHistory(), [])
})

test('备份导出包含新键，恢复后收藏与最近练习不丢', () => {
  if (!store.isFavorite('str1')) store.toggleFavorite('str1')
  assert.strictEqual(store.isFavorite('str1'), true)
  store.pushRecentQuestion('st1')
  const backup = JSON.parse(JSON.stringify(store.exportData()))
  assert.ok(Object.prototype.hasOwnProperty.call(backup.keys, store.KEYS.FAVORITES))
  assert.ok(Object.prototype.hasOwnProperty.call(backup.keys, store.KEYS.RECENT_QUESTIONS))
  Object.keys(storage).forEach(k => { delete storage[k] })
  store.init()
  assert.strictEqual(store.getFavoriteIds().length, 0)
  store.importData(backup)
  assert.strictEqual(store.isFavorite('str1'), true)
  assert.ok(store.getRecentQuestionIds().indexOf('st1') >= 0)
})

/* ---------------- 题库：搜索与筛选 ---------------- */

test('searchQuestions 关键词、分类、关卡、收藏筛选', () => {
  assert.strictEqual(questions.searchQuestions('').length, 48)
  const hit = questions.searchQuestions('汇报')
  assert.ok(hit.length > 0 && hit.length < 48)
  assert.ok(hit.some(q => q.title.indexOf('汇报') >= 0))
  assert.ok(questions.searchQuestions('', { categoryId: 'story' }).every(q => q.categoryId === 'story'))
  assert.ok(questions.searchQuestions('', { level: 2 }).every(q => q.level === 2))
  assert.deepStrictEqual(
    questions.searchQuestions('', { onlyFavorites: true, favoriteIds: ['str1'] }).map(q => q.id),
    ['str1']
  )
  assert.strictEqual(questions.searchQuestions('这个词一定不存在').length, 0)
  questions.SEARCH_HINTS.forEach(w => {
    assert.ok(questions.searchQuestions(w).length > 0, '推荐词「' + w + '」搜不到结果')
  })
})

test('searchQuestions 排序：时间短优先 / 关卡高优先 / 最近练习优先', () => {
  const short = questions.searchQuestions('', { sort: 'short', limit: 5 })
  for (let i = 1; i < short.length; i++) {
    assert.ok(short[i].maxSeconds >= short[i - 1].maxSeconds)
  }
  const hard = questions.searchQuestions('', { sort: 'hard', limit: 5 })
  for (let i = 1; i < hard.length; i++) {
    assert.ok(hard[i].level <= hard[i - 1].level)
  }
  const recent = questions.searchQuestions('', { sort: 'recent', recentIds: ['str1'], limit: 3 })
  assert.strictEqual(recent[0].id, 'str1')
})

/* ---------------- 维度解释器 ---------------- */

test('7 个维度都有依据与改进动作，来源分类与评分维度一致', () => {
  const keys = ['content', 'structure', 'fluency', 'rhythm', 'vocabulary', 'energy', 'completion']
  keys.forEach(k => {
    const g = guide.getDimensionGuide(k)
    assert.ok(g.basis && g.improve && g.meaning, k)
  })
  assert.strictEqual(guide.getDimensionGuide('content').from, 'text')
  assert.strictEqual(guide.getDimensionGuide('structure').from, 'text')
  assert.strictEqual(guide.getDimensionGuide('vocabulary').from, 'text')
  assert.strictEqual(guide.getDimensionGuide('fluency').from, 'voice')
  assert.strictEqual(guide.getDimensionGuide('energy').from, 'voice')
  assert.ok(guide.SCORE_GUIDE.lines.length >= 3)
  assert.strictEqual(guide.fromLabel('content'), '需补文字稿')
  assert.strictEqual(guide.fromLabel('rhythm'), '来自录音')
})

test('能力图谱补齐 completion，不再少一维', () => {
  const scoring = require('../utils/scoring')
  const keys = ['content', 'structure', 'fluency', 'rhythm', 'vocabulary', 'energy', 'completion']
  const agg = scoring.aggregateDimensions([{
    dimensions: keys.map(k => ({ key: k, name: k, score: 70, weight: 1 }))
  }])
  assert.strictEqual(agg.length, 7)
  assert.ok(agg.some(d => d.key === 'completion'))
})

/* ---------------- 新页面交互 ---------------- */

function loadPage(rel) {
  const key = require.resolve(path.join(ROOT, rel))
  delete require.cache[key]
  require(key)
  const def = global.__pageDef
  const inst = Object.assign({}, def)
  inst.data = JSON.parse(JSON.stringify(def.data))
  inst.setData = obj => { Object.keys(obj).forEach(k => { inst.data[k] = obj[k] }) }
  return inst
}

test('找题页：默认列出全部 48 题，输入后即时过滤', () => {
  const page = loadPage('pages/search/search.js')
  page.onLoad({})
  assert.strictEqual(page.data.results.length, 48)
  assert.strictEqual(page.data.showIntro, true)
  page.onInput({ detail: { value: '汇报' } })
  assert.ok(page.data.results.length > 0 && page.data.results.length < 48)
  assert.ok(page.data.resultTitle.indexOf('汇报') >= 0)
  assert.strictEqual(page.data.showIntro, false)
  page.clearKeyword()
  assert.strictEqual(page.data.results.length, 48)
})

test('找题页：分类筛选、排序切换、收藏联动、清空筛选', () => {
  const page = loadPage('pages/search/search.js')
  page.onLoad({})
  page.pickCategory(dataset({ id: 'story' }))
  assert.ok(page.data.results.length > 0)
  assert.ok(page.data.results.every(q => q.categoryName))
  assert.strictEqual(page.data.activeFilterCount, 1)
  page.pickSort(dataset({ key: 'hard' }))
  assert.strictEqual(page.data.sort, 'hard')
  const before = store.isFavorite('str1')
  page.toggleFav(dataset({ id: 'str1' }))
  assert.strictEqual(store.isFavorite('str1'), !before)
  page.openFavorites()
  assert.strictEqual(page.data.resultTitle, '我收藏的题')
  page.resetFilters()
  assert.strictEqual(page.data.results.length, 48)
  assert.strictEqual(page.data.activeFilterCount, 0)
})

test('找题页：确认搜索写入历史，scope=favorites 直达收藏视图', () => {
  const page = loadPage('pages/search/search.js')
  page.onLoad({ scope: 'favorites' })
  assert.strictEqual(page.data.onlyFavorites, true)
  assert.strictEqual(page.data.resultTitle, '我收藏的题')
  page.resetFilters()
  page.onConfirm({ detail: { value: '即兴' } })
  assert.strictEqual(store.getSearchHistory()[0], '即兴')
  assert.ok(page.data.results.length > 0)
})

/* ---------------- 全局体验基线（静态） ---------------- */

test('新页面已注册路由并纳入页面冒烟用例', () => {
  const app = JSON.parse(read('app.json'))
  assert.ok(app.pages.indexOf('pages/search/search') >= 0)
  assert.ok(read('tests/pages.smoke.js').indexOf("pages/search/search") >= 0)
})

test('5 个首屏页有骨架屏，4 个详情页有数据兜底与返回方法', () => {
  const tabs = ['today', 'practice', 'discover', 'course', 'mine']
  tabs.forEach(n => {
    assert.ok(read('pages/' + n + '/' + n + '.wxml').indexOf('skeleton-page') >= 0, n)
  })
  const details = ['course-track', 'lesson', 'pronounce-detail', 'thinking-quiz']
  details.forEach(n => {
    assert.ok(read('pages/' + n + '/' + n + '.wxml').indexOf('state-fallback') >= 0, n)
    assert.ok(read('pages/' + n + '/' + n + '.js').indexOf('goBack()') >= 0, n)
  })
})

test('全局令牌与统一类已落地，组件无残留低对比硬编码色', () => {
  const css = read('app.wxss')
  ;['--gradient-green', '--gradient-paper', '--radius-pill', '--fs-min',
    '.metric-bar', '.state-fallback', '.list-tools', '.tap-hover'].forEach(t => {
    assert.ok(css.indexOf(t) >= 0, t)
  })
  ;['components/empty-state/index.wxss', 'components/score-ring/index.wxss',
    'components/radar-chart/index.wxss'].forEach(f => {
    assert.ok(read(f).indexOf('#9aa6a1') < 0, f)
  })
  assert.ok(read('components/empty-state/index.js').indexOf('compact') >= 0)
})

test('全站无小于 20rpx 的字号，且可点元素基本都有按压反馈与无障碍角色', () => {
  const files = []
  const walk = dir => {
    fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach(e => {
      const rel = dir + '/' + e.name
      if (e.isDirectory()) walk(rel)
      else if (e.name.endsWith('.wxss') || e.name.endsWith('.wxml')) files.push(rel)
    })
  }
  ;['pages', 'components', 'custom-tab-bar'].forEach(walk)
  const wxss = files.filter(f => f.endsWith('.wxss')).map(read).join('\n')
  assert.strictEqual((wxss.match(/font-size:\s*1[5-9]rpx/g) || []).length, 0)
  const wxml = files.filter(f => f.endsWith('.wxml')).map(read).join('\n')
  const taps = (wxml.match(/bindtap=|catchtap=/g) || []).length
  const hover = (wxml.match(/hover-class=/g) || []).length
  const roles = (wxml.match(/aria-role=/g) || []).length
  assert.ok(taps >= 100, 'tappable=' + taps)
  assert.ok(hover >= taps * 0.95, 'hover=' + hover + ' taps=' + taps)
  assert.ok(roles >= taps * 0.95, 'roles=' + roles + ' taps=' + taps)
})

test('两个列表页共用统一搜索 / 排序工具条，空态支持「无结果」分支', () => {
  ;['quotes', 'review-history'].forEach(n => {
    const w = read('pages/' + n + '/' + n + '.wxml')
    assert.ok(w.indexOf('list-tools') >= 0, n)
    assert.ok(w.indexOf('{{filtered.length}}') >= 0, n)
    assert.ok(w.indexOf('emptyMode') < 0, n)
    const j = read('pages/' + n + '/' + n + '.js')
    assert.ok(j.indexOf('applyFilters()') >= 0, n)
    assert.ok(j.indexOf('emptyMode') >= 0, n)
  })
})

console.log('\n' + (failed ? 'FAILED ' + failed + ' / ' : 'UX REGRESSION PASSED ') + passed + ' checks')
if (failed) process.exit(1)
