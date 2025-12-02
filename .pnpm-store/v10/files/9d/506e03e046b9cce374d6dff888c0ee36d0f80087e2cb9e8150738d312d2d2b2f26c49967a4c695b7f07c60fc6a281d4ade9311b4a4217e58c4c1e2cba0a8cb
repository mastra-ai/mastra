const isClass = /^\../
const isId = /^#./

const escapeXml = str => {
  str = str.replace(/&/g, '&amp;')
  str = str.replace(/</g, '&lt;')
  str = str.replace(/>/g, '&gt;')
  str = str.replace(/"/g, '&quot;')
  str = str.replace(/'/g, '&apos;')
  return str
}

// interpret .class, #id, tagName
const toTag = function (k) {
  let start = ''
  let end = '</span>'
  k = escapeXml(k)
  if (isClass.test(k)) {
    start = `<span class="${k.replace(/^\./, '')}"`
  } else if (isId.test(k)) {
    start = `<span id="${k.replace(/^#/, '')}"`
  } else {
    start = `<${k}`
    end = `</${k}>`
  }
  start += '>'
  return { start, end }
}

const getIndex = function (doc, obj) {
  let starts = {}
  let ends = {}
  Object.keys(obj).forEach(k => {
    let res = obj[k]
    let tag = toTag(k)
    if (typeof res === 'string') {
      res = doc.match(res)
    }
    res.docs.forEach(terms => {
      // don't highlight implicit terms
      if (terms.every(t => t.implicit)) {
        return
      }
      let a = terms[0].id
      starts[a] = starts[a] || []
      starts[a].push(tag.start)
      let b = terms[terms.length - 1].id
      ends[b] = ends[b] || []
      ends[b].push(tag.end)
    })
  })
  return { starts, ends }
}

const html = function (obj) {
  // index ids to highlight
  let { starts, ends } = getIndex(this, obj)
  // create the text output
  let out = ''
  this.docs.forEach(terms => {
    for (let i = 0; i < terms.length; i += 1) {
      let t = terms[i]
      // do a span tag
      if (starts.hasOwnProperty(t.id)) {
        out += starts[t.id].join('')
      }
      out += t.pre || ''
      out += t.text || ''
      if (ends.hasOwnProperty(t.id)) {
        out += ends[t.id].join('')
      }
      out += t.post || ''
    }
  })
  return out
}
export default { html }
