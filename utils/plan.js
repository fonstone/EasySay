/**
 * 自适应七天计划（本地规则引擎）
 * -------------------------------------------------
 * 旧实现：data/coach.js 里 6 组 × 7 个写死的题目 id，任何人任何时候生成都一样。
 * 新实现：按「最近报告里最薄弱的维度 + 目标方向 + 练习量 + 已练/收藏/最近题目」
 * 动态选题，每道题都带一句可核对的「为什么排这道题」。
 *
 * 不是模型生成，也不联网；同样的数据永远得到同样的计划，方便复现与测试。
 */

const questions = require('../data/questions')
const scoring = require('./scoring')
const coach = require('../data/coach')
const util = require('./util')

const DIM_LABEL = {
  content: '内容', structure: '结构', fluency: '流畅', rhythm: '节奏',
  vocabulary: '用词', energy: '声音', completion: '完成度'
}

/** 薄弱维度 → 最能练到它的题目方向 */
const DIM_CATEGORY = {
  content: ['story', 'reflect', 'topic'],
  structure: ['structure', 'scene'],
  fluency: ['topic', 'read'],
  rhythm: ['read', 'topic'],
  vocabulary: ['reflect', 'story'],
  energy: ['read', 'scene'],
  completion: ['scene', 'topic']
}

function summarize(reports) {
  const list = (reports || []).slice(0, 8)
  const dims = scoring.aggregateDimensions(list)
  const sorted = dims.slice().sort((a, b) => a.value - b.value)
  const overall = list.length
    ? Math.round(list.reduce((s, r) => s + (Number(r.overall) || 0), 0) / list.length)
    : 0
  return {
    count: list.length,
    overall,
    dimensions: dims,
    weakest: sorted.slice(0, 2).map(d => d.key),
    lowest: sorted[0] || null,
    hasTranscript: list.some(r => !!(r && r.text)),
    lastDate: list.length ? (list[0].date || '') : ''
  }
}

function targetLevelFor(sessionCount) {
  if (sessionCount < 3) return 1
  if (sessionCount < 8) return 2
  if (sessionCount < 18) return 3
  return 4
}

function unique(list) {
  const seen = {}
  return (list || []).filter(x => {
    if (!x || seen[x]) return false
    seen[x] = true
    return true
  })
}

/**
 * @param {object} opts
 * @param {string} opts.goalId
 * @param {Array}  opts.reports      最近报告（新的在前）
 * @param {Array}  opts.favorites    收藏题目 id
 * @param {Array}  opts.recentIds    最近练习题目 id
 * @param {Array}  opts.doneIds      已经练过的题目 id
 * @param {Array}  opts.completed    上一轮计划里已完成的题目 id（重排时保留）
 */
function buildPlan(opts) {
  const o = opts || {}
  const goal = coach.getGoal(o.goalId) || coach.getGoals()[0]
  const summary = summarize(o.reports)
  const focusDims = summary.weakest.length
    ? summary.weakest
    : (goal.focusDims || ['structure', 'completion'])
  const preferCategories = unique(
    (goal.preferCategories || []).concat(
      focusDims.reduce((acc, k) => acc.concat(DIM_CATEGORY[k] || []), [])
    )
  )
  const favorites = o.favorites || []
  const recentIds = o.recentIds || []
  const doneIds = o.doneIds || []
  const completed = o.completed || []
  const targetLevel = targetLevelFor(o.sessionCount !== undefined ? o.sessionCount : summary.count)

  const pool = questions.QUESTIONS.filter(q => q && q.id && q.mode !== 'read')
  const scored = pool.map(q => {
    let score = 0
    const reasons = []
    if ((goal.preferCategories || []).indexOf(q.categoryId) >= 0) {
      score += 24
      reasons.push('贴近「' + goal.name + '」方向')
    }
    const hitDim = focusDims.find(k => (DIM_CATEGORY[k] || []).indexOf(q.categoryId) >= 0)
    if (hitDim) {
      score += 22
      reasons.push('练「' + (DIM_LABEL[hitDim] || hitDim) + '」这一弱项')
    }
    const gap = Math.abs((q.level || 1) - targetLevel)
    score += Math.max(0, 18 - gap * 9)
    if (favorites.indexOf(q.id) >= 0) {
      score += 10
      reasons.push('你收藏过这道题')
    }
    if ((goal.plan || []).indexOf(q.id) >= 0) score += 6
    if (recentIds.indexOf(q.id) >= 0) score -= 26
    if (doneIds.indexOf(q.id) >= 0) score -= 12
    if (completed.indexOf(q.id) >= 0) score -= 20
    return { q, score, reasons }
  })

  // 贪心选择：同一方向最多连着出现 2 次，避免七天全是同一类题
  const picked = []
  const catCount = {}
  const ranked = scored.slice().sort((a, b) => b.score - a.score || a.q.id.localeCompare(b.q.id))
  for (let i = 0; i < ranked.length && picked.length < 7; i++) {
    const item = ranked[i]
    const c = item.q.categoryId
    if ((catCount[c] || 0) >= 3) continue
    const penalty = (catCount[c] || 0) * 6
    picked.push(Object.assign({}, item, { effective: item.score - penalty }))
    catCount[c] = (catCount[c] || 0) + 1
  }
  // 若去重后不足 7 道，用剩余题目补足
  for (let i = 0; i < ranked.length && picked.length < 7; i++) {
    if (!picked.some(p => p.q.id === ranked[i].q.id)) picked.push(Object.assign({}, ranked[i]))
  }
  picked.sort((a, b) => a.q.level - b.q.level || a.q.id.localeCompare(b.q.id))

  const days = picked.map((item, i) => {
    const q = item.q
    let reason = item.reasons[0] || ''
    if (!reason) {
      reason = '第 ' + q.level + ' 关，按你目前的练习量循序渐进'
    }
    if (summary.count === 0) reason = '还没有练习记录，先从这一关建立手感'
    return {
      day: i + 1,
      qid: q.id,
      title: q.title,
      subtitle: q.subtitle || '',
      categoryName: q.categoryName || '',
      level: q.level || 1,
      minutes: Math.max(2, Math.round((q.maxSeconds || 60) / 60) + 1),
      focus: DIM_LABEL[focusDims[0]] || '表达',
      reason
    }
  })

  let focusText = '还没有练习记录，先按你选的方向从入门题开始；练完 3 次后计划会随数据重排。'
  if (summary.count > 0 && summary.lowest) {
    focusText = '近 ' + summary.count + ' 次练习里「' + (DIM_LABEL[summary.lowest.key] || summary.lowest.key) +
      '」平均 ' + summary.lowest.value + ' 分最低，这一周优先补它。'
  }
  if (!summary.hasTranscript) {
    focusText += '内容 / 结构 / 用词三维需要补写自述稿后才会纳入判断。'
  }

  const carriedCompleted = unique(completed.filter(id => days.some(d => d.qid === id)))

  return {
    goalId: goal.id,
    goalName: goal.name,
    engine: 'local-adaptive-v1',
    createdAt: Date.now(),
    completed: carriedCompleted,
    questionIds: days.map(d => d.qid),
    days,
    focusDims,
    focusText,
    basis: {
      reports: summary.count,
      overall: summary.overall,
      lowestKey: summary.lowest ? summary.lowest.key : '',
      lowestScore: summary.lowest ? summary.lowest.value : 0,
      targetLevel,
      hasTranscript: summary.hasTranscript,
      generatedFrom: '最近报告维度 + 目标方向 + 已练 / 收藏题目'
    }
  }
}

/** 兼容旧计划：老数据只有 goalId + completed，也能渲染出七天列表 */
function normalizePlan(plan) {
  if (!plan) return null
  if (Array.isArray(plan.days) && plan.days.length) return plan
  const goal = coach.getGoal(plan.goalId)
  if (!goal) return null
  return {
    goalId: goal.id,
    goalName: goal.name,
    engine: 'legacy-fixed-v0',
    createdAt: plan.createdAt || Date.now(),
    completed: plan.completed || [],
    questionIds: goal.plan.slice(),
    focusDims: goal.focusDims || ['structure', 'completion'],
    focusText: '这是旧版固定题单。点「按最新数据重排」可换成随你练习变化的计划。',
    basis: { reports: 0, targetLevel: 1, hasTranscript: false, generatedFrom: '旧版固定课表' },
    days: goal.plan.map((qid, i) => {
      const q = questions.getQuestion(qid)
      return {
        day: i + 1,
        qid,
        title: q ? q.title : '一道练习题',
        subtitle: q ? q.subtitle : '',
        categoryName: q ? q.categoryName : '',
        level: q ? q.level : 1,
        minutes: q ? Math.max(2, Math.round((q.maxSeconds || 60) / 60) + 1) : 3,
        focus: '表达',
        reason: '旧版固定课表 · 建议重排'
      }
    })
  }
}

module.exports = {
  DIM_LABEL,
  DIM_CATEGORY,
  summarize,
  targetLevelFor,
  buildPlan,
  normalizePlan
}
