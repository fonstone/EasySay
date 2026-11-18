Component({
  properties: {
    mark: { type: String, value: '空' },
    title: { type: String, value: '这里还没有内容' },
    desc: { type: String, value: '' },
    action: { type: String, value: '' },
    compact: { type: Boolean, value: false }
  },
  methods: {
    onAction() {
      this.triggerEvent('action')
    }
  }
})
