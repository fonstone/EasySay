/* eslint-disable no-console */
const { spawnSync } = require('child_process')
const path = require('path')

const files = [
  'tests/scoring.test.js',
  'tests/data.test.js',
  'tests/store.test.js',
  'tests/pages.smoke.js',
  'tests/session.flow.js',
  'tests/check-wxml.js'
]

let failed = 0
for (const file of files) {
  console.log('\n============================================================')
  console.log('RUN ' + file)
  console.log('============================================================')
  const res = spawnSync(process.execPath, [path.join(__dirname, '..', file)], {
    stdio: 'inherit'
  })
  if (res.status !== 0) failed++
}

console.log('\n============================================================')
if (failed) {
  console.log('FAILED: ' + failed + ' suite(s)')
  process.exit(1)
}
console.log('ALL SUITES PASSED')
