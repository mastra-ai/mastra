const fixUp = function (docs) {
  let byChunk = []
  let current = null
  docs.forEach(terms => {
    // ensure an adjective chunk is preceded by a copula
    for (let i = 0; i < terms.length; i += 1) {
      let term = terms[i]
      if (current && term.chunk === current) {
        byChunk[byChunk.length - 1].terms.push(term)
      } else {
        byChunk.push({ chunk: term.chunk, terms: [term] })
        current = term.chunk
      }
    }
  })
  // ensure every verb-phrase actually has a verb
  byChunk.forEach(c => {
    if (c.chunk === 'Verb') {
      const hasVerb = c.terms.find(t => t.tags.has('Verb'))
      if (!hasVerb) {
        c.terms.forEach(t => t.chunk = null)
      }
    }
  })
}
export default fixUp
