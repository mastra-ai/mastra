import { doesOverlap, indexN } from './_lib.js'

// [a,a,a,a,-,-,]
// [-,-,b,b,b,-,]
// [-,-,x,x,-,-,]
const intersection = function (a, b) {
  // find the latest-start
  let start = a[1] < b[1] ? b[1] : a[1]
  // find the earliest-end
  let end = a[2] > b[2] ? b[2] : a[2]
  // does it form a valid pointer?
  if (start < end) {
    return [a[0], start, end]
  }
  return null
}

const getIntersection = function (a, b) {
  let byN = indexN(b)
  let res = []
  a.forEach(ptr => {
    let hmm = byN[ptr[0]] || []
    hmm = hmm.filter(p => doesOverlap(ptr, p))
    // no sentence-pairs, so no intersection
    if (hmm.length === 0) {
      return
    }
    hmm.forEach(h => {
      let overlap = intersection(ptr, h)
      if (overlap) {
        res.push(overlap)
      }
    })
  })
  return res
}
export default getIntersection

// console.log(getIntersection([[0, 1, 3]], [[0, 2, 4]]))
