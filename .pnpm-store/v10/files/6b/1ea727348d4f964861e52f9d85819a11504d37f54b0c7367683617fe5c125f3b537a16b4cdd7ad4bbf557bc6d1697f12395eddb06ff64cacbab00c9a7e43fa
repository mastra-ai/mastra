const toFuture = function (s) {
  let verbs = s.verbs()
  // translate the first verb, no-stress
  let first = verbs.eq(0)
  first.toFutureTense()
  s = s.fullSentence()
  verbs = s.verbs()//re-do it
  // verbs.debug()
  // force agreement with any 2nd/3rd verbs:
  if (verbs.length > 1) {
    verbs = verbs.slice(1)
    // which following-verbs should we also change?
    let toChange = verbs.filter((vb) => {
      // remove any sorta infinitive - 'to engage'
      if (vb.lookBehind('to$').found) {
        return false
      }
      // is watching
      if (vb.has('#Copula #Gerund')) {
        return true
      }
      // keep -ing verbs
      if (vb.has('#Gerund')) {
        return false
      }
      // he is green and he is friendly
      if (vb.has('#Copula')) {
        return true
      }
      // 'he will see when he watches'
      if (vb.has('#PresentTense') && !vb.has('#Infinitive') && vb.lookBefore('(he|she|it|that|which)$').found) {
        return false
      }
      return true
    })
    // otherwise, change em too
    if (toChange.found) {
      toChange.forEach(m => {
        //extra rules for 'is'
        if (m.has('#Copula')) {
          // when he was out..
          m.match('was').replaceWith('is')
          // when he is out
          m.match('is').replaceWith('will be')
          return
        }
        // if (m.has('#PastTense')) {
        //   m.toPresentTense()
        //   return
        // }
        m.toInfinitive()
      })
    }
  }
  return s
}
export default toFuture