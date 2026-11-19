/* eslint-disable no-console */
/**
 * 「真实能力 vs 伪实现」治理回归
 * -------------------------------------------------
 * 对应评审页截图里红框圈出的 8 项：假波形、假进度、缺失 ASR、
 * 内容评分与音频脱钩、模板点评、固定课表、模拟支付、卸载即丢。
 * 这些用例锁死「不伪装」这条底线，防止后续改动把假实现又加回来。
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
  getStorageInfoSync: () => ({ currentSize: 128, limitSize: 10240 })
}
global.getApp = () => ({ globalData: {} })
global.App = () => {}
global.Page = () => {}
global.Component = () => {}

const waveform = require('../utils/live-waveform')
const analysis = require('../utils/analysis')
const asr = require('../utils/asr')
const backup = require('../utils/backup')
const scoring = require('../utils/scoring')
const plan = require('../utils/plan')
const store = require('../utils/store')
const questions = require('../data/questions')

let passed = 0
let failed = 0
let chain = Promise.resolve()
/** 串行执行，支持 async 用例（ASR 的 Promise 拒绝需要 await） */
function test(name, fn) {
  chain = chain.then(async () => {
    try {
      await fn()
      passed++
      console.log('  ✓ ' + name)
    } catch (e) {
      failed++
      console.error('  ✗ ' + name)
      console.error('    ' + (e.stack || e.message))
    }
  })
}
function group(name) {
  chain = chain.then(() => console.log('\n' + name))
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function pcmBuffer(n, value) {
  const buf = new ArrayBuffer(n * 2)
  const view = new DataView(buf)
  for (let i = 0; i < n; i++) view.setInt16(i * 2, value, true)
  return buf
}
function voiceBuffer(seconds) {
  const sr = 16000
  const total = Math.floor(sr * seconds)
  const buf = new ArrayBuffer(total * 2)
  const view = new DataView(buf)
  for (let i = 0; i < total; i++) {
    view.setInt16(i * 2, Math.round(Math.sin(2 * Math.PI * 180 * i / sr) * 0.2 * 32768), true)
  }
  return buf
}
function fakeAudio() {
  return {
    duration: 60, hasVoice: true, speechRatio: 0.8, speechSeconds: 48,
    pauseCount: 2, longPauseCount: 0, pausesPerMinute: 2.5,
    longestPause: 0.9, pauseSeconds: 1.2, volumeMean: 0.06,
    volumePeak: 0.3, energyCV: 0.2,
    pauses: [{ start: 10, seconds: 0.9 }],
    waveform: new Array(32).fill(0.4), confidence: 0.9
  }
}
const q = questions.getQuestion('str1')

/* ---------------- 1. 录音页波形必须来自真实 PCM 帧 ---------------- */
group('[真实波形]')
test('静音帧 RMS 为 0', () => {
  assert.strictEqual(waveform.frameRms(null), 0)
  assert.strictEqual(waveform.frameRms(pcmBuffer(320, 0)), 0)
})
test('恒定振幅帧 RMS 与振幅一致', () => {
  const rms = waveform.frameRms(pcmBuffer(320, 16384))
  assert.ok(Math.abs(rms - 0.5) < 0.001, 'rms=' + rms)
})
test('没有音频帧时所有柱子都是静音，不生成假曲线', () => {
  const wave = waveform.createLiveWaveform(24)
  const bars = wave.getBars()
  assert.strictEqual(bars.length, 24)
  assert.ok(bars.every(b => b.live === false))
  assert.ok(bars.every(b => b.h === 6))
  assert.strictEqual(wave.getStats().frames, 0)
})
test('喂入真实帧后柱子长高、可诊断、可重置', () => {
  const wave = waveform.createLiveWaveform(24)
  wave.pushFrame(pcmBuffer(320, 2000))
  wave.pushFrame(pcmBuffer(320, 16000))
  const bars = wave.getBars()
  assert.ok(bars.some(b => b.live === true))
  assert.ok(Math.max.apply(null, bars.map(b => b.h)) > Math.min.apply(null, bars.map(b => b.h)))
  const stats = wave.getStats()
  assert.strictEqual(stats.frames, 2)
  assert.ok(stats.peak > 0.02)
  wave.reset()
  assert.ok(wave.getBars().every(b => !b.live))
})

/* ---------------- 2. 分析进度必须绑定真实阶段 ---------------- */
group('[真实分析进度]')
test('createRun 初始为 6 个 pending 阶段、进度 0', () => {
  const snap = analysis.createRun().snapshot()
  assert.strictEqual(snap.steps.length, 6)
  assert.ok(snap.steps.every(s => s.state === 'pending'))
  assert.strictEqual(snap.percent, 0)
  assert.strictEqual(snap.allDone, false)
})
test('阶段 begin/end 记录真实耗时且进度单调递增', () => {
  const seen = []
  const run = analysis.createRun(s => seen.push(s.percent))
  run.begin('read'); run.end('read')
  run.begin('energy'); run.end('energy')
  const snap = run.snapshot()
  assert.strictEqual(snap.steps[0].state, 'done')
  assert.ok(snap.steps[0].msLabel.length > 0)
  assert.ok(snap.percent > 0)
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1])
})
test('finish() 后 100% 且全部阶段完成', () => {
  const run = analysis.createRun()
  run.finish()
  const snap = run.snapshot()
  assert.strictEqual(snap.percent, 100)
  assert.strictEqual(snap.allDone, true)
})
test('analyzePcm 会把 energy / vad / pause 三个真实阶段标记完成', () => {
  const run = analysis.createRun()
  const audio = scoring.analyzePcm(voiceBuffer(2), 16000, run)
  assert.ok(audio.duration >= 1.9)
  const snap = run.snapshot()
  ;['energy', 'vad', 'pause'].forEach(id => {
    assert.ok(['done', 'skipped'].indexOf(snap.steps.find(s => s.id === id).state) >= 0, id)
  })
  assert.ok(snap.percent >= 60, 'percent=' + snap.percent)
})

/* ---------------- 3. ASR 能力必须诚实 ---------------- */
group('[ASR 能力边界]')
test('未配置时 getCapability 明确返回未接入', () => {
  const cap = asr.getCapability()
  assert.strictEqual(cap.available, false)
  assert.ok(cap.reason && cap.reason.length > 8)
  assert.strictEqual(asr.sourceLabel('manual').indexOf('非语音识别') >= 0, true)
})
test('未配置时 recognizeAudio 必须以 ASR_UNAVAILABLE 拒绝', async () => {
  let code = ''
  await asr.recognizeAudio({ filePath: 'x.wav' }).catch(e => { code = e.code })
  assert.strictEqual(code, 'ASR_UNAVAILABLE')
})
test('注入 file 提供者后能力变为可用', () => {
  const cap = asr.setProvider({
    id: 'mock-cloud',
    label: '测试转写',
    recognize: () => ({ text: '这是一段识别出来的文字稿内容，足够长。' })
  })
  assert.strictEqual(cap.available, true)
  assert.strictEqual(cap.mode, 'file')
})
test('识别结果标记为 asr；移除提供者后重新变为未接入', async () => {
  const res = await asr.recognizeAudio({ filePath: 'x.wav' })
  assert.strictEqual(res.source, 'asr')
  assert.ok(res.text.length > 5)
  asr.setProvider(null)
  assert.strictEqual(asr.getCapability().available, false)
})

/* ---------------- 4. 内容维度来源与音文对齐 ---------------- */
group('[数据来源与音文对齐]')
test('自述稿明显短于有效发声量时判定 short 且不可信', () => {
  const a = scoring.checkAlignment({ speechSeconds: 30 }, { present: true, chars: 20 })
  assert.strictEqual(a.status, 'short')
  assert.strictEqual(a.trusted, false)
  assert.ok(a.label.length > 8)
})
test('自述稿明显长于有效发声量时判定 long', () => {
  const a = scoring.checkAlignment({ speechSeconds: 30 }, { present: true, chars: 400 })
  assert.strictEqual(a.status, 'long')
  assert.ok(a.ratio > 2.2)
})
test('长度吻合时判定 consistent，并给出预期字数', () => {
  const a = scoring.checkAlignment({ speechSeconds: 30 }, { present: true, chars: 110 })
  assert.strictEqual(a.status, 'consistent')
  assert.strictEqual(a.trusted, true)
  assert.ok(a.expectedChars > 100)
})
test('无自述稿的报告明确标注来源，且不产生内容维度', () => {
  const r = scoring.buildReport({ question: q, audio: fakeAudio() })
  assert.strictEqual(r.provenance.transcript, 'none')
  assert.strictEqual(r.provenance.alignment, null)
  assert.strictEqual(r.provenance.asr.available, false)
  assert.ok(r.transcriptSourceLabel.indexOf('未提供') >= 0)
  assert.strictEqual(r.dimensions.length, 4)
  assert.strictEqual(r.version, '3.0')
})
test('每个维度都带 source / sourceLabel / basis', () => {
  const r = scoring.buildReport({
    question: q, audio: fakeAudio(),
    transcript: '我认为先把结论说清楚，再补上理由和例子，听的人会更容易跟得住。因为早上没有人打扰，注意力最完整。比如我上周写方案，两个小时比四个小时写得还多。所以我会把最难的事放在早上。'
  })
  assert.strictEqual(r.dimensions.length, 7)
  r.dimensions.forEach(d => {
    assert.ok(['voice', 'text', 'mixed'].indexOf(d.source) >= 0, d.key)
    assert.ok(d.sourceLabel && d.basis, d.key)
  })
  assert.ok(r.provenance.alignment)
})

/* ---------------- 5. 教练点评可解释 ---------------- */
group('[可解释规则点评]')
test('每条规则都有 id / 触发条件 / 实测值 / 阈值 / 文本', () => {
  const r = scoring.buildReport({ question: q, audio: fakeAudio() })
  assert.ok(r.coach.rules.length >= 2)
  r.coach.rules.forEach(rule => {
    ;['id', 'kind', 'rule', 'metric', 'threshold', 'text'].forEach(k => {
      assert.ok(rule[k] !== undefined && String(rule[k]).length > 0, k)
    })
  })
})
test('引擎明确标记非 AI，并说明「下次只练这一件事」怎么来的', () => {
  const r = scoring.buildReport({ question: q, audio: fakeAudio() })
  assert.strictEqual(r.coach.engine.isAI, false)
  assert.strictEqual(r.coach.engine.deterministic, true)
  assert.ok(r.coach.nextFocusRule.indexOf('得分最低') >= 0)
})
test('buildReport 传入 run 时会真实完成 report 阶段', () => {
  const run = analysis.createRun()
  scoring.buildReport({ question: q, audio: fakeAudio(), run })
  const stage = run.snapshot().steps.find(s => s.id === 'report')
  assert.strictEqual(stage.state, 'done')
})

/* ---------------- 6. 私教计划随数据变化 ---------------- */
group('[自适应私教计划]')
const weakReports = [0, 1, 2, 3, 4].map(i => ({
  id: 'h' + i,
  createdAt: 1000 + i,
  date: '2026-11-1' + i,
  overall: 62,
  text: { chars: 120 },
  dimensions: ['content', 'structure', 'fluency', 'rhythm', 'vocabulary', 'energy', 'completion']
    .map(k => ({ key: k, name: k, score: k === 'vocabulary' ? 32 : (k === 'energy' ? 38 : 80), weight: 1 }))
}))
test('无练习记录时也能排出 7 道不重复、带理由的题', () => {
  const p = plan.buildPlan({ goalId: 'work', reports: [], sessionCount: 0 })
  assert.strictEqual(p.days.length, 7)
  assert.strictEqual(new Set(p.questionIds).size, 7)
  assert.ok(p.days.every(d => d.reason && d.title))
  assert.strictEqual(p.basis.reports, 0)
  assert.ok(p.focusText.indexOf('还没有练习记录') >= 0)
})
test('有薄弱维度后计划变化，并说明依据', () => {
  const empty = plan.buildPlan({ goalId: 'work', reports: [], sessionCount: 0 })
  const withData = plan.buildPlan({ goalId: 'work', reports: weakReports, sessionCount: 5 })
  assert.notStrictEqual(withData.questionIds.join(','), empty.questionIds.join(','))
  assert.strictEqual(withData.focusDims[0], 'vocabulary')
  assert.ok(withData.focusText.indexOf('用词') >= 0)
  assert.strictEqual(withData.basis.reports, 5)
  assert.ok(withData.days.every(d => questions.getQuestion(d.qid)))
})
test('同样输入永远得到同样计划，关卡随练习量提升', () => {
  const a = plan.buildPlan({ goalId: 'work', reports: weakReports, sessionCount: 5 })
  const b = plan.buildPlan({ goalId: 'work', reports: weakReports, sessionCount: 5 })
  assert.deepStrictEqual(a.questionIds, b.questionIds)
  assert.strictEqual(plan.targetLevelFor(0), 1)
  assert.strictEqual(plan.targetLevelFor(10), 3)
  assert.strictEqual(plan.targetLevelFor(30), 4)
})
test('旧版固定课表被归一化并保留完成记录', () => {
  const legacy = plan.normalizePlan({ goalId: 'work', createdAt: 1, completed: ['str2'] })
  assert.strictEqual(legacy.days.length, 7)
  assert.strictEqual(legacy.engine, 'legacy-fixed-v0')
  assert.deepStrictEqual(legacy.completed, ['str2'])
  assert.ok(legacy.focusText.indexOf('重排') >= 0)
})

/* ---------------- 7. 备份提醒 ---------------- */
group('[备份提醒]')
test('从未备份且已有报告时必须提醒', () => {
  const r = backup.getBackupReminder({ lastBackupAt: 0, reportsSinceBackup: 1, now: 1000000000 })
  assert.strictEqual(r.needed, true)
  assert.ok(r.reason.indexOf('备份') >= 0)
})
test('新增 3 份报告要提醒；刚备份过且无新增不提醒', () => {
  const now = 2000000000
  assert.strictEqual(backup.getBackupReminder({ lastBackupAt: now - 1000, reportsSinceBackup: 3, now }).needed, true)
  assert.strictEqual(backup.getBackupReminder({ lastBackupAt: now - 1000, reportsSinceBackup: 0, now }).needed, false)
  assert.strictEqual(backup.getBackupReminder({ lastBackupAt: now - 8 * 86400000, reportsSinceBackup: 0, now }).needed, true)
})
test('备份文件名带日期；没有 shareFile 能力时不伪装分享', () => {
  assert.ok(/^clearsay-backup-\d{4}-\d{2}-\d{2}\.json$/.test(backup.fileName(Date.now())))
  assert.strictEqual(backup.shareBackupFile(''), false)
  assert.strictEqual(backup.shareBackupFile('/tmp/x.json'), false)
})

/* ---------------- 8. 权益口径与静态底线 ---------------- */
group('[权益口径与静态底线]')
test('getEntitlement 明确标记为本地演示、非真实支付', () => {
  store.init()
  const e = store.getEntitlement()
  assert.strictEqual(e.source, 'local-demo')
  assert.strictEqual(e.isRealPayment, false)
  assert.ok(e.demoNotice.indexOf('不扣款') >= 0)
})
test('schema 升到 4，备份时间与新增报告数可往返', () => {
  assert.strictEqual(store.SCHEMA_VERSION, 4)
  assert.strictEqual(store.getStorageHealth().schema, 4)
  store.markBackupDone('file')
  const status = store.getBackupStatus()
  assert.ok(status.lastBackupAt > 0)
  assert.strictEqual(status.count >= 1, true)
  assert.strictEqual(status.channel, 'file')
  assert.ok(typeof status.reminder.reason === 'string')
})
test('源码中不再有假波形 / 假进度，且四个诚实化入口都已落地', () => {
  const session = read('pages/session/session.js')
  const recorder = read('utils/recorder.js')
  assert.ok(session.indexOf('Math.sin') < 0, '录音页不能再用 Math.sin 生成波形')
  assert.ok(session.indexOf('startAnalysisAnimation') < 0, '不能保留定时器假进度')
  assert.ok(session.indexOf('handleFrame') >= 0)
  assert.ok(session.indexOf('analysis.createRun') >= 0)
  assert.ok(recorder.indexOf('onFrameRecorded') >= 0)
  assert.ok(recorder.indexOf('supportsFrames') >= 0)
  assert.ok(read('pages/member/member.wxml').indexOf('demo-banner') >= 0)
  assert.ok(read('pages/report/report.wxml').indexOf('source-card') >= 0)
  assert.ok(read('pages/report/report.wxml').indexOf('coachRules') >= 0)
  assert.ok(read('pages/settings/settings.wxml').indexOf('backup-status') >= 0)
  assert.ok(read('pages/coach/coach.wxml').indexOf('rebuildPlan') >= 0)
  assert.ok(read('preview/index.html').indexOf('已诚实标注') >= 0)
})

chain.then(() => {
  console.log('\n----------------------------------------')
  console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项')
  if (failed) process.exit(1)
  console.log('HONESTY REGRESSION PASSED')
})
