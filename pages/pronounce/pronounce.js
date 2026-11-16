const store = require('../../utils/store')
const pronounce = require('../../data/pronounce')

function decorate(list) {
  return list.map((d, i) => Object.assign({}, d, {
    label: i + 1 < 10 ? '0' + (i + 1) : String(i + 1)
  }))
}

Page({
  data: {
    ready: false,
    sections: [],
    active: 'initial',
    drills: [],
    done: 0,
    total: pronounce.DRILLS.length,
    sectionInfo: null
  },

  onShow() {
    const doneList = store.getPronounceDone()
    const sections = pronounce.SECTIONS.map(s => {
      const list = pronounce.DRILLS.filter(d => d.section === s.id)
      return Object.assign({}, s, {
        total: list.length,
        done: list.filter(d => doneList.indexOf(d.id) !== -1).length
      })
    })
    const active = this.data.active || 'initial'
    const drills = decorate(pronounce.getDrills(active)).map(d => Object.assign({}, d, {
      done: doneList.indexOf(d.id) !== -1
    }))
    this.setData({
      ready: true,
      sections,
      drills,
      done: doneList.length,
      sectionInfo: pronounce.getSection(active)
    })
  },

  switchSection(e) {
    const id = e.currentTarget.dataset.id
    const doneList = store.getPronounceDone()
    const drills = decorate(pronounce.getDrills(id)).map(d => Object.assign({}, d, {
      done: doneList.indexOf(d.id) !== -1
    }))
    this.setData({
      active: id,
      drills,
      sectionInfo: pronounce.getSection(id)
    })
  },

  openDrill(e) {
    wx.navigateTo({ url: '/pages/pronounce-detail/pronounce-detail?id=' + e.currentTarget.dataset.id })
  },

  onShareAppMessage() {
    return {
      title: '把每个字咬准，是表达的第一层体面',
      path: '/pages/pronounce/pronounce'
    }
  }
})
