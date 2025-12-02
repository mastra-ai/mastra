// match  'foo /yes/' and not 'foo/no/bar'
const bySlashes = /(?:^|\s)([![^]*(?:<[^<]*>)?\/.*?[^\\/]\/[?\]+*$~]*)(?:\s|$)/
// match '(yes) but not foo(no)bar'
const byParentheses = /([!~[^]*(?:<[^<]*>)?\([^)]+[^\\)]\)[?\]+*$~]*)(?:\s|$)/
// okay
const byWord = / /g

const isBlock = str => {
  return /^[![^]*(<[^<]*>)?\(/.test(str) && /\)[?\]+*$~]*$/.test(str)
}
const isReg = str => {
  return /^[![^]*(<[^<]*>)?\//.test(str) && /\/[?\]+*$~]*$/.test(str)
}

const cleanUp = function (arr) {
  arr = arr.map(str => str.trim())
  arr = arr.filter(str => str)
  return arr
}

const parseBlocks = function (txt) {
  // parse by /regex/ first
  let arr = txt.split(bySlashes)
  let res = []
  // parse by (blocks), next
  arr.forEach(str => {
    if (isReg(str)) {
      res.push(str)
      return
    }
    res = res.concat(str.split(byParentheses))
  })
  res = cleanUp(res)
  // split by spaces, now
  let final = []
  res.forEach(str => {
    if (isBlock(str)) {
      final.push(str)
    } else if (isReg(str)) {
      final.push(str)
    } else {
      final = final.concat(str.split(byWord))
    }
  })
  final = cleanUp(final)
  return final
}
export default parseBlocks
