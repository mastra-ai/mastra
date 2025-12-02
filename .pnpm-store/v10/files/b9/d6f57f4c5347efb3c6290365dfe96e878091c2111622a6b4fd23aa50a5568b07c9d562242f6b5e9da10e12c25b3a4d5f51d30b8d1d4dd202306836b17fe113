import validate from '../validate/index.js'

const prep = function (pairs, ex) {
  // remove dupes
  pairs = validate(pairs)
  // ensure pairs are prefix aligned, in the first-place
  return pairs.filter(arr => {
    let [a, b] = arr
    if (a.substring(0, 1) !== b.substring(0, 1)) {
      ex[a] = b
      return false
    }
    return true
  })
}
export default prep