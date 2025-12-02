import getPerson from './findPerson.js'
import getThey from './findThey.js'
// import getIt from './findIt.js'
import { prevSentence } from './lib.js'

const addReference = function (pron, m) {
  if (m && m.found) {
    // add reference on the pronoun
    let term = pron.docs[0][0]//pronouns are 1 word only
    term.reference = m.ptrs[0]
  }
}

const stepBack = function (m, cb) {
  // 1st - in same sentence
  let s = m.before()
  let res = cb(s)
  if (res.found) {
    return res
  }
  // 2nd - previous sentence
  s = prevSentence(m)
  res = cb(s)
  if (res.found) {
    return res
  }
  // 3rd - two sentences back
  s = prevSentence(s)
  res = cb(s)
  if (res.found) {
    return res
  }
  return m.none()
}

const coreference = function (view) {
  let pronouns = view.pronouns().if('(he|him|his|she|her|hers|they|their|theirs|it|its)')
  pronouns.forEach(pron => {
    let res = null
    // connect pronoun to its reference
    if (pron.has('(he|him|his)')) {
      res = stepBack(pron, (m) => getPerson(m, 'm'))
    } else if (pron.has('(she|her|hers)')) {
      res = stepBack(pron, (m) => getPerson(m, 'f'))
    } else if (pron.has('(they|their|theirs)')) {
      res = stepBack(pron, getThey)
    }
    if (res && res.found) {
      addReference(pron, res)
    }
  })
}
export default coreference