import { doesOverlap, getExtent, indexN, uniquePtrs } from './_lib.js'

// a union is a + b, minus duplicates
const getUnion = function (a, b) {
  let both = a.concat(b)
  let byN = indexN(both)
  let res = []
  both.forEach(ptr => {
    let [n] = ptr
    if (byN[n].length === 1) {
      // we're alone on this sentence, so we're good
      res.push(ptr)
      return
    }
    // there may be overlaps
    let hmm = byN[n].filter(m => doesOverlap(ptr, m))
    hmm.push(ptr)
    let range = getExtent(hmm)
    res.push(range)
  })
  res = uniquePtrs(res)
  return res
}
export default getUnion

// two disjoint
// console.log(getUnion([[1, 3, 4]], [[0, 1, 2]]))
// two disjoint
// console.log(getUnion([[0, 3, 4]], [[0, 1, 2]]))
// overlap-plus
// console.log(getUnion([[0, 1, 4]], [[0, 2, 6]]))
// overlap
// console.log(getUnion([[0, 1, 4]], [[0, 2, 3]]))
// neighbours
// console.log(getUnion([[0, 1, 3]], [[0, 3, 5]]))
