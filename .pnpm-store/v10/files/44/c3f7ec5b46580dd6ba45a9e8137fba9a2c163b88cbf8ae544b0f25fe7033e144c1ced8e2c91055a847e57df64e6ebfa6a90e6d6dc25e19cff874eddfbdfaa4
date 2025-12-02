const postPunct = /[,)"';:\-–—.…]/

const setContraction = function (m, suffix) {
  if (!m.found) {
    return
  }
  let terms = m.termList()
  //avoid any problematic punctuation
  for (let i = 0; i < terms.length - 1; i++) {
    const t = terms[i]
    if (postPunct.test(t.post)) {
      return
    }
  }
  // set first word as full text
  terms[0].implicit = terms[0].normal
  terms[0].text += suffix
  terms[0].normal += suffix
  // clean-up the others
  terms.slice(1).forEach(t => {
    t.implicit = t.normal
    t.text = ''
    t.normal = ''
  })
  for (let i = 0; i < terms.length - 1; i++) {
    terms[i].post = terms[i].post.replace(/ /, '')
  }
}

/** turn 'i am' into i'm */
const contract = function () {
  let doc = this.not('@hasContraction')
  // we are -> we're
  let m = doc.match('(we|they|you) are')
  setContraction(m, `'re`)
  // they will -> they'll
  m = doc.match('(he|she|they|it|we|you) will')
  setContraction(m, `'ll`)
  // she is -> she's
  m = doc.match('(he|she|they|it|we) is')
  setContraction(m, `'s`)
  // spencer is -> spencer's
  m = doc.match('#Person is')
  setContraction(m, `'s`)
  // spencer would -> spencer'd
  m = doc.match('#Person would')
  setContraction(m, `'d`)
  // would not -> wouldn't
  m = doc.match('(is|was|had|would|should|could|do|does|have|has|can) not')
  setContraction(m, `n't`)
  // i have -> i've
  m = doc.match('(i|we|they) have')
  setContraction(m, `'ve`)
  // would have -> would've
  m = doc.match('(would|should|could) have')
  setContraction(m, `'ve`)
  // i am -> i'm
  m = doc.match('i am')
  setContraction(m, `'m`)
  // going to -> gonna
  m = doc.match('going to')
  return this
}
export default contract
