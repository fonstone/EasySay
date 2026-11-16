/* eslint-disable no-console */
const assert = require('assert')
const store = require('../utils/store')
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
    console.error('    ' + e.message)
  }
}

function reset() {
  store.resetAll()
}

function fakeReport(id, overrides) {
  const q = questions.getQuestion('str1')
  return Object.assign({
    id: id || 'rep_test',
    createdAt: Date.now(),
    date: util.dateKey(),
    source: 'practice',
    question: {
      id: q.id,
      title: q.title,
      categoryId: q.categoryId,
      categoryName: q.categoryName,
      minSeconds: q.minSeconds,
      maxSeconds: q.maxSeconds
    },
    audio: { duration: 55, waveform: new Array(32).fill(0.4) },
    overall: 78,
    grade: { label: '良好' },
    transcript: '',
    dimensions: []
  }, overrides || {})
}

console.log('\n[初始状态]')
reset()
test('默认资料', () => {
  const p = store.getProfile()
  assert.strictEqual(p.nickname, '练习者')
  assert.strictEqual(p.onboarded, false)
})
test('默认设置', () => {
  const s = store.getSettings()
  assert.strictEqual(s.prepSeconds, 30)
  assert.strictEqual(s.chances, 2)
})
test('默认会员为免费版，每天 5 次', () => {
  const q = store.getReviewQuota()
  assert.strictEqual(q.member, false)
  assert.strictEqual(q.freeLeft, 5)
  assert.strictEqual(q.canReview, true)
})

console.log('\n[引导与设置]')
test('完成引导写入资料', () => {
  const p = store.completeOnboarding({
    nickname: '小林', goalId: 'interview', goalName: '面试表达', level: '想更稳', dailyMinutes: 10
  })
  assert.strictEqual(p.nickname, '小林')
  assert.strictEqual(p.onboarded, true)
  assert.strictEqual(store.isOnboarded(), true)
})
test('设置会被限制在合理范围', () => {
  const s = store.saveSettings({ prepSeconds: 999, chances: 99, dailyGoal: 99 })
  assert.strictEqual(s.prepSeconds, 120)
  assert.strictEqual(s.chances, 5)
  assert.strictEqual(s.dailyGoal, 5)
})

console.log('\n[打卡]')
test('连续两天打卡，streak 为 2', () => {
  const yesterday = util.addDays(util.dateKey(), -1)
  store.markCheckIn(yesterday)
  store.markCheckIn(util.dateKey())
  const streak = store.getStreak()
  assert.strictEqual(streak.current, 2)
  assert.strictEqual(streak.best, 2)
})
test('同一天重复打卡不重复计数', () => {
  store.markCheckIn(util.dateKey())
  assert.strictEqual(store.getStreak().current, 2)
})
test('周条与热力图结构正确', () => {
  const week = store.getWeekStrip(7)
  assert.strictEqual(week.length, 7)
  assert.strictEqual(week[6].isToday, true)
  const heat = store.getHeatmap(8)
  assert.strictEqual(heat.length, 8)
  assert.strictEqual(heat[0].length, 7)
})

console.log('\n[练习记录]')
const rep = fakeReport('rep_1')
test('记录一次练习会更新统计', () => {
  const before = store.getStats().sessions
  store.recordSession(rep, 'practice')
  const stats = store.getStats()
  assert.strictEqual(stats.sessions, before + 1)
  assert.ok(stats.seconds >= 55)
  assert.strictEqual(store.getDay(util.dateKey()).sessions >= 1, true)
})
test('报告与历史可读取', () => {
  store.saveReport(rep)
  assert.strictEqual(store.getReport('rep_1').overall, 78)
  const history = store.getHistory(5)
  assert.ok(history.some(h => h.reportId === 'rep_1'))
})
test('补充文字稿后更新报告与历史', () => {
  const next = Object.assign({}, rep, { overall: 85, grade: { label: '优秀' }, transcript: '这是一段补充的文字稿。' })
  store.updateReport(next)
  assert.strictEqual(store.getReport('rep_1').overall, 85)
  const item = store.getHistory(10).find(h => h.reportId === 'rep_1')
  assert.strictEqual(item.overall, 85)
  assert.strictEqual(item.hasTranscript, true)
  const day = store.getDay(util.dateKey())
  assert.strictEqual(Math.round(day.scoreSum), 85)
})

console.log('\n[闯关进度]')
test('初始只解锁第一关', () => {
  const p = store.getCategoryProgress('structure')
  assert.strictEqual(p.levels[0].unlocked, true)
  assert.strictEqual(p.levels[1].unlocked, false)
})
test('完成一道题后解锁下一关', () => {
  store.markQuestionDone('str1', 82)
  const p = store.getCategoryProgress('structure')
  assert.strictEqual(p.levels[1].unlocked, true)
  assert.ok(p.done >= 1)
})

console.log('\n[课程]')
test('课程完成状态可记录', () => {
  store.markLessonDone('c1')
  assert.ok(store.getCourseProgress().c1)
})

console.log('\n[录音档案]')
test('最多保留 15 条', () => {
  for (let i = 0; i < 18; i++) {
    store.addArchive({
      id: 'a' + i,
      reportId: 'rep_' + i,
      title: '录音 ' + i,
      date: util.dateKey(),
      path: 'C:/fake/' + i + '.wav',
      duration: 30,
      score: 70
    })
  }
  const archive = store.getArchive()
  assert.strictEqual(archive.length, 15)
  assert.strictEqual(archive[0].id, 'a17')
})
test('删除录音', () => {
  const first = store.getArchive()[0]
  store.removeArchive(first.id)
  assert.strictEqual(store.getArchive().length, 14)
})

console.log('\n[金句墙]')
test('添加金句并去重', () => {
  store.addQuote({ text: '先把话说清楚。', source: '测试', score: 90 })
  store.addQuote({ text: '先把话说清楚。', source: '重复', score: 90 })
  assert.strictEqual(store.getQuotes().length, 1)
  assert.strictEqual(store.isQuoteSaved('先把话说清楚。'), true)
})
test('移除金句', () => {
  const q = store.getQuotes()[0]
  store.removeQuote(q.id)
  assert.strictEqual(store.getQuotes().length, 0)
})

console.log('\n[会员与额度]')
test('免费额度 5 次，用完后拒绝', () => {
  store.saveMembership({ type: 'free', dailyUsed: 0, points: 0, dailyDate: util.dateKey(), trialUsed: false, expireAt: null })
  for (let i = 0; i < 5; i++) {
    const r = store.consumeReview()
    assert.strictEqual(r.ok, true, 'consume ' + i)
  }
  const last = store.getReviewQuota()
  assert.strictEqual(last.freeLeft, 0)
  const denied = store.consumeReview()
  assert.strictEqual(denied.ok, false)
})
test('点数可以在免费额度用完后抵扣', () => {
  store.addPoints(2)
  const r = store.consumeReview()
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.source, 'points')
  assert.strictEqual(store.getReviewQuota().points, 1)
})
test('体验会员不消耗额度', () => {
  store.saveMembership({ type: 'free', dailyUsed: 5, points: 0, dailyDate: util.dateKey(), trialUsed: false, expireAt: null })
  const trial = store.activateTrial()
  assert.strictEqual(trial.ok, true)
  assert.strictEqual(store.isMember(), true)
  const r = store.consumeReview()
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.source, 'member')
})
test('年卡激活与到期', () => {
  store.activatePlan('year')
  assert.strictEqual(store.isMember(), true)
  assert.ok(store.getMembership().expireAt > Date.now())
})

console.log('\n[思维题]')
test('记录答题并统计正确率', () => {
  const before = store.getThinkingStats()
  store.recordThinking('t1', true, 'fact')
  store.recordThinking('t2', false, 'fact')
  const stats = store.getThinkingStats()
  assert.strictEqual(stats.attempts, before.attempts + 2)
  assert.ok(stats.todayCount >= 2)
  assert.ok(stats.accuracy >= 0 && stats.accuracy <= 100)
})

console.log('\n[今日挑战]')
test('今日题目固定且含题目 id', () => {
  const state = store.getTodayState()
  assert.ok(state.questionId)
  assert.strictEqual(store.getTodayState().questionId, state.questionId)
})
test('今日机会受设置限制', () => {
  store.saveSettings({ chances: 2 })
  store.saveTodayState({ attempts: 0, done: false, reportId: '' })
  const a = store.useTodayAttempt()
  const b = store.useTodayAttempt()
  const c = store.useTodayAttempt()
  assert.strictEqual(a.ok, true)
  assert.strictEqual(b.ok, true)
  assert.strictEqual(c.ok, false)
})
test('完成今日后标记完成', () => {
  store.markTodayDone('rep_1')
  const state = store.getTodayState()
  assert.strictEqual(state.done, true)
  assert.strictEqual(state.reportId, 'rep_1')
})
test('今日清单随状态更新', () => {
  const tasks = store.getTodayTasks()
  assert.strictEqual(tasks.length, 3)
  assert.strictEqual(tasks[0].done, true)
})

console.log('\n[复盘]')
test('新增与删除复盘', () => {
  const r = store.addReview({ learned: '练了汇报', stuck: ['开头'], next: '先说结论', message: '继续' })
  assert.ok(r.id)
  assert.strictEqual(store.getReviews().length, 1)
  store.removeReview(r.id)
  assert.strictEqual(store.getReviews().length, 0)
})

console.log('\n[私教计划]')
test('保存与读取计划', () => {
  store.saveCoachPlan({ goalId: 'work', completed: ['str2'] })
  assert.strictEqual(store.getCoachPlan().goalId, 'work')
  assert.strictEqual(store.getCoachPlan().completed.length, 1)
})

console.log('\n[数据清理]')
test('清空练习数据保留资料与会员', () => {
  store.clearPractice()
  assert.strictEqual(store.getHistory().length, 0)
  assert.strictEqual(store.getQuotes().length, 0)
  assert.strictEqual(store.getArchive().length, 0)
  assert.strictEqual(store.getProfile().nickname, '小林')
  assert.strictEqual(store.isMember(), true)
})

console.log('\n----------------------------------------')
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项')
if (failed) process.exit(1)
