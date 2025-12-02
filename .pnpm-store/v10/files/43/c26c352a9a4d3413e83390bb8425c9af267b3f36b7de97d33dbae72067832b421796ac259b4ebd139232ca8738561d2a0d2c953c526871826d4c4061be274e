// sort words by frequency
const freq = function (view) {
  let docs = view.docs
  let counts = {}
  for (let i = 0; i < docs.length; i += 1) {
    for (let t = 0; t < docs[i].length; t += 1) {
      let term = docs[i][t]
      let word = term.machine || term.normal
      counts[word] = counts[word] || 0
      counts[word] += 1
    }
  }
  // add counts on each term
  for (let i = 0; i < docs.length; i += 1) {
    for (let t = 0; t < docs[i].length; t += 1) {
      let term = docs[i][t]
      let word = term.machine || term.normal
      term.freq = counts[word]
    }
  }
}
export default freq
