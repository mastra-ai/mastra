// lookup last word in the type-ahead prefixes
const typeahead = function (view) {
  const prefixes = view.model.one.typeahead
  const docs = view.docs
  if (docs.length === 0 || Object.keys(prefixes).length === 0) {
    return
  }
  let lastPhrase = docs[docs.length - 1] || []
  let lastTerm = lastPhrase[lastPhrase.length - 1]
  // if we've already put whitespace, end.
  if (lastTerm.post) {
    return
  }
  // if we found something
  if (prefixes.hasOwnProperty(lastTerm.normal)) {
    let found = prefixes[lastTerm.normal]
    // add full-word as an implicit result
    lastTerm.implicit = found
    lastTerm.machine = found
    lastTerm.typeahead = true
    // tag it, as our assumed term
    if (view.compute.preTagger) {
      view.last().unTag('*').compute(['lexicon', 'preTagger'])
    }
  }
}

export default { typeahead }
