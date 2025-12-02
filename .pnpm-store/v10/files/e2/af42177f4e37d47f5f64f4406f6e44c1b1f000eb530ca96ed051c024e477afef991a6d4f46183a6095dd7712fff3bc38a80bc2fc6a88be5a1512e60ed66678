// fuzzy-match (damerau-levenshtein)
// Based on  tad-lispy /node-damerau-levenshtein
// https://github.com/tad-lispy/node-damerau-levenshtein/blob/master/index.js
// count steps (insertions, deletions, substitutions, or transpositions)
const editDistance = function (strA, strB) {
  let aLength = strA.length,
    bLength = strB.length
  // fail-fast
  if (aLength === 0) {
    return bLength
  }
  if (bLength === 0) {
    return aLength
  }
  // If the limit is not defined it will be calculate from this and that args.
  let limit = (bLength > aLength ? bLength : aLength) + 1
  if (Math.abs(aLength - bLength) > (limit || 100)) {
    return limit || 100
  }
  // init the array
  let matrix = []
  for (let i = 0; i < limit; i++) {
    matrix[i] = [i]
    matrix[i].length = limit
  }
  for (let i = 0; i < limit; i++) {
    matrix[0][i] = i
  }
  // Calculate matrix.
  let j, a_index, b_index, cost, min, t
  for (let i = 1; i <= aLength; ++i) {
    a_index = strA[i - 1]
    for (j = 1; j <= bLength; ++j) {
      // Check the jagged distance total so far
      if (i === j && matrix[i][j] > 4) {
        return aLength
      }
      b_index = strB[j - 1]
      cost = a_index === b_index ? 0 : 1 // Step 5
      // Calculate the minimum (much faster than Math.min(...)).
      min = matrix[i - 1][j] + 1 // Deletion.
      if ((t = matrix[i][j - 1] + 1) < min) min = t // Insertion.
      if ((t = matrix[i - 1][j - 1] + cost) < min) min = t // Substitution.
      // Update matrix.
      let shouldUpdate =
        i > 1 && j > 1 && a_index === strB[j - 2] && strA[i - 2] === b_index && (t = matrix[i - 2][j - 2] + cost) < min
      if (shouldUpdate) {
        matrix[i][j] = t
      } else {
        matrix[i][j] = min
      }
    }
  }
  // return number of steps
  return matrix[aLength][bLength]
}
// score similarity by from 0-1 (steps/length)
const fuzzyMatch = function (strA, strB, minLength = 3) {
  if (strA === strB) {
    return 1
  }
  //don't even bother on tiny strings
  if (strA.length < minLength || strB.length < minLength) {
    return 0
  }
  const steps = editDistance(strA, strB)
  let length = Math.max(strA.length, strB.length)
  let relative = length === 0 ? 0 : steps / length
  let similarity = 1 - relative
  return similarity
}
export default fuzzyMatch
