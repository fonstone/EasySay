Component({
  properties: {
    score: { type: Number, value: 0 },
    size: { type: Number, value: 220 },
    label: { type: String, value: '' },
    sublabel: { type: String, value: '' },
    animated: { type: Boolean, value: true }
  },

  data: {
    displayScore: 0
  },

  observers: {
    score(value) {
      this.animateTo(value || 0)
    }
  },

  lifetimes: {
    ready() {
      this.animateTo(this.data.score)
    },
    detached() {
      this.clearTimer()
    }
  },

  methods: {
    clearTimer() {
      if (this._timer) {
        clearInterval(this._timer)
        this._timer = null
      }
    },

    /** 数字与圆环一起渐进；observers 与 ready 可能各触发一次，用 target 去重 */
    animateTo(target) {
      const to = Math.max(0, Math.round(target || 0))
      if (this._lastTarget === to && this._timer) return
      this._lastTarget = to
      this.clearTimer()
      if (!this.data.animated || to === 0) {
        this.setData({ displayScore: to })
        this.draw(to)
        return
      }
      const steps = 18
      let step = 0
      this.setData({ displayScore: 0 })
      this._timer = setInterval(() => {
        step++
        const t = step / steps
        const eased = 1 - Math.pow(1 - t, 3)
        const current = Math.round(to * eased)
        this.setData({ displayScore: current })
        this.draw(current)
        if (step >= steps) {
          this.clearTimer()
          this.draw(to)
        }
      }, 28)
    },

    onTap() {
      this.triggerEvent('explain')
    },

    // canvas 不支持 CSS 变量，这里沿用设计令牌对应的具体色值
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

        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(27, 90, 71, 0.10)'
        ctx.lineWidth = line
        ctx.stroke()

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

          const dotX = cx + radius * Math.cos(end)
          const dotY = cy + radius * Math.sin(end)
          ctx.beginPath()
          ctx.arc(dotX, dotY, line * 0.32, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
        }

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
