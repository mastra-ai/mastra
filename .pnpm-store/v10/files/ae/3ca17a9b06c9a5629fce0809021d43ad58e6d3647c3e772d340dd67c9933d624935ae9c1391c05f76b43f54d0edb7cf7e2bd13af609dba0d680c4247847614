// finally,
// actually run these match-statements on the terms
const runMatch = function (maybeList, document, docCache, methods, opts) {
  let results = []
  for (let n = 0; n < maybeList.length; n += 1) {
    for (let i = 0; i < maybeList[n].length; i += 1) {
      let m = maybeList[n][i]
      // ok, actually do the work.
      let res = methods.one.match([document[n]], m)
      // found something.
      if (res.ptrs.length > 0) {
        res.ptrs.forEach(ptr => {
          ptr[0] = n // fix the sentence pointer
          // check ifNo
          // if (m.ifNo !== undefined) {
          //   let terms = document[n].slice(ptr[1], ptr[2])
          //   for (let k = 0; k < m.ifNo.length; k += 1) {
          //     const no = m.ifNo[k]
          //     // quick-check cache
          //     if (docCache[n].has(no)) {
          //       if (no.startsWith('#')) {
          //         let tag = no.replace(/^#/, '')
          //         if (terms.find(t => t.tags.has(tag))) {
          //           console.log('+' + tag)
          //           return
          //         }
          //       } else if (terms.find(t => t.normal === no || t.tags.has(no))) {
          //         console.log('+' + no)
          //         return
          //       }
          //     }
          //   }
          // }
          let todo = Object.assign({}, m, { pointer: ptr })
          if (m.unTag !== undefined) {
            todo.unTag = m.unTag
          }
          results.push(todo)
        })
        //ok cool, can we stop early?
        if (opts.matchOne === true) {
          return [results[0]]
        }
      }
    }
  }
  return results
}
export default runMatch
