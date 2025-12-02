const matchVerb = function (m, lemma) {
  const conjugate = m.methods.two.transform.verb.conjugate
  let all = conjugate(lemma, m.model)
  if (m.has('#Gerund')) {
    return all.Gerund
  }
  if (m.has('#PastTense')) {
    return all.PastTense
  }
  if (m.has('#PresentTense')) {
    return all.PresentTense
  }
  if (m.has('#Gerund')) {
    return all.Gerund
  }
  return lemma
}

const swapVerb = function (vb, lemma) {
  let str = lemma
  vb.forEach(m => {
    if (!m.has('#Infinitive')) {
      str = matchVerb(m, lemma)
    }
    m.replaceWith(str)
  })
  return vb
}
export default swapVerb