
// get the suffix diff between a and b
const generateRule = function (pair, peekLen = 0) {
  let all = []
  let [from, to] = pair
  for (let i = 0; i < from.length; i += 1) {
    if (from[i] === to[i]) {
      all.push(from[i])
    } else {
      break
    }
  }
  let prefix = all.length - peekLen
  // is our suffix just the whole word? (not allowed!)
  if (peekLen >= all.length) {
    return null
  }
  return {
    from: from.substring(prefix),
    to: to.substring(prefix)
  }
}

export default generateRule
