const hasHyphen = function (str, model) {
  let parts = str.split(/[-–—]/)
  if (parts.length <= 1) {
    return false
  }
  const { prefixes, suffixes } = model.one

  // l-theanine, x-ray
  if (parts[0].length === 1 && /[a-z]/i.test(parts[0])) {
    return false
  }
  //dont split 're-do'
  if (prefixes.hasOwnProperty(parts[0])) {
    return false
  }
  //dont split 'flower-like'
  parts[1] = parts[1].trim().replace(/[.?!]$/, '')
  if (suffixes.hasOwnProperty(parts[1])) {
    return false
  }
  //letter-number 'aug-20'
  let reg = /^([a-z\u00C0-\u00FF`"'/]+)[-–—]([a-z0-9\u00C0-\u00FF].*)/i
  if (reg.test(str) === true) {
    return true
  }
  //number-letter '20-aug'
  let reg2 = /^[('"]?([0-9]{1,4})[-–—]([a-z\u00C0-\u00FF`"'/-]+[)'"]?$)/i
  if (reg2.test(str) === true) {
    return true
  }
  return false
}

const splitHyphens = function (word) {
  let arr = []
  //support multiple-hyphenated-terms
  const hyphens = word.split(/[-–—]/)
  let whichDash = '-'
  let found = word.match(/[-–—]/)
  if (found && found[0]) {
    whichDash = found
  }
  for (let o = 0; o < hyphens.length; o++) {
    if (o === hyphens.length - 1) {
      arr.push(hyphens[o])
    } else {
      arr.push(hyphens[o] + whichDash)
    }
  }
  return arr
}

export { splitHyphens, hasHyphen }
