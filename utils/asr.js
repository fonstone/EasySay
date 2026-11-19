/**
 * 语音识别（ASR）能力层
 * -------------------------------------------------
 * 事实边界：本工程是纯本地演示包（touristappid、无网络请求、无云开发），
 * 没有语音识别能力。过去报告页把「用户手写的文字稿」放在评分链路里，
 * 却不说明它不是识别结果，容易被理解成「程序听懂了我说了什么」。
 *
 * 本模块做三件事：
 * 1. 诚实探测能力：getCapability() 明确返回 available / mode / reason；
 * 2. 留可插拔接口：正式版配置云端一句话识别网关后，setProvider() 注入即可，
 *    session 会自动把识别结果传给 buildReport，无需改页面；
 * 3. 给文字稿打来源标记：manual（人工自述稿）/ asr（识别结果）/ none。
 *
 * 不伪装：没有 file 模式提供者时，recognizeAudio() 一定以 ASR_UNAVAILABLE 拒绝。
 * 微信同声传译插件（WechatSI）只支持边录边识别，无法转写已保存的 wav，
 * 因此只报告为 stream 能力，不会被当成文件转写能力使用。
 */

const SOURCE = {
  NONE: 'none',
  MANUAL: 'manual',
  ASR: 'asr'
}

const SOURCE_LABEL = {
  none: '未提供文字稿',
  manual: '自述稿（手动输入，非语音识别）',
  asr: '语音识别结果'
}

let provider = null
let cachedCapability = null

function setProvider(next) {
  provider = next && typeof next.recognize === 'function' ? next : null
  cachedCapability = null
  return getCapability()
}

function detectPlugin() {
  try {
    if (typeof wx !== 'undefined' && typeof wx.requirePlugin === 'function') {
      const si = wx.requirePlugin('WechatSI')
      if (si && typeof si.getRecordRecognitionManager === 'function') return true
    }
  } catch (e) {
    return false
  }
  return false
}

/**
 * @returns {{available:boolean, mode:string, provider:string, label:string,
 *            requiresNetwork:boolean, reason:string}}
 * mode: none（无）/ file（可转写已保存的录音）/ stream（只能边录边识别）
 */
function getCapability() {
  if (cachedCapability) return cachedCapability
  if (provider) {
    cachedCapability = {
      available: true,
      mode: 'file',
      provider: provider.id || 'custom',
      label: provider.label || '已配置的语音识别服务',
      requiresNetwork: true,
      reason: '已注入文件转写提供者'
    }
    return cachedCapability
  }
  const hasPlugin = detectPlugin()
  cachedCapability = {
    available: false,
    mode: hasPlugin ? 'stream' : 'none',
    provider: hasPlugin ? 'wechat-si-stream' : 'none',
    label: hasPlugin ? '微信同声传译（仅边录边识别）' : '未接入语音识别',
    requiresNetwork: !!hasPlugin,
    reason: hasPlugin
      ? '当前插件只支持边录边识别，不能转写已保存的录音；正式版需另接文件转写网关。'
      : '本版本未配置语音识别插件或云端网关，内容维度需在练习后手动补写自述稿。'
  }
  return cachedCapability
}

/**
 * 转写已保存的录音文件。只有注入了 file 提供者才会成功。
 * @param {{filePath:string, duration:number, sampleRate:number}} payload
 * @returns {Promise<{text:string, source:string, provider:string}>}
 */
function recognizeAudio(payload) {
  const cap = getCapability()
  if (!cap.available || cap.mode !== 'file') {
    const err = new Error(cap.reason)
    err.code = 'ASR_UNAVAILABLE'
    return Promise.reject(err)
  }
  return Promise.resolve(provider.recognize(payload || {})).then(res => {
    const text = typeof res === 'string' ? res : (res && (res.text || res.result)) || ''
    if (!String(text).trim()) {
      const empty = new Error('识别结果为空，内容维度仍可在报告页手动补写自述稿')
      empty.code = 'ASR_EMPTY'
      throw empty
    }
    return {
      text: String(text).trim(),
      source: SOURCE.ASR,
      provider: cap.provider
    }
  })
}

function sourceLabel(source) {
  return SOURCE_LABEL[source] || SOURCE_LABEL.none
}

module.exports = {
  SOURCE,
  SOURCE_LABEL,
  getCapability,
  setProvider,
  recognizeAudio,
  sourceLabel
}
