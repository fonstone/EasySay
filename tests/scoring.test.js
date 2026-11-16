/* eslint-disable no-console */
const assert = require('assert')
const scoring = require('../utils/scoring')
const util = require('../utils/util')

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

/** 生成带静音段和音量起伏的模拟人声 PCM */
function makePcm(opts) {
  const sr = (opts && opts.sampleRate) || 16000
  const duration = (opts && opts.duration) || 20
  const pauses = (opts && opts.pauses) || [[5, 7], [12, 13.8]]
  const total = Math.floor(sr * duration)
  const buffer = new ArrayBuffer(total * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < total; i++) {
    const t = i / sr
    const inPause = pauses.some(p => t >= p[0] && t < p[1])
    let v = 0
    if (!inPause) {
      const env = 0.45 + 0.35 * Math.sin(t * 3.1) + 0.2 * Math.sin(t * 0.7)
      const tone = Math.sin(2 * Math.PI * 180 * t) * 0.6 + Math.sin(2 * Math.PI * 320 * t) * 0.4
      v = tone * env * 0.22
    }
    view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(v * 32768))), true)
  }
  return buffer
}

function makeQuestion(extra) {
  return Object.assign({
    id: 'st-test',
    title: '测试题',
    categoryId: 'structure',
    categoryName: '结构表达',
    minSeconds: 45,
    maxSeconds: 90,
    keyPoints: [
      { label: '明确观点', keywords: ['我认为', '我觉得', '我的观点'] },
      { label: '具体理由', keywords: ['因为', '原因是'] },
      { label: '个人例子', keywords: ['比如', '举个例子', '有一次'] },
      { label: '一句收尾', keywords: ['所以', '总之', '最后'] }
    ]
  }, extra || {})
}

console.log('\n[util]')
test('dateKey 为本地日期格式', () => {
  const d = new Date(2026, 10, 16)
  assert.strictEqual(util.dateKey(d), '2026-11-16')
})
test('addDays 跨月正确', () => {
  assert.strictEqual(util.addDays('2026-11-30', 1), '2026-12-01')
})
test('daysBetween 正确', () => {
  assert.strictEqual(util.daysBetween('2026-11-10', '2026-11-16'), 6)
})
test('clock 格式化', () => {
  assert.strictEqual(util.clock(83), '01:23')
})

console.log('\n[PCM 分析]')
const pcm = makePcm({ duration: 20, pauses: [[5, 7], [12, 13.8]] })
const audio = scoring.analyzePcm(pcm, 16000)

test('识别出人声', () => {
  assert.strictEqual(audio.hasVoice, true)
})
test('总时长正确', () => {
  assert.ok(Math.abs(audio.duration - 20) < 0.2, 'duration=' + audio.duration)
})
test('检测到两次长停顿', () => {
  assert.ok(audio.longPauseCount >= 2, 'longPauseCount=' + audio.longPauseCount)
  assert.ok(audio.longestPause >= 1.8, 'longest=' + audio.longestPause)
})
test('有效发声比例在合理区间', () => {
  assert.ok(audio.speechRatio > 0.75 && audio.speechRatio < 0.92, 'speechRatio=' + audio.speechRatio)
})
test('波形有 32 个采样点', () => {
  assert.strictEqual(audio.waveform.length, 32)
  assert.ok(audio.waveform.some(v => v > 0.5))
})
test('纯静音返回无人声', () => {
  const silence = new ArrayBuffer(16000 * 2)
  const a = scoring.analyzePcm(silence, 16000)
  assert.strictEqual(a.hasVoice, false)
  assert.strictEqual(a.speechRatio, 0)
})

console.log('\n[WAV 封装]')
test('WAV 头正确', () => {
  const wav = scoring.pcmToWav(pcm, 16000)
  const head = Buffer.from(wav.slice(0, 44)).toString('ascii')
  assert.ok(head.startsWith('RIFF'))
  assert.ok(head.includes('WAVE'))
  assert.ok(head.includes('data'))
  assert.strictEqual(wav.byteLength, pcm.byteLength + 44)
})

console.log('\n[文本分析]')
const goodText = '我认为早起真正有价值的地方，不是多出两个小时，而是给一天定了一个安静的基调。因为早上没有人找你，注意力最完整，你可以先做最重要的一件事。比如我上周写方案，早上七点到九点两个小时，比下午四个小时写得还多。所以我现在会把最难的事放在早上，把会议留到下午。'
const goodTextStats = scoring.analyzeText(goodText, 60, makeQuestion())
test('统计中文字数', () => {
  assert.ok(goodTextStats.chars > 100, 'chars=' + goodTextStats.chars)
})
test('识别开场、过渡与收尾', () => {
  assert.strictEqual(goodTextStats.hasOpening, true)
  assert.ok(goodTextStats.transitionCount >= 2)
  assert.strictEqual(goodTextStats.hasClosing, true)
})
test('要点覆盖完整', () => {
  assert.strictEqual(goodTextStats.coverage, 1)
})
test('口头禅为 0', () => {
  assert.strictEqual(goodTextStats.fillerCount, 0)
})
test('语速在合理区间', () => {
  assert.ok(goodTextStats.pace > 100, 'pace=' + goodTextStats.pace)
})

const badText = '嗯，那个，我觉得吧，就是说，嗯，这个事情，那个，其实吧，就是说，那个，然后呢，对吧，嗯，这个事情就是说，那个，差不多就是这样，嗯，那个。'
const badTextStats = scoring.analyzeText(badText, 30, makeQuestion())
test('识别口头禅', () => {
  assert.ok(badTextStats.fillerCount >= 8, 'fillerCount=' + badTextStats.fillerCount)
})
test('口头禅密度高', () => {
  assert.ok(badTextStats.fillerPer100 > 8, 'fillerPer100=' + badTextStats.fillerPer100)
})

console.log('\n[报告评分]')
const reportNoText = scoring.buildReport({ question: makeQuestion(), audio })
test('无文字稿也可评分', () => {
  assert.ok(reportNoText.overall >= 40 && reportNoText.overall <= 99, 'overall=' + reportNoText.overall)
  assert.strictEqual(reportNoText.dimensions.length, 4)
})
test('无文字稿不出现内容维度', () => {
  assert.ok(!reportNoText.dimensions.some(d => d.key === 'content'))
  assert.strictEqual(reportNoText.text, null)
})
test('教练点评有证据', () => {
  assert.ok(reportNoText.coach.evidence.length >= 1)
  assert.ok(reportNoText.coach.nextFocus.length > 4)
  assert.ok(reportNoText.coach.reasoning.length > 10)
})

const audioLong = scoring.analyzePcm(makePcm({ duration: 75, pauses: [[20, 20.6], [50, 50.4]] }), 16000)
const reportGood = scoring.buildReport({
  question: makeQuestion(),
  audio: audioLong,
  transcript: goodText
})
test('文字稿报告 7 个维度全部计分', () => {
  assert.strictEqual(reportGood.dimensions.filter(d => d.weight > 0).length, 7)
})
test('结构完整的回答得分良好', () => {
  assert.ok(reportGood.overall >= 72, 'overall=' + reportGood.overall + ' dims=' + reportGood.dimensions.map(d => d.name + ':' + d.score).join(','))
})
test('报告包含金句', () => {
  assert.ok(reportGood.quote.length > 8, 'quote=' + reportGood.quote)
})
test('分数可复现', () => {
  const again = scoring.buildReport({ question: makeQuestion(), audio: audioLong, transcript: goodText })
  assert.strictEqual(again.overall, reportGood.overall)
  assert.deepStrictEqual(again.dimensions.map(d => d.score), reportGood.dimensions.map(d => d.score))
})

const reportBad = scoring.buildReport({
  question: makeQuestion(),
  audio: scoring.analyzePcm(makePcm({ duration: 20, pauses: [[2, 12]] }), 16000),
  transcript: badText
})
test('口头禅多、时长不足会扣分', () => {
  assert.ok(reportBad.overall < reportGood.overall, 'bad=' + reportBad.overall + ' good=' + reportGood.overall)
})
test('点评含待改进项', () => {
  assert.ok(reportBad.coach.weaknesses.length >= 1)
  assert.ok(reportBad.coach.weaknesses.some(w => w.indexOf('口头禅') !== -1 || w.indexOf('停顿') !== -1 || w.indexOf('秒') !== -1))
})

console.log('\n[能力聚合]')
test('聚合多次报告的维度', () => {
  const agg = scoring.aggregateDimensions([reportGood, reportNoText])
  assert.ok(agg.length >= 4)
  assert.ok(agg.every(d => d.value > 0 && d.value <= 100))
})

console.log('\n----------------------------------------')
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项')
if (failed) process.exit(1)
