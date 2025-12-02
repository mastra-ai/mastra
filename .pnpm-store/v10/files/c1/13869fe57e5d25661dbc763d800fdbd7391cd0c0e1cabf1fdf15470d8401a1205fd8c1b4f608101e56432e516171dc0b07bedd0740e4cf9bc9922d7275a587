const hasContraction = /'/
//look for a past-tense verb
// const hasPastTense = (terms, i) => {
//   let after = terms.slice(i + 1, i + 3)
//   return after.some(t => t.tags.has('PastTense'))
// }
// he'd walked -> had
// how'd -> did
// he'd go -> would

const alwaysDid = new Set([
  'what',
  'how',
  'when',
  'where',
  'why',
])

// after-words
const useWould = new Set([
  'be',
  'go',
  'start',
  'think',
  'need',
])

const useHad = new Set([
  'been',
  'gone'
])
// they'd gone
// they'd go


// he'd been
//    he had been
//    he would been

const _apostropheD = function (terms, i) {
  let before = terms[i].normal.split(hasContraction)[0]

  // what'd, how'd
  if (alwaysDid.has(before)) {
    return [before, 'did']
  }
  if (terms[i + 1]) {
    // they'd gone
    if (useHad.has(terms[i + 1].normal)) {
      return [before, 'had']
    }
    // they'd go
    if (useWould.has(terms[i + 1].normal)) {
      return [before, 'would']
    }
  }
  return null
  //   if (hasPastTense(terms, i) === true) {
  //     return [before, 'had']
  //   }
  //   // had/would/did
  //   return [before, 'would']
}
export default _apostropheD
