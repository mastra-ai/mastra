// split terms into Nounphrase, verbphrase, etc groups
const chunks = function (doc) {
  let all = []
  let lastOne = null
  // first, split by comma, etc
  let m = doc.clauses()
  // loop through each clause
  m.docs.forEach(terms => {
    terms.forEach(term => {
      // new chunk
      if (!term.chunk || term.chunk !== lastOne) {
        lastOne = term.chunk
        all.push([term.index[0], term.index[1], term.index[1] + 1])
      } else {
        // keep the chunk going
        all[all.length - 1][2] = term.index[1] + 1
      }
    })
    lastOne = null
  })
  let parts = doc.update(all)
  return parts
}
export default chunks
