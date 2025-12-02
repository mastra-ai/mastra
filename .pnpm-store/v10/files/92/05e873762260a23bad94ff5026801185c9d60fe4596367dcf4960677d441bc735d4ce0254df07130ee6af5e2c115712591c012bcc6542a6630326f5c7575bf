// do the pointers intersect?
export const doesOverlap = function (a, b) {
  if (a[0] !== b[0]) {
    return false
  }
  let [, startA, endA] = a
  let [, startB, endB] = b
  // [a,a,a,-,-,-,]
  // [-,-,b,b,b,-,]
  if (startA <= startB && endA > startB) {
    return true
  }
  // [-,-,-,a,a,-,]
  // [-,-,b,b,b,-,]
  if (startB <= startA && endB > startA) {
    return true
  }
  return false
}

// get widest min/max
export const getExtent = function (ptrs) {
  let min = ptrs[0][1]
  let max = ptrs[0][2]
  ptrs.forEach(ptr => {
    if (ptr[1] < min) {
      min = ptr[1]
    }
    if (ptr[2] > max) {
      max = ptr[2]
    }
  })
  return [ptrs[0][0], min, max]
}

// collect pointers by sentence number
export const indexN = function (ptrs) {
  let byN = {}
  ptrs.forEach(ref => {
    byN[ref[0]] = byN[ref[0]] || []
    byN[ref[0]].push(ref)
  })
  return byN
}

// remove exact duplicates
export const uniquePtrs = function (arr) {
  let obj = {}
  for (let i = 0; i < arr.length; i += 1) {
    obj[arr[i].join(',')] = arr[i]
  }
  return Object.values(obj)
}

// a before b
// console.log(doesOverlap([0, 0, 4], [0, 2, 5]))
// // b before a
// console.log(doesOverlap([0, 3, 4], [0, 1, 5]))
// // disjoint
// console.log(doesOverlap([0, 0, 3], [0, 4, 5]))
// neighbours
// console.log(doesOverlap([0, 1, 3], [0, 3, 5]))
// console.log(doesOverlap([0, 3, 5], [0, 1, 3]))

// console.log(
//   getExtent([
//     [0, 3, 4],
//     [0, 4, 5],
//     [0, 1, 2],
//   ])
// )
