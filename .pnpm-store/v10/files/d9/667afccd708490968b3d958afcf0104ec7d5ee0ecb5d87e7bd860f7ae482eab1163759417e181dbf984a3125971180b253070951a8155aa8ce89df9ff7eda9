
//loop through these chunks, and join the non-sentence chunks back together..
const smartMerge = function (chunks, world) {
  const isSentence = world.methods.one.tokenize.isSentence
  const abbrevs = world.model.one.abbreviations || new Set()

  let sentences = []
  for (let i = 0; i < chunks.length; i++) {
    let c = chunks[i]
    //should this chunk be combined with the next one?
    if (chunks[i + 1] && isSentence(c, abbrevs) === false) {
      chunks[i + 1] = c + (chunks[i + 1] || '')
    } else if (c && c.length > 0) {
      //this chunk is a proper sentence..
      sentences.push(c)
      chunks[i] = ''
    }
  }
  return sentences
}
export default smartMerge