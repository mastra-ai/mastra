const toPresent = function (s) {
  let verbs = s.verbs()
  // translate the first verb, no-stress
  let first = verbs.eq(0)
  // already present
  // if (first.has('#PresentTense')) {
  //   return s
  // }
  first.toPresentTense()

  // force agreement with any 2nd/3rd verbs:
  if (verbs.length > 1) {
    verbs = verbs.slice(1)
    // remove any sorta infinitive - 'to engage'
    verbs = verbs.filter((v) => !v.lookBehind('to$').found)

    // keep -ing verbs
    // verbs = verbs.if('#PresentTense')
    verbs = verbs.notIf('#Gerund')

    //run-on infinitive-list - 'to walk, sit and eat'
    // let list = s.match('to #Verb+ #Conjunction #Verb').terms()
    // verbs = verbs.not(list)

    // otherwise, I guess so?
    if (verbs.found) {
      verbs.verbs().toPresentTense()
    }
  }

  // s.compute('chunks')
  return s
}
export default toPresent