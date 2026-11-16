Component({
  properties: {
    mark: { type: String, value: '空' },
    title: { type: String, value: '这里还是空的' },
    desc: { type: String, value: '' },
    action: { type: String, value: '' }
  },
  methods: {
    onAction() {
      this.triggerEvent('action')
    }
  }
})
