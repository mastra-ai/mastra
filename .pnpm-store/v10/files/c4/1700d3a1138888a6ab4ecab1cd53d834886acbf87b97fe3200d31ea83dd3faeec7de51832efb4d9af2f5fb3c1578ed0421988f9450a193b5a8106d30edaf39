// cheat- add the document's pointer to the terms
const index = function (view) {
  // console.log('reindex')
  let document = view.document
  for (let n = 0; n < document.length; n += 1) {
    for (let i = 0; i < document[n].length; i += 1) {
      document[n][i].index = [n, i]
    }
  }
  // let ptrs = b.fullPointer
  // console.log(ptrs)
  // for (let i = 0; i < docs.length; i += 1) {
  //   const [n, start] = ptrs[i]
  //   for (let t = 0; t < docs[i].length; t += 1) {
  //     let term = docs[i][t]
  //     term.index = [n, start + t]
  //   }
  // }
}

export default index