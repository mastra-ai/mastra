// roughly, split a document by comma or semicolon

const splitOn = function (terms, i) {
  const isNum = /^[0-9]+$/
  let term = terms[i]
  // early on, these may not be dates yet:
  if (!term) {
    return false
  }
  const maybeDate = new Set(['may', 'april', 'august', 'jan'])
  // veggies, like figs
  if (term.normal === 'like' || maybeDate.has(term.normal)) {
    return false
  }
  // toronto, canada  - tuesday, march
  if (term.tags.has('Place') || term.tags.has('Date')) {
    return false
  }
  if (terms[i - 1]) {
    let lastTerm = terms[i - 1]
    // thursday, june
    if (lastTerm.tags.has('Date') || maybeDate.has(lastTerm.normal)) {
      return false
    }
    // pretty, nice, and fun
    if (lastTerm.tags.has('Adjective') || term.tags.has('Adjective')) {
      return false
    }
  }
  // don't split numbers, yet
  let str = term.normal
  if (str.length === 1 || str.length === 2 || str.length === 4) {
    if (isNum.test(str)) {
      return false
    }
  }
  return true
}

// kind-of a dirty sentence chunker
const quickSplit = function (document) {
  const splitHere = /[,:;]/
  let arr = []
  document.forEach(terms => {
    let start = 0
    terms.forEach((term, i) => {
      // does it have a comma/semicolon ?
      if (splitHere.test(term.post) && splitOn(terms, i + 1)) {
        arr.push(terms.slice(start, i + 1))
        start = i + 1
      }
    })
    if (start < terms.length) {
      arr.push(terms.slice(start, terms.length))
    }
  })
  return arr
}

export default quickSplit