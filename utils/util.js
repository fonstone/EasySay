/**
 * 通用工具函数
 * 纯 JS，无小程序 API 依赖，可在 Node 中单独测试。
 */

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

/** 本地时区的 YYYY-MM-DD */
function dateKey(date) {
  const d = date || new Date()
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

function parseDateKey(key) {
  if (!key) return new Date()
  const parts = String(key).split('-').map(Number)
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1)
}

function addDays(key, n) {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

function minusDays(date, n) {
  return addDays(dateKey(date), -n)
}

/** 前一个自然日 */
function yesterdayKey(date) {
  return addDays(dateKey(date), -1)
}

function daysBetween(a, b) {
  const da = parseDateKey(a)
  const db = parseDateKey(b)
  da.setHours(0, 0, 0, 0)
  db.setHours(0, 0, 0, 0)
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

function cnDate(key) {
  const d = parseDateKey(key)
  return d.getMonth() + 1 + '月' + d.getDate() + '日 周' + WEEK_CN[d.getDay()]
}

function cnDateShort(key) {
  const d = parseDateKey(key)
  return d.getMonth() + 1 + '月' + d.getDate() + '日'
}

function cnWeek(key) {
  return '周' + WEEK_CN[parseDateKey(key).getDay()]
}

function greeting(hour) {
  const h = typeof hour === 'number' ? hour : new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 23) return '晚上好'
  return '夜深了'
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function round(n, digits) {
  const p = Math.pow(10, digits || 0)
  return Math.round(n * p) / p
}

function uid(prefix) {
  const t = Date.now().toString(36)
  const r = Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0')
  return (prefix || 'id') + '_' + t + r
}

function hashString(str) {
  const s = String(str || '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 可复现的伪随机数发生器 */
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickSeeded(arr, seed) {
  if (!arr || !arr.length) return null
  const rand = mulberry32(seed >>> 0)
  return arr[Math.floor(rand() * arr.length)]
}

function shuffleSeeded(arr, seed) {
  const list = (arr || []).slice()
  const rand = mulberry32(seed >>> 0)
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = list[i]
    list[i] = list[j]
    list[j] = tmp
  }
  return list
}

/** 秒 -> 01:23 */
function clock(seconds) {
  const s = Math.max(0, Math.round(seconds || 0))
  return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60)
}

/** 秒 -> 2 分 10 秒 */
function durationText(seconds) {
  const s = Math.max(0, Math.round(seconds || 0))
  if (s < 60) return s + ' 秒'
  const m = Math.floor(s / 60)
  const left = s % 60
  return left ? m + ' 分 ' + left + ' 秒' : m + ' 分钟'
}

function pct(n) {
  return Math.round((n || 0) * 100)
}

function truncate(str, max) {
  const s = String(str || '')
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}

function formatNumber(n) {
  const v = Number(n) || 0
  if (v < 10000) return String(v)
  return (v / 10000).toFixed(1).replace(/\.0$/, '') + ' 万'
}

/** 把 1..n 补零的序号 */
function indexLabel(i) {
  return i < 10 ? '0' + i : String(i)
}

/* ==========================================================
   导航兜底（全局）
   从分享卡片 / 扫码 / 订阅消息冷启动时页面栈只有 1 层，
   wx.navigateBack() 会静默失败，用户看到「点了没反应」甚至白屏。
   ========================================================== */

const HOME_TAB = '/pages/today/today'

function stackDepth() {
  try {
    if (typeof getCurrentPages !== 'function') return 0
    const pages = getCurrentPages()
    return pages && pages.length ? pages.length : 0
  } catch (e) {
    return 0
  }
}

function goBack(fallbackUrl) {
  if (typeof wx === 'undefined') return
  const tab = fallbackUrl || HOME_TAB
  if (stackDepth() > 1) {
    wx.navigateBack({ fail: () => wx.switchTab({ url: tab }) })
  } else {
    wx.switchTab({ url: tab, fail: () => wx.reLaunch({ url: tab }) })
  }
}

/** 替换当前页：避免「报告 → 再练一次 → 报告」让页面栈无限增长 */
function replacePage(url) {
  if (typeof wx === 'undefined') return
  wx.redirectTo({ url, fail: () => wx.navigateTo({ url }) })
}

function switchTabSafe(url) {
  if (typeof wx === 'undefined') return
  wx.switchTab({ url, fail: () => wx.reLaunch({ url }) })
}

module.exports = {
  WEEK_CN,
  HOME_TAB,
  stackDepth,
  goBack,
  replacePage,
  switchTabSafe,
  pad2,
  dateKey,
  parseDateKey,
  addDays,
  minusDays,
  yesterdayKey,
  daysBetween,
  cnDate,
  cnDateShort,
  cnWeek,
  greeting,
  clamp,
  round,
  uid,
  hashString,
  mulberry32,
  pickSeeded,
  shuffleSeeded,
  clock,
  durationText,
  pct,
  truncate,
  formatNumber,
  indexLabel
}
