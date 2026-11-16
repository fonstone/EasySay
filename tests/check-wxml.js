/* 简易 WXML 结构检查：标签配对 + 花括号配对 + 常见表达式错误 */
const fs = require('fs')
const path = require('path')

const VOID = new Set(['input', 'image', 'switch', 'slider', 'icon', 'progress', 'checkbox', 'radio'])
const SELF_OK = VOID

function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') walk(p, out)
    } else if (f.endsWith('.wxml')) {
      out.push(p)
    }
  }
  return out
}

const files = walk('.', [])
let errors = 0

for (const file of files) {
  let raw = fs.readFileSync(file, 'utf8')
  raw = raw.replace(/<!--[\s\S]*?-->/g, '')
  const opens = (raw.match(/\{\{/g) || []).length
  const closes = (raw.match(/\}\}/g) || []).length
  if (opens !== closes) {
    console.log(`${file}: mustache mismatch {{=${opens} }}=${closes}`)
    errors++
  }
  if (/\{\{\s*\}\}/.test(raw)) {
    console.log(`${file}: empty mustache`)
    errors++
  }
  // 去掉 mustache 表达式，避免表达式里的 < > 干扰标签识别
  let src = raw.replace(/\{\{[\s\S]*?\}\}/g, 'X')
  const stack = []
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^<>]*?)(\/?)>/g
  let m
  while ((m = tagRe.exec(src))) {
    const closing = m[0][1] === '/'
    const name = m[1]
    const selfClosed = m[3] === '/' || SELF_OK.has(name)
    if (closing) {
      const last = stack.pop()
      if (last !== name) {
        console.log(`${file}: closing </${name}> does not match <${last || 'none'}>`)
        errors++
        if (last && last !== name) stack.push(last)
      }
    } else if (!selfClosed) {
      stack.push(name)
    }
  }
  if (stack.length) {
    console.log(`${file}: unclosed tags: ${stack.join(', ')}`)
    errors++
  }
}

console.log(`\nWXML files: ${files.length}, errors: ${errors}`)
if (errors) process.exit(1)
