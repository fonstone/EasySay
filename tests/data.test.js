/* eslint-disable no-console */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const questions = require('../data/questions')
const courses = require('../data/courses')
const thinking = require('../data/thinking')
const pronounce = require('../data/pronounce')
const coach = require('../data/coach')

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

console.log('\n[题库]')
test('6 个练习方向', () => {
  assert.strictEqual(questions.CATEGORIES.length, 6)
})
test('48 道题，id 唯一', () => {
  assert.strictEqual(questions.QUESTIONS.length, 48)
  const ids = questions.QUESTIONS.map(q => q.id)
  assert.strictEqual(new Set(ids).size, ids.length)
})
test('每个方向 8 题、4 个难度、每关 2 题', () => {
  questions.CATEGORIES.forEach(c => {
    const list = questions.getQuestions(c.id)
    assert.strictEqual(list.length, 8, c.id + ' count=' + list.length)
    const levels = questions.getLevels(c.id)
    assert.strictEqual(levels.length, 4, c.id + ' levels=' + levels.length)
    levels.forEach(lv => assert.strictEqual(lv.questions.length, 2, c.id + ' level ' + lv.n))
  })
})
test('题目字段完整', () => {
  questions.QUESTIONS.forEach(q => {
    assert.ok(q.id && q.title && q.prompt, 'missing title/prompt: ' + q.id)
    assert.ok(q.categoryId && q.level >= 1 && q.level <= 4, 'bad category/level: ' + q.id)
    assert.ok(q.minSeconds > 0 && q.maxSeconds >= q.minSeconds, 'bad duration: ' + q.id)
    assert.ok(q.maxSeconds <= 120, 'too long: ' + q.id)
    assert.ok(Array.isArray(q.keyPoints) && q.keyPoints.length >= 2, 'keyPoints: ' + q.id)
    q.keyPoints.forEach(p => assert.ok(p.label, 'keypoint label: ' + q.id))
    assert.ok(Array.isArray(q.tips) && q.tips.length >= 2, 'tips: ' + q.id)
  })
})
test('朗读题都有材料，且标为 delivery', () => {
  questions.getQuestions('read').forEach(q => {
    assert.ok(q.material && q.material.length > 40, 'material: ' + q.id)
    assert.strictEqual(q.mode, 'read')
    assert.strictEqual(q.scoreProfile, 'delivery')
    assert.ok(q.audio && q.audio.indexOf('/assets/audio/read_') === 0, 'read audio path: ' + q.id)
    const audioFile = path.join(__dirname, '..', q.audio)
    assert.ok(fs.existsSync(audioFile), 'read audio missing: ' + q.id)
    assert.ok(fs.statSync(audioFile).size > 1000, 'read audio too small: ' + q.id)
  })
})
test('每日题池有效且可复现', () => {
  assert.ok(questions.DAILY_POOL.length >= 10)
  questions.DAILY_POOL.forEach(q => assert.ok(q && q.id))
  const a = questions.getDailyQuestion('2026-11-16')
  const b = questions.getDailyQuestion('2026-11-16')
  assert.strictEqual(a.id, b.id)
  const other = questions.getDailyQuestion('2026-11-17')
  assert.ok(other && other.id)
})

console.log('\n[课程]')
test('3 条学习线，12 节课，id 唯一', () => {
  assert.strictEqual(courses.TRACKS.length, 3)
  assert.strictEqual(courses.LESSONS.length, 12)
  const ids = courses.LESSONS.map(l => l.id)
  assert.strictEqual(new Set(ids).size, ids.length)
})
test('每条线 4 节课', () => {
  courses.TRACKS.forEach(t => {
    assert.strictEqual(courses.getLessons(t.id).length, 4, t.id)
  })
})
test('课程结构和练习引用有效', () => {
  courses.LESSONS.forEach(l => {
    assert.ok(l.title && l.subtitle && l.hook && l.takeaway, 'meta: ' + l.id)
    assert.ok(Array.isArray(l.sections) && l.sections.length >= 2, 'sections: ' + l.id)
    l.sections.forEach(s => {
      assert.ok(s.h && Array.isArray(s.ps) && s.ps.length, 'section: ' + l.id)
    })
    assert.ok(l.practice && l.practice.questionId, 'practice: ' + l.id)
    assert.ok(questions.getQuestion(l.practice.questionId), 'practice question missing: ' + l.id + ' -> ' + l.practice.questionId)
    assert.ok(l.minutes >= 3)
  })
})

console.log('\n[思维题]')
test('4 种题型 × 5 题 = 20 题', () => {
  assert.strictEqual(thinking.TYPES.length, 4)
  assert.strictEqual(thinking.QUESTIONS.length, 20)
  thinking.TYPES.forEach(t => {
    assert.strictEqual(thinking.getQuestions(t.id).length, 5, t.id)
  })
})
test('选项与答案有效', () => {
  thinking.QUESTIONS.forEach(q => {
    assert.strictEqual(q.options.length, 4, q.id)
    assert.ok(q.answer >= 0 && q.answer < 4, q.id)
    assert.ok(q.explanation.length > 10, q.id)
    assert.ok(q.tip.length > 4, q.id)
  })
})

console.log('\n[纠音]')
test('3 个版块，15 个练习，id 唯一', () => {
  assert.strictEqual(pronounce.SECTIONS.length, 3)
  assert.strictEqual(pronounce.DRILLS.length, 15)
  const ids = pronounce.DRILLS.map(d => d.id)
  assert.strictEqual(new Set(ids).size, ids.length)
})
test('纠音练习字段完整', () => {
  pronounce.DRILLS.forEach(d => {
    assert.ok(pronounce.getSection(d.section), 'section: ' + d.id)
    assert.ok(d.title && d.pinyin && d.tip && d.text, 'fields: ' + d.id)
    assert.ok(d.minSeconds > 0 && d.maxSeconds > d.minSeconds, 'duration: ' + d.id)
    assert.ok(d.audio && d.audio.indexOf('/assets/audio/') === 0, 'audio path: ' + d.id)
    const audioFile = path.join(__dirname, '..', d.audio)
    assert.ok(fs.existsSync(audioFile), 'audio missing: ' + d.id)
    assert.ok(fs.statSync(audioFile).size > 1000, 'audio too small: ' + d.id)
    const q = pronounce.toQuestion(d)
    assert.strictEqual(q.scoreProfile, 'delivery')
    assert.strictEqual(q.material, d.text)
  })
})

console.log('\n[私教]')
test('6 个目标，每个 7 天，题目全部有效', () => {
  assert.strictEqual(coach.GOALS.length, 6)
  coach.GOALS.forEach(g => {
    assert.strictEqual(g.plan.length, 7, g.id)
    assert.strictEqual(new Set(g.plan).size, 7, g.id + ' duplicate')
    g.plan.forEach(id => assert.ok(questions.getQuestion(id), g.id + ' -> ' + id))
    assert.ok(g.intro.length > 20)
  })
})

console.log('\n----------------------------------------')
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项')
if (failed) process.exit(1)
