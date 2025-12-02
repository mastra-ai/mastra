const wordCount = function (view) {
  let n = 0
  let docs = view.docs
  for (let i = 0; i < docs.length; i += 1) {
    for (let t = 0; t < docs[i].length; t += 1) {
      if (docs[i][t].normal === '') {
        continue //skip implicit words
      }
      n += 1
      docs[i][t].wordCount = n
    }
  }
}

export default wordCount
