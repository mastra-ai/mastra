import parseVerb from './parse/index.js'
import getGrammar from './parse/grammar/index.js'
import { getTense } from './lib.js'

const toArray = function (m) {
  if (!m || !m.isView) {
    return []
  }
  const opts = { normal: true, terms: false, text: false }
  return m.json(opts).map(s => s.normal)
}

const toText = function (m) {
  if (!m || !m.isView) {
    return ''
  }
  return m.text('normal')
}

const toInf = function (root) {
  const { toInfinitive } = root.methods.two.transform.verb
  let str = root.text('normal')
  return toInfinitive(str, root.model, getTense(root))
}

const toJSON = function (vb) {
  let parsed = parseVerb(vb)
  vb = vb.clone().toView()
  const info = getGrammar(vb, parsed)
  return {
    root: parsed.root.text(),
    preAdverbs: toArray(parsed.adverbs.pre),
    postAdverbs: toArray(parsed.adverbs.post),
    auxiliary: toText(parsed.auxiliary),
    negative: parsed.negative.found,
    prefix: toText(parsed.prefix),
    infinitive: toInf(parsed.root),
    grammar: info,
  }
}
export default toJSON
