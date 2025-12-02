const setChunk = function (term, chunk) {
  const env = typeof process === 'undefined' || !process.env ? self.env || {} : process.env
  if (env.DEBUG_CHUNKS) {
    let str = (term.normal + "'").padEnd(8)
    console.log(`  | '${str}  →  \x1b[34m${chunk.padEnd(12)}\x1b[0m \x1b[2m -fallback- \x1b[0m`) // eslint-disable-line
  }
  term.chunk = chunk
}

// ensure everything has a chunk
const fallback = function (document) {
  for (let n = 0; n < document.length; n += 1) {
    for (let t = 0; t < document[n].length; t += 1) {
      let term = document[n][t]
      if (term.chunk === undefined) {
        // conjunctions stand alone
        if (term.tags.has('Conjunction')) {
          setChunk(term, 'Pivot')
        } else if (term.tags.has('Preposition')) {
          setChunk(term, 'Pivot')
        } else if (term.tags.has('Adverb')) {
          setChunk(term, 'Verb')
        }
        // just take the chunk on the right?
        // else if (document[n][t + 1] && document[n][t + 1].chunk) {
        //   setChunk(term, document[n][t + 1].chunk)
        // }
        // // or take the chunk on the left
        // else if (document[n][t - 1] && document[n][t - 1].chunk) {
        //   setChunk(term, document[n][t - 1].chunk)
        else {
          //  ¯\_(ツ)_/¯
          term.chunk = 'Noun'
        }
      }
    }
  }
}
export default fallback
