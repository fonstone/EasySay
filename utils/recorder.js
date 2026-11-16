/**
 * 录音管理器单例封装
 * 避免多个页面重复注册 RecorderManager 回调导致重复触发。
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
  return manager
}

function setHandlers(next) {
  handlers = next || {}
  ensure()
}

function start(options) {
  ensure()
  manager.start(options || {})
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
  start,
  stop,
  pause,
  resume
}
