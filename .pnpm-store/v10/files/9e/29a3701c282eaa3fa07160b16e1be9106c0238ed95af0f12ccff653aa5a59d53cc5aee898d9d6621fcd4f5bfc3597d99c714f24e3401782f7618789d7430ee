
// transfer sentence-ending punctuation
const repairPunct = function (terms, len) {
  let last = terms.length - 1
  let from = terms[last]
  let to = terms[last - len]
  if (to && from) {
    to.post += from.post //this isn't perfect.
    to.post = to.post.replace(/ +([.?!,;:])/, '$1')
    // don't allow any silly punctuation outcomes like ',!'
    to.post = to.post.replace(/[,;:]+([.?!])/, '$1')
  }
}

// remove terms from document json
const pluckOut = function (document, nots) {
  nots.forEach(ptr => {
    let [n, start, end] = ptr
    let len = end - start
    if (!document[n]) {
      return // weird!
    }
    if (end === document[n].length && end > 1) {
      repairPunct(document[n], len)
    }
    document[n].splice(start, len) // replaces len terms at index start
  })
  // remove any now-empty sentences
  // (foreach + splice = 'mutable filter')
  for (let i = document.length - 1; i >= 0; i -= 1) {
    if (document[i].length === 0) {
      document.splice(i, 1)
      // remove any trailing whitespace before our removed sentence
      if (i === document.length && document[i - 1]) {
        let terms = document[i - 1]
        let lastTerm = terms[terms.length - 1]
        if (lastTerm) {
          lastTerm.post = lastTerm.post.trimEnd()
        }
      }
      // repair any downstream indexes
      // for (let k = i; k < document.length; k += 1) {
      //   document[k].forEach(term => term.index[0] -= 1)
      // }
    }
  }
  return document
}

export default pluckOut