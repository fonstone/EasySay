Component({
  properties: {
    score: { type: Number, value: 0 },
    size: { type: Number, value: 220 },
    label: { type: String, value: '' },
    sublabel: { type: String, value: '' }
  },

  data: {
    displayScore: 0
  },

  observers: {
    score(value) {
      this.setData({ displayScore: Math.round(value || 0) })
      this.draw(value || 0)
    }
  },

  lifetimes: {
    ready() {
      this.draw(this.data.score)
    }
  },

  methods: {
    draw(score) {
      const query = this.createSelectorQuery()
      query.select('#ring').fields({ node: true, size: true }).exec(res => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const width = res[0].width
        const height = res[0].height
        let dpr = 2
        try {
          const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
          dpr = info.pixelRatio || 2
        } catch (e) {
          dpr = 2
        }
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, width, height)

        const cx = width / 2
        const cy = height / 2
        const line = Math.max(5, width * 0.045)
        const radius = Math.min(cx, cy) - line - 2

        // 底环
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(27, 90, 71, 0.10)'
        ctx.lineWidth = line
        ctx.stroke()

        // 进度环
        const pct = Math.max(0, Math.min(100, score)) / 100
        const start = -Math.PI / 2
        const end = start + Math.PI * 2 * pct
        const color = score >= 82 ? '#1B5A47' : score >= 65 ? '#B68A4E' : '#B25A48'

        if (pct > 0) {
          ctx.beginPath()
          ctx.arc(cx, cy, radius, start, end)
          ctx.strokeStyle = color
          ctx.lineWidth = line
          ctx.lineCap = 'round'
          ctx.stroke()

          // 端点
          const dotX = cx + radius * Math.cos(end)
          const dotY = cy + radius * Math.sin(end)
          ctx.beginPath()
          ctx.arc(dotX, dotY, line * 0.32, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
        }

        // 刻度
        for (let i = 0; i < 12; i++) {
          const a = start + (Math.PI * 2 / 12) * i
          const r1 = radius - line - 4
          const r2 = radius - line - 9
          ctx.beginPath()
          ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a))
          ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a))
          ctx.strokeStyle = 'rgba(27, 90, 71, 0.16)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      })
    }
  }
})
