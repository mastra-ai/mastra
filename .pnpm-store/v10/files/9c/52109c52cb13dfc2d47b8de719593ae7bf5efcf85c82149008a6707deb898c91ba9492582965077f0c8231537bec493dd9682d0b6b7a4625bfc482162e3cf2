// check if two pointers are perfectly consecutive
const isNeighbour = function (ptrL, ptrR) {
  // validate
  if (!ptrL || !ptrR) {
    return false
  }
  // same sentence
  if (ptrL[0] !== ptrR[0]) {
    return false
  }
  // ensure R starts where L ends
  return ptrL[2] === ptrR[1]
}

// join two neighbouring words, if they both match
const mergeIf = function (doc, lMatch, rMatch) {
  const world = doc.world
  const parseMatch = world.methods.one.parseMatch
  lMatch = lMatch || '.$' //defaults
  rMatch = rMatch || '^.'
  let leftMatch = parseMatch(lMatch, {}, world)
  let rightMatch = parseMatch(rMatch, {}, world)
  // ensure end-requirement to left-match, start-requiremnts to right match
  leftMatch[leftMatch.length - 1].end = true
  rightMatch[0].start = true
  // let's get going.
  let ptrs = doc.fullPointer
  let res = [ptrs[0]]
  for (let i = 1; i < ptrs.length; i += 1) {
    let ptrL = res[res.length - 1]
    let ptrR = ptrs[i]
    let left = doc.update([ptrL])
    let right = doc.update([ptrR])
    // should we marge left+right?
    if (isNeighbour(ptrL, ptrR) && left.has(leftMatch) && right.has(rightMatch)) {
      // merge right ptr into existing result
      res[res.length - 1] = [ptrL[0], ptrL[1], ptrR[2], ptrL[3], ptrR[4]]
    } else {
      res.push(ptrR)
    }
  }
  // return new pointers
  return doc.update(res)
}

const methods = {
  //  merge only if conditions are met
  joinIf: function (lMatch, rMatch) {
    return mergeIf(this, lMatch, rMatch)
  },
  // merge all neighbouring matches
  join: function () {
    return mergeIf(this)
  },
}
export default methods
