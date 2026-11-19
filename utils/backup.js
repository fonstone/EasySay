/**
 * 数据保全
 * -------------------------------------------------
 * 纯本地小程序卸载 / 清缓存就会丢全部记录，这是产品事实，不能靠文案掩盖。
 * 过去只有「复制到剪贴板」一条路径，一旦用户没立刻粘贴，等于没备份。
 *
 * 本模块提供：
 * 1. 写成真实备份文件（USER_DATA_PATH 下的 .json）；
 * 2. 能力允许时用 wx.shareFile 把文件发出去，否则回退到剪贴板；
 * 3. 备份提醒策略：距上次备份超过 7 天，或新增 ≥3 份报告就提醒一次。
 *
 * 所有 wx 调用均做能力探测，Node 测试里可以只测纯逻辑部分。
 */

const util = require('./util')

const REMIND_DAYS = 7
const REMIND_REPORTS = 3

function fileName(at) {
  return 'clearsay-backup-' + util.dateKey(new Date(at || Date.now())) + '.json'
}

function hasFs() {
  return typeof wx !== 'undefined' &&
    typeof wx.getFileSystemManager === 'function' &&
    !!(wx.env && wx.env.USER_DATA_PATH)
}

/** 把备份 JSON 写成本机文件，返回路径；不支持时返回空串 */
function writeBackupFile(json, at) {
  if (!hasFs()) return Promise.resolve('')
  const path = wx.env.USER_DATA_PATH + '/' + fileName(at)
  return new Promise(resolve => {
    try {
      wx.getFileSystemManager().writeFile({
        filePath: path,
        data: json,
        encoding: 'utf8',
        success: () => resolve(path),
        fail: () => resolve('')
      })
    } catch (e) {
      resolve('')
    }
  })
}

/** 微信支持分享文件时把备份发出去；返回是否真的调起了分享 */
function shareBackupFile(path) {
  if (!path || typeof wx === 'undefined' || typeof wx.shareFile !== 'function') return false
  try {
    wx.shareFile({ filePath: path, fail() {} })
    return true
  } catch (e) {
    return false
  }
}

/**
 * @param {object} state { lastBackupAt:number, backupsReports:number, now:number }
 * @returns {{needed:boolean, days:number, reports:number, reason:string}}
 */
function getBackupReminder(state) {
  const s = state || {}
  const now = s.now || Date.now()
  const reports = Math.max(0, Number(s.reportsSinceBackup) || 0)
  const days = s.lastBackupAt
    ? Math.floor((now - s.lastBackupAt) / 86400000)
    : null
  const never = !s.lastBackupAt && reports > 0
  const tooOld = days !== null && days >= REMIND_DAYS
  const tooMany = reports >= REMIND_REPORTS
  const needed = !!(never || tooOld || tooMany)
  let reason = ''
  if (never) reason = '还没有备份过，卸载或清缓存会丢掉全部练习记录'
  else if (tooMany) reason = '自上次备份后已新增 ' + reports + ' 份点评，建议再导出一次'
  else if (tooOld) reason = '距上次备份已 ' + days + ' 天，建议导出一份最新的'
  return { needed, days: days === null ? -1 : days, reports, reason }
}

module.exports = {
  REMIND_DAYS,
  REMIND_REPORTS,
  fileName,
  writeBackupFile,
  shareBackupFile,
  getBackupReminder
}
