// follow our trie structure
const scanWords = function (terms, trie, opts) {
  let n = 0
  let results = []
  for (let i = 0; i < terms.length; i++) {
    let word = terms[i][opts.form] || terms[i].normal
    // main match-logic loop:
    while (n > 0 && (trie.goNext[n] === undefined || !trie.goNext[n].hasOwnProperty(word))) {
      n = trie.failTo[n] || 0 // (usually back to 0)
    }
    // did we fail?
    if (!trie.goNext[n].hasOwnProperty(word)) {
      continue
    }
    n = trie.goNext[n][word]
    if (trie.endAs[n]) {
      let arr = trie.endAs[n]
      for (let o = 0; o < arr.length; o++) {
        let len = arr[o]
        let term = terms[i - len + 1]
        let [no, start] = term.index
        results.push([no, start, start + len, term.id])
      }
    }
  }
  return results
}

const cacheMiss = function (words, cache) {
  for (let i = 0; i < words.length; i += 1) {
    if (cache.has(words[i]) === true) {
      return false
    }
  }
  return true
}

const scan = function (view, trie, opts) {
  let results = []
  opts.form = opts.form || 'normal'
  let docs = view.docs
  if (!trie.goNext || !trie.goNext[0]) {
    console.error('Compromise invalid lookup trie')//eslint-disable-line
    return view.none()
  }
  let firstWords = Object.keys(trie.goNext[0])
  // do each phrase
  for (let i = 0; i < docs.length; i++) {
    // can we skip the phrase, all together?
    if (view._cache && view._cache[i] && cacheMiss(firstWords, view._cache[i]) === true) {
      continue
    }
    let terms = docs[i]
    let found = scanWords(terms, trie, opts)
    if (found.length > 0) {
      results = results.concat(found)
    }
  }
  return view.update(results)
}
export default scan
