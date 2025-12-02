const getWords = function (net) {
  return Object.keys(net.hooks).filter(w => !w.startsWith('#') && !w.startsWith('%'))
}

const maybeMatch = function (doc, net) {
  // must have *atleast* one of these words
  let words = getWords(net)
  if (words.length === 0) {
    return doc
  }
  if (!doc._cache) {
    doc.cache()
  }
  let cache = doc._cache
  // return sentences that have one of our needed words
  return doc.filter((_m, i) => {
    return words.some(str => cache[i].has(str))
  })
}
export default maybeMatch