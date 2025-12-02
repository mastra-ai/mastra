const hasLetter = /[a-z0-9\u00C0-\u00FF\u00a9\u00ae\u2000-\u3300\ud000-\udfff]/i
const hasSomething = /\S/

const notEmpty = function (splits) {
  let chunks = []
  for (let i = 0; i < splits.length; i++) {
    let s = splits[i]
    if (s === undefined || s === '') {
      continue
    }
    //this is meaningful whitespace
    if (hasSomething.test(s) === false || hasLetter.test(s) === false) {
      //add it to the last one
      if (chunks[chunks.length - 1]) {
        chunks[chunks.length - 1] += s
        continue
      } else if (splits[i + 1]) {
        //add it to the next one
        splits[i + 1] = s + splits[i + 1]
        continue
      }
    }
    //else, only whitespace, no terms, no sentence
    chunks.push(s)
  }
  return chunks
}
export default notEmpty