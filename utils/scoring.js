/**
 * 清述确定性评分引擎
 * -------------------------------------------------
 * 设计原则：
 * 1. 分数由可复现的代码计算，同一段音频/文字永远得到同一个分；
 * 2. 语音质量（流畅/节奏/声音/完成度）来自真实 PCM 分析；
 * 3. 内容/结构/用词来自可选文字稿的确定性文本分析；
 * 4. 教练点评只引用检测到的事实，不编造用户没说过的话；
 * 5. 无文字稿时不假装能给内容打分，只用 4 个可测维度。
 *
 * 本文件不依赖 wx API，可直接在 Node 中测试。
 */

const util = require('./util')

const DIM_META = {
  content: { name: '内容', desc: '观点是否切题，题目要点讲到了多少' },
  structure: { name: '结构', desc: '开场、过渡与收尾是否让人跟得住' },
  fluency: { name: '流畅', desc: '有效发声比例与停顿控制' },
  rhythm: { name: '节奏', desc: '语速与停顿是否落在舒服的区间' },
  vocabulary: { name: '用词', desc: '词汇丰富度与口头禅密度' },
  energy: { name: '声音', desc: '音量起伏与表达的能量感' },
  completion: { name: '完成度', desc: '是否在目标时长内把话说完' }
}

const FILLER_SOURCE = '嗯+|呃+|啊+|那个|就是说|然后呢|对吧|其实吧|怎么说呢|你知道吗|这个这个'
const FILLER_RE = new RegExp(FILLER_SOURCE, 'g')
const FILLER_TYPES = ['嗯', '呃', '啊', '那个', '就是说', '然后呢', '对吧', '其实吧', '怎么说呢', '你知道吗', '这个这个']

const OPENINGS = [
  { word: '我认为', label: '明确观点' },
  { word: '我觉得', label: '明确观点' },
  { word: '我的观点', label: '明确观点' },
  { word: '我想说', label: '明确观点' },
  { word: '今天我想', label: '主题引入' },
  { word: '今天分享', label: '主题引入' },
  { word: '先说结论', label: '结论先行' },
  { word: '结论是', label: '结论先行' },
  { word: '我想聊聊', label: '主题引入' },
  { word: '先说一个事', label: '故事开场' }
]

const TRANSITIONS = [
  { word: '第一', label: '分点' },
  { word: '第二', label: '分点' },
  { word: '第三', label: '分点' },
  { word: '首先', label: '分点' },
  { word: '其次', label: '分点' },
  { word: '另外', label: '补充' },
  { word: '再者', label: '补充' },
  { word: '因为', label: '因果' },
  { word: '所以', label: '因果' },
  { word: '但是', label: '转折' },
  { word: '不过', label: '转折' },
  { word: '举个例子', label: '举例' },
  { word: '比如', label: '举例' },
  { word: '换句话说', label: '解释' }
]

const CLOSINGS = [
  { word: '所以', label: '总结' },
  { word: '总之', label: '总结' },
  { word: '综上', label: '总结' },
  { word: '最后', label: '收尾' },
  { word: '一句话', label: '收尾' },
  { word: '所以我想说', label: '回扣观点' },
  { word: '这就是', label: '收尾' },
  { word: '希望对你有用', label: '收束' },
  { word: '谢谢大家', label: '致谢' },
  { word: '我的分享完了', label: '收束' }
]

const NEXT_FOCUS = {
  content: '下次把题目要点逐条讲完，每条后面补一个具体例子。',
  structure: '下次先说结论，再用「第一、第二」展开，最后用一句话收回。',
  fluency: '下次把超过 1.5 秒的停顿压下去，接不上就用「换句话说」过渡。',
  rhythm: '下次把语速稳在每分钟 240 字左右，句尾停半拍。',
  vocabulary: '下次把「那个、就是说」换成具体名词，每段只留一个口头禅。',
  energy: '下次重点句主动提高音量，句尾别往下掉。',
  completion: '下次至少说满目标时长，再用一句话收尾。'
}

const VERDICT = {
  content: '内容有方向，但要点还没铺满。',
  structure: '信息是有的，骨架还不够清楚。',
  fluency: '想表达的东西在，停顿把连贯性切碎了。',
  rhythm: '整体能听懂，节奏还需要更稳。',
  vocabulary: '意思到了，用词还可以更具体。',
  energy: '话说完了，声音还差一点支撑。',
  completion: '这次开口时间偏短，先把长度练出来。'
}

/* ==========================================================
   一、PCM 声学分析
   ========================================================== */

/**
 * @param {ArrayBuffer} buffer 16kHz / 16bit / 单声道 PCM
 * @param {number} sampleRate
 */
function analyzePcm(buffer, sampleRate) {
  const sr = sampleRate || 16000
  const byteLength = buffer && buffer.byteLength ? buffer.byteLength : 0
  const totalSamples = Math.floor(byteLength / 2)
  const duration = totalSamples / sr

  const empty = {
    duration: util.round(duration, 2),
    hasVoice: false,
    speechRatio: 0,
    speechSeconds: 0,
    pauseCount: 0,
    longPauseCount: 0,
    pausesPerMinute: 0,
    longestPause: 0,
    pauseSeconds: 0,
    volumeMean: 0,
    volumePeak: 0,
    energyCV: 0,
    pauses: [],
    waveform: new Array(32).fill(0.06),
    confidence: 0
  }

  if (!buffer || duration < 0.2) return empty

  const view = new DataView(buffer)
  const frameSamples = Math.max(80, Math.round(sr * 0.02))
  const frameCount = Math.floor(totalSamples / frameSamples)
  if (frameCount < 2) return empty

  const rms = new Float32Array(frameCount)
  let peak = 0

  for (let f = 0; f < frameCount; f++) {
    let sum = 0
    const start = f * frameSamples
    for (let i = 0; i < frameSamples; i++) {
      const v = view.getInt16((start + i) * 2, true) / 32768
      sum += v * v
      const abs = Math.abs(v)
      if (abs > peak) peak = abs
    }
    rms[f] = Math.sqrt(sum / frameSamples)
  }

  // 噪声底：取 15 分位
  const sorted = Array.from(rms).sort((a, b) => a - b)
  const noise = sorted[Math.floor(sorted.length * 0.15)] || 0
  const threshold = util.clamp(noise * 2.3 + 0.002, 0.0055, 0.03)

  // 二值化
  let active = new Uint8Array(frameCount)
  for (let i = 0; i < frameCount; i++) active[i] = rms[i] > threshold ? 1 : 0

  // 补洞：小于 6 帧（120ms）的静音视作发声
  const closed = active.slice()
  let runStart = -1
  for (let i = 0; i <= frameCount; i++) {
    const v = i < frameCount ? active[i] : 1
    if (v === 0 && runStart === -1) runStart = i
    if (v === 1 && runStart !== -1) {
      const len = i - runStart
      if (len <= 6 && runStart > 0 && i < frameCount) {
        for (let j = runStart; j < i; j++) closed[j] = 1
      }
      runStart = -1
    }
  }

  // 找出发声段
  const segments = []
  let segStart = -1
  for (let i = 0; i <= frameCount; i++) {
    const v = i < frameCount ? closed[i] : 0
    if (v === 1 && segStart === -1) segStart = i
    if (v === 0 && segStart !== -1) {
      segments.push({ start: segStart * frameSamples / sr, end: i * frameSamples / sr })
      segStart = -1
    }
  }

  // 合并 250ms 以内的碎片
  const merged = []
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    const last = merged[merged.length - 1]
    if (last && s.start - last.end < 0.25) {
      last.end = s.end
    } else {
      merged.push({ start: s.start, end: s.end })
    }
  }

  const speechSegments = merged.filter(s => s.end - s.start >= 0.1)
  if (!speechSegments.length) return empty

  let speechSeconds = 0
  const energyList = []
  let volumeSum = 0
  let energyFrames = 0

  for (let s = 0; s < speechSegments.length; s++) {
    const seg = speechSegments[s]
    speechSeconds += seg.end - seg.start
    const f0 = Math.max(0, Math.floor(seg.start * sr / frameSamples))
    const f1 = Math.min(frameCount - 1, Math.ceil(seg.end * sr / frameSamples))
    for (let f = f0; f <= f1; f++) {
      volumeSum += rms[f]
      energyList.push(rms[f])
      energyFrames++
    }
  }

  const pauses = []
  let pauseSeconds = 0
  for (let i = 1; i < speechSegments.length; i++) {
    const gap = speechSegments[i].start - speechSegments[i - 1].end
    if (gap >= 0.3) {
      pauses.push({
        start: util.round(speechSegments[i - 1].end, 2),
        seconds: util.round(gap, 2)
      })
      pauseSeconds += gap
    }
  }

  const longest = pauses.reduce((m, p) => Math.max(m, p.seconds), 0)
  const longPauseCount = pauses.filter(p => p.seconds >= 1.5).length
  const volumeMean = energyFrames ? volumeSum / energyFrames : 0

  let variance = 0
  if (energyFrames) {
    for (let i = 0; i < energyList.length; i++) {
      const d = energyList[i] - volumeMean
      variance += d * d
    }
    variance /= energyFrames
  }
  const std = Math.sqrt(variance)
  const energyCV = volumeMean > 0 ? std / volumeMean : 0

  const speechRatio = util.clamp(speechSeconds / Math.max(duration, 0.01), 0, 1)
  const span = speechSegments[speechSegments.length - 1].end - speechSegments[0].start
  const pausesPerMinute = speechSeconds > 1 ? pauses.length / (speechSeconds / 60) : 0

  // 32 段波形，用于界面展示
  const waveform = []
  const bucket = Math.max(1, Math.floor(frameCount / 32))
  for (let i = 0; i < 32; i++) {
    let sum = 0
    let count = 0
    for (let j = i * bucket; j < Math.min(frameCount, (i + 1) * bucket); j++) {
      sum += rms[j]
      count++
    }
    const v = count ? sum / count : 0
    waveform.push(util.clamp(v / Math.max(0.03, peak * 0.8), 0.05, 1))
  }

  return {
    duration: util.round(duration, 2),
    hasVoice: speechSeconds >= 0.5,
    speechRatio: util.round(speechRatio, 3),
    speechSeconds: util.round(speechSeconds, 2),
    pauseCount: pauses.length,
    longPauseCount,
    pausesPerMinute: util.round(pausesPerMinute, 1),
    longestPause: util.round(longest, 2),
    pauseSeconds: util.round(pauseSeconds, 2),
    volumeMean: util.round(volumeMean, 4),
    volumePeak: util.round(peak, 4),
    energyCV: util.round(energyCV, 3),
    pauses: pauses.sort((a, b) => b.seconds - a.seconds).slice(0, 4),
    waveform,
    confidence: util.round(util.clamp(span / Math.max(duration, 0.01), 0, 1), 2)
  }
}

/**
 * 给 PCM 加 WAV 头，方便 InnerAudioContext 播放与本地存档
 */
function pcmToWav(pcmBuffer, sampleRate) {
  const sr = sampleRate || 16000
  const dataLength = pcmBuffer.byteLength
  const out = new ArrayBuffer(44 + dataLength)
  const view = new DataView(out)
  const bytes = new Uint8Array(out)

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) bytes[offset + i] = str.charCodeAt(i)
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sr, true)
  view.setUint32(28, sr * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)
  new Uint8Array(out, 44).set(new Uint8Array(pcmBuffer))
  return out
}

/* ==========================================================
   二、文本分析
   ========================================================== */

function countChinese(text) {
  const m = String(text || '').match(/[\u4e00-\u9fa5]/g)
  return m ? m.length : 0
}

function findSignal(text, list) {
  const hits = []
  for (let i = 0; i < list.length; i++) {
    if (text.indexOf(list[i].word) !== -1) hits.push(list[i])
  }
  return hits
}

function mentionScore(point, text) {
  if (!point) return 0
  const keywords = (point.keywords || []).filter(Boolean)
  for (let i = 0; i < keywords.length; i++) {
    if (keywords[i] && text.indexOf(keywords[i]) !== -1) return 1
  }
  const label = String(point.label || '').replace(/[，。、；：！？\s“”‘’（）()]/g, '')
  if (label && text.indexOf(label) !== -1) return 1
  // 退化为二字切片覆盖
  if (label.length >= 4) {
    const grams = []
    for (let i = 0; i < label.length - 1; i++) grams.push(label.slice(i, i + 2))
    const hit = grams.filter(g => text.indexOf(g) !== -1).length
    if (grams.length && hit / grams.length >= 0.5) return 0.8
  }
  return 0
}

function splitSentences(text) {
  return String(text || '')
    .split(/[。！？!?；;\n]+/)
    .map(s => s.replace(/^[\s，,、]+|[\s，,、]+$/g, ''))
    .filter(s => s.length >= 3)
}

/**
 * @param {string} transcript
 * @param {number} duration 秒
 * @param {object} question
 */
function analyzeText(transcript, duration, question) {
  const raw = String(transcript || '').trim()
  const text = raw.replace(/\s+/g, '')
  const chars = countChinese(text) || text.length
  const fillerMatches = text.match(FILLER_RE) || []
  const fillerCount = fillerMatches.length
  const sentences = splitSentences(raw)
  const uniqueChars = new Set(text.replace(/[^\u4e00-\u9fa5]/g, '').split('')).size
  const ttr = chars > 0 ? uniqueChars / chars : 0

  const openings = findSignal(text, OPENINGS)
  const transitions = findSignal(text, TRANSITIONS)
  const closings = findSignal(text, CLOSINGS)

  const points = Array.isArray(question && question.keyPoints) ? question.keyPoints : []
  const deliveryOnly = question && (question.scoreProfile === 'delivery' || question.mode === 'read')
  const pointScores = points.map(p => ({ label: p.label, score: mentionScore(p, text) }))
  const matchedPoints = pointScores.filter(p => p.score >= 0.8)
  const missedPoints = pointScores.filter(p => p.score < 0.5)
  const coverage = deliveryOnly || !pointScores.length
    ? null
    : pointScores.reduce((sum, p) => sum + p.score, 0) / pointScores.length

  const pace = duration > 0 ? chars / (duration / 60) : 0
  const fillerPer100 = chars > 0 ? fillerCount / chars * 100 : 0
  const avgSentence = sentences.length ? chars / sentences.length : chars

  return {
    present: chars >= 12,
    chars,
    raw,
    sentences,
    sentenceCount: sentences.length,
    avgSentence: util.round(avgSentence, 1),
    uniqueChars,
    ttr: util.round(ttr, 3),
    fillerCount,
    fillerPer100: util.round(fillerPer100, 2),
    fillerWords: Array.from(new Set(fillerMatches)).slice(0, 4),
    openings,
    openingWord: openings.length ? openings[0].word : '',
    transitions,
    transitionCount: transitions.length,
    transitionWords: transitions.slice(0, 5).map(t => t.word),
    closings,
    closingWord: closings.length ? closings[0].word : '',
    hasOpening: openings.length > 0,
    hasClosing: closings.length > 0,
    pointScores,
    matchedPoints,
    missedPoints,
    coverage: coverage === null ? null : util.round(coverage, 3),
    pace: util.round(pace, 0),
    deliveryOnly: !!deliveryOnly
  }
}

/* ==========================================================
   三、评分
   ========================================================== */

function piecewise(value, points) {
  // points: [[x, y], ...] 升序
  if (value <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    if (value <= points[i][0]) {
      const [x0, y0] = points[i - 1]
      const [x1, y1] = points[i]
      const r = (value - x0) / (x1 - x0 || 1)
      return y0 + (y1 - y0) * r
    }
  }
  return points[points.length - 1][1]
}

function scoreFluency(audio) {
  if (!audio.hasVoice) return 25
  let s = piecewise(audio.speechRatio, [
    [0.25, 28], [0.4, 45], [0.55, 62], [0.65, 72], [0.75, 82], [0.85, 90], [0.95, 96]
  ])
  s -= Math.min(18, audio.longPauseCount * 7)
  s -= util.clamp((audio.pausesPerMinute - 7) * 2.2, 0, 10)
  if (audio.duration < 3) s = Math.min(s, 32)
  return Math.round(util.clamp(s, 20, 98))
}

function paceScore(pace) {
  if (!pace) return 55
  return piecewise(pace, [
    [70, 35], [110, 50], [140, 64], [170, 76], [200, 88], [230, 96], [280, 94], [320, 85], [360, 72], [430, 55], [520, 38]
  ])
}

function scoreRhythm(audio, text, question) {
  if (!audio.hasVoice) return 25
  const pauseScore = util.clamp(
    95 - audio.longPauseCount * 12 - Math.max(0, audio.pausesPerMinute - 8) * 2,
    30,
    98
  )
  const target = Math.max((question && question.minSeconds) || 45, 10)
  const durationRatio = audio.duration / target
  let durationScore
  if (audio.duration > ((question && question.maxSeconds) || 120) * 1.02) durationScore = 84
  else {
    durationScore = piecewise(durationRatio, [
      [0.2, 32], [0.4, 52], [0.6, 68], [0.8, 84], [1, 93], [1.2, 94], [2, 88]
    ])
  }

  if (text && text.present) {
    const ps = paceScore(text.pace)
    return Math.round(util.clamp(ps * 0.55 + pauseScore * 0.25 + durationScore * 0.2, 20, 98))
  }
  return Math.round(util.clamp(pauseScore * 0.62 + durationScore * 0.38, 20, 98))
}

function scoreEnergy(audio) {
  if (!audio.hasVoice) return 25
  const cv = audio.energyCV
  const cvScore = piecewise(cv, [
    [0.03, 52], [0.06, 62], [0.1, 74], [0.16, 86], [0.25, 92], [0.45, 90], [0.7, 80], [1.1, 66]
  ])
  const mean = audio.volumeMean
  const volumeScore = piecewise(mean, [
    [0.004, 50], [0.01, 62], [0.02, 74], [0.04, 86], [0.08, 92], [0.16, 88], [0.3, 80]
  ])
  return Math.round(util.clamp(cvScore * 0.6 + volumeScore * 0.4, 25, 97))
}

function scoreCompletion(audio, question) {
  if (!audio.hasVoice) return 10
  const target = Math.max((question && question.minSeconds) || 45, 5)
  const max = (question && question.maxSeconds) || 120
  if (audio.duration > max * 1.02) return 86
  const ratio = audio.duration / target
  if (ratio >= 1) return Math.round(util.clamp(94 + Math.min(4, (audio.duration - target) / 45 * 2), 94, 98))
  return Math.round(util.clamp(94 * Math.pow(ratio, 0.78), 12, 94))
}

function scoreContent(text, question) {
  if (!text || !text.present || text.deliveryOnly) return null
  const chars = text.chars
  const expected = Math.max(45, ((question && question.minSeconds) || 45) * 3.0)
  const lengthScore = util.clamp(chars / expected, 0, 1) * 12
  let base
  if (text.coverage === null) {
    base = 64 + lengthScore * 2
  } else {
    base = 46 + text.coverage * 44 + lengthScore
  }
  if (chars < expected * 0.35) base = Math.min(base, 56)
  if (text.coverage !== null && text.coverage === 0) base = Math.min(base, 55)
  return Math.round(util.clamp(base, 35, 98))
}

function scoreStructure(text, question) {
  if (!text || !text.present || text.deliveryOnly) return null
  let s = 44
  if (text.hasOpening) s += 14
  if (text.hasClosing) s += 18
  s += Math.min(text.transitionCount, 3) * 9
  if (text.sentenceCount >= 3) s += 6
  if (text.chars >= 120) s += 3
  return Math.round(util.clamp(s, 40, 98))
}

function scoreVocabulary(text, question) {
  if (!text || !text.present || text.deliveryOnly) return null
  let s = 52 + (text.ttr - 0.4) * 110
  if (text.uniqueChars >= 90) s += 3
  if (text.chars < 40) s -= 10
  s -= Math.min(16, text.fillerPer100 * 3.2)
  return Math.round(util.clamp(s, 35, 97))
}

function buildDimensions(audio, text, question) {
  const dims = []
  const hasText = !!(text && text.present && !text.deliveryOnly)

  if (hasText) {
    dims.push({
      key: 'content',
      name: DIM_META.content.name,
      score: scoreContent(text, question),
      weight: 0.22,
      detail: text.coverage === null
        ? text.chars + ' 字'
        : '要点覆盖 ' + text.matchedPoints.length + '/' + text.pointScores.length + ' · ' + text.chars + ' 字'
    })
    dims.push({
      key: 'structure',
      name: DIM_META.structure.name,
      score: scoreStructure(text, question),
      weight: 0.2,
      detail: '开场' + (text.hasOpening ? ' ✓' : ' —') + ' · 过渡 ' + text.transitionCount + ' · 收尾' + (text.hasClosing ? ' ✓' : ' —')
    })
  }

  dims.push({
    key: 'fluency',
    name: DIM_META.fluency.name,
    score: scoreFluency(audio),
    weight: hasText ? 0.17 : 0.36,
    detail: '有效发声 ' + util.pct(audio.speechRatio) + '% · 长停顿 ' + audio.longPauseCount + ' 次'
  })
  dims.push({
    key: 'rhythm',
    name: DIM_META.rhythm.name,
    score: scoreRhythm(audio, text, question),
    weight: hasText ? 0.13 : 0.26,
    detail: hasText
      ? '语速 ' + text.pace + ' 字/分 · 停顿 ' + audio.pauseCount + ' 次'
      : '停顿 ' + audio.pauseCount + ' 次 · 平均 ' + util.round(audio.pausesPerMinute, 1) + ' 次/分'
  })

  if (hasText) {
    dims.push({
      key: 'vocabulary',
      name: DIM_META.vocabulary.name,
      score: scoreVocabulary(text, question),
      weight: 0.1,
      detail: '用词丰富度 ' + text.ttr + ' · 口头禅 ' + text.fillerCount + ' 次'
    })
  }

  dims.push({
    key: 'energy',
    name: DIM_META.energy.name,
    score: scoreEnergy(audio),
    weight: hasText ? 0.08 : 0.16,
    detail: '起伏 ' + audio.energyCV + ' · 音量 ' + audio.volumeMean
  })
  dims.push({
    key: 'completion',
    name: DIM_META.completion.name,
    score: scoreCompletion(audio, question),
    weight: hasText ? 0.1 : 0.22,
    detail: util.round(audio.duration, 0) + ' 秒 / 目标 ' + ((question && question.minSeconds) || 45) + ' 秒'
  })

  return dims
}

function overallScore(dims, text) {
  const usable = dims.filter(d => d.weight > 0 && typeof d.score === 'number')
  const totalWeight = usable.reduce((s, d) => s + d.weight, 0)
  if (!totalWeight) return 0
  let overall = usable.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight
  if (text && text.present && text.fillerPer100 > 3) {
    overall -= Math.min(6, (text.fillerPer100 - 3) * 1.2)
  }
  return Math.round(util.clamp(overall, 20, 99))
}

/* ==========================================================
   四、教练点评
   ========================================================== */

function extractQuote(transcript) {
  const sentences = splitSentences(transcript)
  const candidates = sentences.filter(s => {
    const len = countChinese(s)
    if (len < 10 || len > 46) return false
    const fillers = (s.match(FILLER_RE) || []).length
    if (fillers > 1) return false
    return true
  })
  if (!candidates.length) return ''
  const insight = ['其实', '真正', '重要', '因为', '所以', '我发现', '如果', '应该', '关键', '值得']
  let best = candidates[0]
  let bestScore = -1
  for (let i = 0; i < candidates.length; i++) {
    const s = candidates[i]
    let score = 0
    if (findSignal(s, OPENINGS).length) score += 2
    if (findSignal(s, CLOSINGS).length) score += 2
    if (findSignal(s, TRANSITIONS).length) score += 1
    if (insight.some(w => s.indexOf(w) !== -1)) score += 2
    const len = countChinese(s)
    if (len >= 18 && len <= 34) score += 2
    if (score > bestScore) {
      bestScore = score
      best = s
    }
  }
  return bestScore >= 2 ? best : ''
}

function stripEnd(text) {
  return String(text || '').replace(/[。！？!?；;，,、\s]+$/, '')
}

function buildCoach(audio, text, dims, question) {
  const rand = util.mulberry32(util.hashString(
    (question && question.id || 'q') + '|' + Math.round(audio.duration) + '|' + (text ? text.chars : 0)
  ))
  const pick = arr => arr[Math.floor(rand() * arr.length)]

  const hasText = !!(text && text.present && !text.deliveryOnly)
  const dimMap = {}
  dims.forEach(d => { dimMap[d.key] = d.score })
  const lowest = dims
    .filter(d => d.weight > 0)
    .slice()
    .sort((a, b) => a.score - b.score)[0] || { key: 'completion' }

  const strengths = []
  const weaknesses = []
  const evidence = []

  const quote = hasText ? extractQuote(text.raw) : ''
  if (quote) evidence.push({ type: 'text', label: '你的原话', text: quote })
  if (audio.longestPause >= 1.5) {
    const p = audio.pauses[0]
    evidence.push({
      type: 'audio',
      label: '停顿位置',
      text: util.clock(p.start) + ' 处停顿约 ' + p.seconds + ' 秒'
    })
  }
  if (hasText && text.fillerCount > 0) {
    evidence.push({
      type: 'text',
      label: '口头禅',
      text: '「' + text.fillerWords.join('、') + '」共 ' + text.fillerCount + ' 次'
    })
  }
  if (!evidence.length) {
    evidence.push({
      type: 'audio',
      label: '声音事实',
      text: '有效发声 ' + util.pct(audio.speechRatio) + '% · 录音 ' + Math.round(audio.duration) + ' 秒'
    })
  }

  if (dimMap.completion >= 86) {
    strengths.push('完整说满了 ' + Math.round(audio.duration) + ' 秒，没有中途放弃。')
  }
  if (dimMap.fluency >= 85) {
    strengths.push('有效发声占 ' + util.pct(audio.speechRatio) + '%，整体是连贯的。')
  }
  if (dimMap.structure >= 78 && hasText && text.hasOpening) {
    strengths.push('开头用了「' + text.openingWord + '」，听众一下就抓到方向。')
  }
  if (hasText && text.coverage !== null && text.coverage >= 0.7 && text.matchedPoints.length) {
    strengths.push('「' + text.matchedPoints[0].label + '」讲到了，内容没有跑题。')
  }
  if (hasText && text.fillerPer100 <= 1 && text.chars > 40) {
    strengths.push('全段几乎听不到口头禅，语言很干净。')
  }
  if (hasText && text.pace >= 200 && text.pace <= 300) {
    strengths.push('语速 ' + text.pace + ' 字/分钟，落在让人跟得上的区间。')
  }
  if (dimMap.energy >= 85) {
    strengths.push('重点句有明显音量起伏，不是平着念完。')
  }
  if (audio.longPauseCount === 0 && audio.hasVoice) {
    strengths.push('没有超过 1.5 秒的长停顿，节奏没有断。')
  }
  if (!strengths.length) {
    strengths.push('这次你确实开口了 ' + Math.round(audio.duration) + ' 秒，先完成，再完美。')
  }

  if (!audio.hasVoice) {
    weaknesses.push('几乎没有检测到有效人声，先确认麦克风距离和录音环境。')
  }
  if (audio.longestPause >= 1.5) {
    const p = audio.pauses[0]
    weaknesses.push('最长一次停顿 ' + p.seconds + ' 秒，发生在 ' + util.clock(p.start) + '，听众会以为你说完了。')
  }
  if (audio.hasVoice && audio.speechRatio < 0.7) {
    weaknesses.push('有效发声只占 ' + util.pct(audio.speechRatio) + '%，停顿吃掉了 ' + Math.round(audio.pauseSeconds) + ' 秒。')
  }
  if (audio.hasVoice && audio.duration < ((question && question.minSeconds) || 45) * 0.78) {
    weaknesses.push('只讲了 ' + Math.round(audio.duration) + ' 秒，离 ' + ((question && question.minSeconds) || 45) + ' 秒的目标还差一截，观点没展开。')
  }
  if (hasText && text.fillerPer100 > 3) {
    weaknesses.push('「' + text.fillerWords[0] + '」这类口头禅平均每 100 字 ' + text.fillerPer100 + ' 次，会稀释重点。')
  }
  if (hasText && !text.hasClosing) {
    weaknesses.push('结尾没有收束句，最后一句停在半空。')
  }
  if (hasText && text.coverage !== null && text.coverage < 0.5 && text.missedPoints.length) {
    weaknesses.push('「' + text.missedPoints[0].label + '」这个要点没有讲到。')
  }
  if (hasText && (text.pace < 165 || text.pace > 340)) {
    weaknesses.push('语速 ' + text.pace + ' 字/分钟，' + (text.pace < 165 ? '偏慢，句子之间容易散' : '偏快，听众需要费力跟') + '。')
  }
  if (dimMap.energy < 65 && audio.hasVoice) {
    weaknesses.push('音量几乎是平的，重点句没有被抬起来。')
  }
  if (!weaknesses.length) {
    weaknesses.push('这遍没有明显硬伤，下一步是提高信息密度，而不是继续加长。')
  }

  let nextFocus = NEXT_FOCUS[lowest.key] || NEXT_FOCUS.completion
  if (nextFocus === NEXT_FOCUS.completion && !audio.hasVoice) {
    nextFocus = '下次先确认麦克风能收到声音，再开始完整的一次表达。'
  }

  const verdict = VERDICT[lowest.key] || VERDICT.completion
  const reasoningParts = []
  reasoningParts.push('这段录音 ' + Math.round(audio.duration) + ' 秒，有效发声 ' + util.pct(audio.speechRatio) + '%')
  if (audio.longestPause >= 1.5) {
    reasoningParts.push('最长停顿 ' + audio.pauses[0].seconds + ' 秒出现在 ' + util.clock(audio.pauses[0].start))
  }
  if (quote) {
    reasoningParts.push('你说「' + util.truncate(stripEnd(quote), 26) + '」')
  }
  reasoningParts.push('综合看，' + verdict)

  const shared = []
  const uniq = arr => arr.filter((v, i) => arr.indexOf(v) === i)
  const finalStrengths = uniq(strengths).slice(0, 2)
  const finalWeaknesses = uniq(weaknesses).slice(0, 2)
  shared.push(pick(['先看事实：', '先把事实摆出来：']))

  return {
    reasoning: shared[0] + reasoningParts.join('；') + '。',
    strengths: finalStrengths,
    weaknesses: finalWeaknesses,
    nextFocus,
    evidence,
    primaryIssue: lowest.key,
    quote
  }
}

/* ==========================================================
   五、组装报告
   ========================================================== */

function gradeOf(overall) {
  if (overall >= 90) return { label: '卓越', tone: 'gold', title: '这一遍，可以留下。', line: '结构、内容和声音都立住了。' }
  if (overall >= 82) return { label: '优秀', tone: 'green', title: '稳稳地说完了。', line: '骨架已经成形，再收一刀就更好。' }
  if (overall >= 72) return { label: '良好', tone: 'green', title: '方向是对的。', line: '把最弱的一项收一收，下一次会更利落。' }
  if (overall >= 60) return { label: '及格', tone: 'brass', title: '先立结构。', line: '内容不缺，缺的是一个让人跟得住的骨架。' }
  return { label: '起步', tone: 'muted', title: '先完成，再完美。', line: '今天先把开口这件事做成，分数下一轮再拿。' }
}

/**
 * @param {object} input
 * @param {object} input.question
 * @param {object} input.audio analyzePcm 的结果
 * @param {string} [input.transcript]
 * @param {string} [input.source]
 * @param {string} [input.id]
 * @param {string} [input.date]
 * @param {boolean} [input.locked]
 */
function buildReport(input) {
  const question = input.question || {}
  const audio = input.audio || analyzePcm(new ArrayBuffer(0))
  const transcript = input.transcript || ''
  const text = analyzeText(transcript, audio.duration, question)
  const dims = buildDimensions(audio, text, question)
  const overall = overallScore(dims, text)
  const grade = gradeOf(overall)
  const coach = buildCoach(audio, text, dims, question)
  const quote = text.present ? extractQuote(transcript) : ''

  return {
    id: input.id || util.uid('rep'),
    createdAt: Date.now(),
    date: input.date || util.dateKey(),
    source: input.source || 'practice',
    question: {
      id: question.id || '',
      title: question.title || '',
      prompt: question.prompt || '',
      categoryId: question.categoryId || '',
      categoryName: question.categoryName || '',
      minSeconds: question.minSeconds || 45,
      maxSeconds: question.maxSeconds || 90,
      keyPoints: question.keyPoints || [],
      mode: question.mode || 'speak',
      scoreProfile: question.scoreProfile || 'full'
    },
    audio: {
      duration: audio.duration,
      hasVoice: audio.hasVoice,
      speechRatio: audio.speechRatio,
      speechSeconds: audio.speechSeconds,
      pauseCount: audio.pauseCount,
      longPauseCount: audio.longPauseCount,
      pausesPerMinute: audio.pausesPerMinute,
      longestPause: audio.longestPause,
      pauseSeconds: audio.pauseSeconds,
      volumeMean: audio.volumeMean,
      volumePeak: audio.volumePeak,
      energyCV: audio.energyCV,
      pauses: audio.pauses,
      waveform: audio.waveform,
      confidence: audio.confidence
    },
    transcript: transcript,
    // 文字稿只能补一次；audioKey 把文字稿与当次录音绑定
    // 直接带文字稿生成的报告同样视为已锁定，避免绕过页面校验反复重算
    transcriptLocked: typeof input.transcriptLocked === 'boolean'
      ? input.transcriptLocked
      : !!transcript,
    transcriptSubmittedAt: input.transcriptSubmittedAt || (transcript ? Date.now() : 0),
    audioKey: audioFingerprint(audio),
    text: text.present ? {
      chars: text.chars,
      pace: text.pace,
      fillerCount: text.fillerCount,
      fillerPer100: text.fillerPer100,
      fillerWords: text.fillerWords,
      ttr: text.ttr,
      coverage: text.coverage,
      hasOpening: text.hasOpening,
      hasClosing: text.hasClosing,
      transitionCount: text.transitionCount,
      matchedPoints: text.matchedPoints.map(p => p.label),
      missedPoints: text.missedPoints.map(p => p.label)
    } : null,
    dimensions: dims,
    overall,
    grade,
    coach,
    quote,
    locked: !!input.locked,
    version: '2.0'
  }
}

/**
 * 录音指纹：把声音事实压成短签名。
 * 补写文字稿时必须校验签名一致，避免用另一段录音的数据重算本次报告。
 */
function audioFingerprint(audio) {
  const a = audio || {}
  return [
    Number(a.duration || 0).toFixed(2),
    Number(a.speechRatio || 0).toFixed(3),
    Number(a.pauseCount || 0),
    Number(a.longestPause || 0).toFixed(2),
    Number(a.volumeMean || 0).toFixed(4),
    Number(a.energyCV || 0).toFixed(4)
  ].join('|')
}

function aggregateDimensions(reports) {
  const map = {}
  ;(reports || []).forEach(r => {
    ;((r && r.dimensions) || []).forEach(d => {
      if (!d || d.weight === 0) return
      if (!map[d.key]) map[d.key] = { key: d.key, name: d.name, total: 0, count: 0 }
      map[d.key].total += d.score
      map[d.key].count++
    })
  })
  const order = ['content', 'structure', 'fluency', 'rhythm', 'vocabulary', 'energy', 'completion']
  return order
    .filter(k => map[k])
    .map(k => ({
      key: k,
      name: map[k].name,
      value: Math.round(map[k].total / map[k].count)
    }))
}

module.exports = {
  DIM_META,
  analyzePcm,
  pcmToWav,
  analyzeText,
  buildReport,
  audioFingerprint,
  aggregateDimensions,
  extractQuote,
  scoreFluency,
  scoreRhythm,
  scoreEnergy,
  scoreCompletion,
  gradeOf
}
