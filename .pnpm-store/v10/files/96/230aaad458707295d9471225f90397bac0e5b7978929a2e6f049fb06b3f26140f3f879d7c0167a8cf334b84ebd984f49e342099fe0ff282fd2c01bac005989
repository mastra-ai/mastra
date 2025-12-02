const hasOpen = /\(/
const hasClosed = /\)/

const findEnd = function (terms, i) {
  for (; i < terms.length; i += 1) {
    if (terms[i].post && hasClosed.test(terms[i].post)) {
      let [, index] = terms[i].index
      index = index || 0
      return index
    }
  }
  return null
}

const find = function (doc) {
  let ptrs = []
  doc.docs.forEach(terms => {
    let isOpen = false
    for (let i = 0; i < terms.length; i += 1) {
      let term = terms[i]
      if (!isOpen && term.pre && hasOpen.test(term.pre)) {
        let end = findEnd(terms, i)
        if (end !== null) {
          let [n, start] = terms[i].index
          ptrs.push([n, start, end + 1, terms[i].id])
          i = end
        }
      }
    }
  })
  return doc.update(ptrs)
}

const strip = function (m) {
  m.docs.forEach(terms => {
    terms[0].pre = terms[0].pre.replace(hasOpen, '')
    let last = terms[terms.length - 1]
    last.post = last.post.replace(hasClosed, '')
  })
  return m
}
export { find, strip }
