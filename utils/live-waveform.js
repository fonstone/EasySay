/**
 * 实时录音波形
 * -------------------------------------------------
 * 唯一的输入是 RecorderManager.onFrameRecorded 回调里的真实 PCM 帧，
 * 按帧计算 RMS（均方根振幅）并做自适应归一化，再环形映射成 N 根柱子。
 *
 * 这里不生成任何 Math.sin 假数据：没有音频帧时，调用方应当显示
 *「等待音频帧」而不是画一条看起来像声音的曲线。
 *
 * 纯 JS，无 wx 依赖，可直接在 Node 里喂 ArrayBuffer 做回归测试。
 */

/** 16bit / 单声道 PCM 帧的均方根振幅，取值 0..1 */
function frameRms(buffer) {
  if (!buffer || !buffer.byteLength || buffer.byteLength < 2) return 0
  let view
  try {
    view = new DataView(buffer)
  } catch (e) {
    return 0
  }
  const n = Math.floor(buffer.byteLength / 2)
  if (!n) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const v = view.getInt16(i * 2, true) / 32768
    sum += v * v
  }
  return Math.sqrt(sum / n)
}

/**
 * @param {number} count 柱子数量（建议 24）
 * 返回对象：pushFrame(buffer) 喂帧，getBars() 取当前柱子，getStats() 取诊断信息
 */
function createLiveWaveform(count) {
  const size = Math.max(8, Math.min(64, Number(count) || 24))
  const values = new Array(size).fill(0)
  let cursor = 0
  let filled = 0
  let frames = 0
  let peak = 0.02
  let lastRms = 0

  function pushFrame(buffer) {
    const rms = frameRms(buffer)
    frames++
    lastRms = rms
    // 峰值缓慢回落，避免一次大音量之后整段波形被压平
    peak = Math.max(peak * 0.997, rms, 0.02)
    values[cursor] = rms
    cursor = (cursor + 1) % size
    filled = Math.min(size, filled + 1)
    return rms
  }

  function getBars() {
    const scale = Math.max(0.02, peak) * 0.85
    const bars = []
    for (let i = 0; i < size; i++) {
      // 从最旧的一帧开始输出，最新的始终在最右边
      const idx = filled < size ? i : (cursor + i) % size
      const rms = i < filled ? values[idx] : 0
      const ratio = Math.min(1, rms / scale)
      bars.push({
        id: i,
        h: 6 + Math.round(Math.pow(ratio, 0.72) * 90),
        live: i < filled
      })
    }
    return bars
  }

  function getStats() {
    return {
      frames,
      filled,
      peak: Math.round(peak * 10000) / 10000,
      lastRms: Math.round(lastRms * 10000) / 10000,
      hasSignal: frames > 0 && peak > 0.005
    }
  }

  function reset() {
    values.fill(0)
    cursor = 0
    filled = 0
    frames = 0
    peak = 0.02
    lastRms = 0
  }

  return { pushFrame, getBars, getStats, reset, size }
}

module.exports = {
  frameRms,
  createLiveWaveform
}
