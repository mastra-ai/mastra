import parseNoun from './parse.js'

const toText = m => m.text()
const toArray = m => m.json({ terms: false, normal: true }).map(s => s.normal)

const getNum = function (m) {
  let num = null
  if (!m.found) {
    return num
  }
  let val = m.values(0)
  if (val.found) {
    let obj = val.parse()[0] || {}
    return obj.num
  }
  return num
}

const toJSON = function (m) {
  let res = parseNoun(m)
  return {
    root: toText(res.root),
    number: getNum(res.number),
    determiner: toText(res.determiner),
    adjectives: toArray(res.adjectives),
    isPlural: res.isPlural,
    isSubordinate: res.isSubordinate,
  }
}
export default toJSON
