import isSubordinate from './isSubordinate.js'
import isPlural from './isPlural.js'

const getRoot = function (m) {
  let tmp = m.clone()
  tmp = tmp.match('#Noun+')
  tmp = tmp.remove('(#Adjective|#Preposition|#Determiner|#Value)')
  tmp = tmp.not('#Possessive')
  tmp = tmp.first()
  if (!tmp.found) {
    return m
  }
  return tmp
}

const parseNoun = function (m) {
  let root = getRoot(m)
  return {
    determiner: m.match('#Determiner').eq(0),
    adjectives: m.match('#Adjective'),
    number: m.values(),
    isPlural: isPlural(m, root),
    isSubordinate: isSubordinate(m),
    root: root,
  }
}
export default parseNoun
