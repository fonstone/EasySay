/**
 * 真实分析进度
 * -------------------------------------------------
 * 过去 analyzing 页用 setInterval 每 480ms 把进度推到 92%，
 * 与真实计算没有任何关系。这里把阶段绑定到实际执行的代码段，
 * 每段记录真实耗时（毫秒），进度 = 已完成阶段的权重之和。
 *
 * 纯 JS，无 wx 依赖；Node 里可直接测试。
 */

const STAGES = [
  { id: 'read', label: '读取录音数据', weight: 16 },
  { id: 'energy', label: '分帧计算音量', weight: 22 },
  { id: 'vad', label: '区分发声与停顿', weight: 20 },
  { id: 'pause', label: '统计停顿与声音起伏', weight: 18 },
  { id: 'report', label: '生成维度与规则点评', weight: 16 },
  { id: 'save', label: '保存到本机', weight: 8 }
]

function now() {
  if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

/**
 * @param {function} onChange 每次阶段状态变化时收到 snapshot()
 * 返回一个 run，供 analyzePcm / buildReport / session 调用 begin/end
 */
function createRun(onChange) {
  const steps = STAGES.map(s => Object.assign({}, s, { state: 'pending', ms: 0 }))
  let current = null

  function find(id) {
    for (let i = 0; i < steps.length; i++) if (steps[i].id === id) return steps[i]
    return null
  }

  function emit() {
    if (typeof onChange === 'function') onChange(snapshot())
  }

  function begin(id) {
    const s = find(id)
    if (!s || s.state === 'done') return
    if (current && current !== s && current.state === 'active') {
      current.state = 'done'
      current.ms = Math.max(0, Math.round(now() - (current._t || now())))
    }
    s.state = 'active'
    s._t = now()
    current = s
    emit()
  }

  function end(id) {
    const s = find(id)
    if (!s || s.state === 'done') return
    s.state = 'done'
    s.ms = Math.max(0, Math.round(now() - (s._t || now())))
    if (current === s) current = null
    emit()
  }

  function skip(id) {
    const s = find(id)
    if (!s || s.state === 'done') return
    s.state = 'skipped'
    s.ms = 0
    if (current === s) current = null
    emit()
  }

  function finish() {
    steps.forEach(s => { if (s.state !== 'done') end(s.id) })
    emit()
  }

  function snapshot() {
    let done = 0
    let active = 0
    let currentIndex = -1
    steps.forEach((s, i) => {
      if (s.state === 'done') done += s.weight
      else if (s.state === 'skipped') done += s.weight
      else if (s.state === 'active') {
        active += s.weight * 0.5
        currentIndex = i
      }
    })
    return {
      steps: steps.map(s => ({
        id: s.id,
        label: s.label,
        state: s.state,
        ms: s.ms,
        msLabel: s.state === 'done' ? (s.ms < 1 ? '<1ms' : s.ms + 'ms') : ''
      })),
      percent: Math.min(100, Math.round(done + active)),
      currentIndex,
      allDone: steps.every(s => s.state === 'done' || s.state === 'skipped')
    }
  }

  return { begin, end, skip, finish, snapshot, steps }
}

module.exports = {
  STAGES,
  createRun
}
