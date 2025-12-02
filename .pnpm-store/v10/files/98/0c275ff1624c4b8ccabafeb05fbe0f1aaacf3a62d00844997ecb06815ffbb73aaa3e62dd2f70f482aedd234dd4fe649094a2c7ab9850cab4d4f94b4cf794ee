const parseVerb = function (chunk) {
  let obj = chunk.verbs().json()[0].verb
  return {
    chunk: 'Verb',
    ptr: obj.ptr = chunk.ptrs[0],
    desc: obj.preAdverbs.concat(obj.postAdverbs),
    negative: obj.negative,
    root: obj.infinitive,
    tense: obj.grammar.tense,
    copula: obj.grammar.copula,
    imperative: chunk.has('#Imperative'),
    hypothetical: chunk.has('(would|could) #Adverb? have')
  }
}
export default parseVerb