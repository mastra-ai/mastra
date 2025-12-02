const anyIntersection = function (setA, setB) {
  for (let elem of setB) {
    if (setA.has(elem)) {
      return true
    }
  }
  return false
}
// check words/tags against our cache
const failFast = function (regs, cache) {
  for (let i = 0; i < regs.length; i += 1) {
    let reg = regs[i]
    if (reg.optional === true || reg.negative === true || reg.fuzzy === true) {
      continue
    }
    // is the word missing from the cache?
    if (reg.word !== undefined && cache.has(reg.word) === false) {
      return true
    }
    // is the tag missing?
    if (reg.tag !== undefined && cache.has('#' + reg.tag) === false) {
      return true
    }
    // perform a speedup for fast-or
    if (reg.fastOr && anyIntersection(reg.fastOr, cache) === false) {
      return false
    }
  }
  return false
}
export default failFast
