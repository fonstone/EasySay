/**
 * 录音管理器单例封装
 * 避免多个页面重复注册 RecorderManager 回调导致重复触发。
 *
 * onFrameRecorded 是录音页真实波形的唯一数据源：
 * 只有 PCM 格式 + frameSize 才会回吐音频帧，帧里是 16bit 单声道裸 PCM。
 * 设备不支持该回调时 start() 仍然可用，页面会显示「等待音频帧」而不是假波形。
 */

let manager = null
let handlers = {}

function ensure() {
  if (manager) return manager
  manager = wx.getRecorderManager()
  manager.onStart(() => {
    if (handlers.onStart) handlers.onStart()
  })
  manager.onStop(res => {
    if (handlers.onStop) handlers.onStop(res || {})
  })
  manager.onError(err => {
    if (handlers.onError) handlers.onError(err || {})
  })
  manager.onInterruptionBegin(() => {
    if (handlers.onInterruption) handlers.onInterruption('begin')
  })
  manager.onInterruptionEnd(() => {
    if (handlers.onInterruption) handlers.onInterruption('end')
  })
  if (typeof manager.onFrameRecorded === 'function') {
    manager.onFrameRecorded(res => {
      if (handlers.onFrame) handlers.onFrame(res || {})
    })
  }
  return manager
}

function setHandlers(next) {
  handlers = next || {}
  ensure()
}

function start(options) {
  ensure()
  const config = Object.assign({}, options || {})
  // 4KB ≈ 125ms 一帧（16kHz / 16bit / 单声道）；真机上以此驱动实时波形
  if (config.format === 'PCM' && typeof manager.onFrameRecorded === 'function' && !config.frameSize) {
    config.frameSize = 4
  }
  manager.start(config)
}

/** 设备是否真的会回吐音频帧，供页面决定显示真实波形还是等待提示 */
function supportsFrames() {
  ensure()
  return typeof manager.onFrameRecorded === 'function'
}

function stop() {
  if (manager) manager.stop()
}

function pause() {
  if (manager) manager.pause()
}

function resume() {
  if (manager) manager.resume()
}

module.exports = {
  setHandlers,
  supportsFrames,
  start,
  stop,
  pause,
  resume
}
