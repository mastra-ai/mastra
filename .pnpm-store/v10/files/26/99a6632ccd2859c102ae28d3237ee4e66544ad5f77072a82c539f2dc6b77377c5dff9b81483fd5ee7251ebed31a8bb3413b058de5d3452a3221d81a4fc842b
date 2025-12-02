import { getTense, isAreAm } from '../lib.js'
const keep = { tags: true }

// all verb forms are the same
const toGerund = function (vb, parsed) {
  // console.log(form)
  const { toInfinitive, conjugate } = vb.methods.two.transform.verb
  const { root, auxiliary } = parsed
  if (vb.has('#Gerund')) {
    return vb
  }

  // conjugate '-ing' verb
  let str = root.text('normal')
  str = toInfinitive(str, vb.model, getTense(root))
  let gerund = conjugate(str, vb.model).Gerund
  // 'are walking', 'is walking'
  if (gerund) {
    let aux = isAreAm(vb, parsed)
    vb.replace(root, gerund, keep)
    vb.remove(auxiliary)
    vb.prepend(aux)//.match(aux)
  }
  // remove any existing auxiliary
  // if (auxiliary.found) {
  // vb.match(auxiliary).debug()
  // vb.remove(auxiliary)
  // }

  vb.replace('not is', 'is not')
  vb.replace('not are', 'are not')
  vb.fullSentence().compute(['tagger', 'chunks'])
  return vb
}
export default toGerund
