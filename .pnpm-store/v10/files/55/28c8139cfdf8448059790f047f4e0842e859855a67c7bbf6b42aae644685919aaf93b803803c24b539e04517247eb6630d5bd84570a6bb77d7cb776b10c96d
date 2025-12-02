import swapVerb from './swap-verb.js'

const swapNoun = function (m, lemma) {
  let str = lemma
  if (m.has('#Plural')) {
    const toPlural = m.methods.two.transform.noun.toPlural
    str = toPlural(lemma, m.model)
  }
  m.replaceWith(str, { possessives: true })
}

const swapAdverb = function (m, lemma) {
  const { toAdverb } = m.methods.two.transform.adjective
  let str = lemma
  let adv = toAdverb(str)
  if (adv) {
    m.replaceWith(adv)
  }
}
const swapAdjective = function (m, lemma) {
  const { toComparative, toSuperlative } = m.methods.two.transform.adjective
  let str = lemma
  if (m.has('#Comparative')) {
    str = toComparative(str, m.model)
  } else if (m.has('#Superlative')) {
    str = toSuperlative(str, m.model)
  }
  if (str) {
    m.replaceWith(str)
  }
}

const swap = function (from, to, tag) {
  let reg = from.split(/ /g).map(str => str.toLowerCase().trim())
  reg = reg.filter(str => str)
  reg = reg.map(str => `{${str}}`).join(' ')
  let m = this.match(reg)
  // guard against some homonyms
  if (tag) {
    m = m.if(tag)
  }
  if (m.has('#Verb')) {
    return swapVerb(m, to)
  }
  if (m.has('#Noun')) {
    return swapNoun(m, to)
  }
  if (m.has('#Adverb')) {
    return swapAdverb(m, to)
  }
  if (m.has('#Adjective')) {
    return swapAdjective(m, to)
  }
  return this
}
export default swap