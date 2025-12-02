import { doDoes, getTense } from '../lib.js'
const keep = { tags: true }

// all verb forms are the same
const toInf = function (vb, parsed) {
  const { toInfinitive } = vb.methods.two.transform.verb
  const { root, auxiliary } = parsed
  let aux = auxiliary.terms().harden()
  let str = root.text('normal')
  str = toInfinitive(str, vb.model, getTense(root))
  if (str) {
    vb.replace(root, str, keep).tag('Verb').firstTerm().tag('Infinitive')
  }
  // remove any auxiliary terms
  if (aux.found) {
    vb.remove(aux)
  }
  // there is no real way to do this
  // 'i not walk'?  'i walk not'?
  if (parsed.negative.found) {
    if (!vb.has('not')) {
      vb.prepend('not')
    }
    let does = doDoes(vb, parsed)
    vb.prepend(does)
  }
  vb.fullSentence().compute(['freeze', 'lexicon', 'preTagger', 'postTagger', 'unfreeze', 'chunks'])
  return vb
}
export default toInf
