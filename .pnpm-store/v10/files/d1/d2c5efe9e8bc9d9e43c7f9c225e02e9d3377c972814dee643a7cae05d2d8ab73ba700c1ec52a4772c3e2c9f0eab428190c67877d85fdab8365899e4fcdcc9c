// get all character startings in doc
const offset = function (view) {
  let elapsed = 0
  let index = 0
  let docs = view.document //start from the actual-top
  for (let i = 0; i < docs.length; i += 1) {
    for (let t = 0; t < docs[i].length; t += 1) {
      let term = docs[i][t]
      term.offset = {
        index: index,
        start: elapsed + term.pre.length,
        length: term.text.length,
      }
      elapsed += term.pre.length + term.text.length + term.post.length
      index += 1
    }
  }
}


export default offset
