// https://www.trentu.ca/history/subordinate-clause-and-complex-sentence
const list = [
  'after',
  'although',
  'as if',
  'as long as',
  'as',
  'because',
  'before',
  'even if',
  'even though',
  'ever since',
  'if',
  'in order that',
  'provided that',
  'since',
  'so that',
  'than',
  'that',
  'though',
  'unless',
  'until',
  'what',
  'whatever',
  'when',
  'whenever',
  'where',
  'whereas',
  'wherever',
  'whether',
  'which',
  'whichever',
  'who',
  'whoever',
  'whom',
  'whomever',
  'whose',
]

const isSubordinate = function (m) {
  // athletes from toronto, days since december
  if (m.before('#Preposition$').found) {
    return true
  }
  let leadIn = m.before()
  if (!leadIn.found) {
    return false
  }
  for (let i = 0; i < list.length; i += 1) {
    if (m.has(list[i])) {
      return true
    }
  }
  return false
}
export default isSubordinate
