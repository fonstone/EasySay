Component({
  properties: {
    dimensions: { type: Array, value: [] },
    size: { type: Number, value: 520 }
  },

  data: {
    empty: true
  },

  observers: {
    dimensions(list) {
      const empty = !list || list.length < 3
      this.setData({ empty }, () => {
        if (!empty) this.draw(list)
      })
    }
  },

  lifetimes: {
    ready() {
      const list = this.data.dimensions || []
      this.setData({ empty: list.length < 3 })
      this.draw(list)
    }
  },

  methods: {
    draw(dims) {
      if (!dims || dims.length < 3) return
      const query = this.createSelectorQuery()
      query.select('#radar').fields({ node: true, size: true }).exec(res => {
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
        const radius = Math.min(width, height) / 2 - Math.max(42, width * 0.075)
        const n = dims.length
        const step = Math.PI * 2 / n
        const start = -Math.PI / 2

        const pointAt = (i, ratio) => {
          const a = start + step * i
          return [cx + radius * ratio * Math.cos(a), cy + radius * ratio * Math.sin(a)]
        }

        // 网格
        for (let level = 4; level >= 1; level--) {
          const ratio = level / 4
          ctx.beginPath()
          for (let i = 0; i < n; i++) {
            const p = pointAt(i, ratio)
            if (i === 0) ctx.moveTo(p[0], p[1])
            else ctx.lineTo(p[0], p[1])
          }
          ctx.closePath()
          if (level === 4) {
            ctx.fillStyle = 'rgba(27, 90, 71, 0.035)'
            ctx.fill()
          }
          ctx.strokeStyle = level === 4 ? 'rgba(27, 90, 71, 0.18)' : 'rgba(27, 90, 71, 0.09)'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // 轴线
        for (let i = 0; i < n; i++) {
          const p = pointAt(i, 1)
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(p[0], p[1])
          ctx.strokeStyle = 'rgba(27, 90, 71, 0.10)'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // 数据多边形
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const ratio = Math.max(0, Math.min(100, dims[i].value || 0)) / 100
          const p = pointAt(i, ratio)
          if (i === 0) ctx.moveTo(p[0], p[1])
          else ctx.lineTo(p[0], p[1])
        }
        ctx.closePath()
        ctx.fillStyle = 'rgba(27, 90, 71, 0.13)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(27, 90, 71, 0.72)'
        ctx.lineWidth = 2
        ctx.stroke()

        // 顶点
        for (let i = 0; i < n; i++) {
          const ratio = Math.max(0, Math.min(100, dims[i].value || 0)) / 100
          const p = pointAt(i, ratio)
          ctx.beginPath()
          ctx.arc(p[0], p[1], 3, 0, Math.PI * 2)
          ctx.fillStyle = '#1B5A47'
          ctx.fill()
        }

        // 标签
        ctx.font = '11px -apple-system, "PingFang SC", sans-serif'
        for (let i = 0; i < n; i++) {
          const a = start + step * i
          const labelRadius = radius + 22
          const x = cx + labelRadius * Math.cos(a)
          const y = cy + labelRadius * Math.sin(a)
          const cos = Math.cos(a)
          const sin = Math.sin(a)
          ctx.fillStyle = '#66756f'
          ctx.textAlign = cos > 0.35 ? 'left' : cos < -0.35 ? 'right' : 'center'
          ctx.textBaseline = sin > 0.35 ? 'top' : sin < -0.35 ? 'bottom' : 'middle'
          ctx.fillText(dims[i].name, x, y)
        }
      })
    }
  }
})
