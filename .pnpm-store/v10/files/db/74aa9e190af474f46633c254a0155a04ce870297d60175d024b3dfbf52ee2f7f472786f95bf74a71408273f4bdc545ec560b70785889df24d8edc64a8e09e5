// index rules by last-char
const indexRules = function (rules) {
  let byChar = {}
  rules.forEach((a) => {
    let suff = a[0] || ''
    let char = suff[suff.length - 1] || ''
    byChar[char] = byChar[char] || []
    byChar[char].push(a)
  })
  return byChar
}

const unIndex = function (byChar) {
  let arr = []
  Object.keys(byChar).forEach(k => {
    arr = arr.concat(byChar[k])
  })
  return arr
}

const sortRules = function (rules) {
  rules = rules.sort((a, b) => {
    if (a[0].length > b[0].length) {
      return -1
    } else if (a[0].length < b[0].length) {
      return 1
    }
    return 0
  })
  return rules
}

export {
  indexRules, unIndex, sortRules
}