const findVerbs = function (doc) {
  let m = doc.match('<Verb>')
  // want to see
  m = m.not('#Conjunction')
  // by walking
  m = m.not('#Preposition')


  m = m.splitAfter('@hasComma')

  // the reason he will is ...
  // all i do is talk
  m = m.splitAfter('[(do|did|am|was|is|will)] (is|was)', 0)
  // m = m.splitAfter('[(do|did|am|was|is|will)] #PresentTense', 0)

  // cool

  // like being pampered
  m = m.splitBefore('(#Verb && !#Copula) [being] #Verb', 0)
  // like to be pampered
  m = m.splitBefore('#Verb [to be] #Verb', 0)

  // implicit conjugation - 'help fix'

  m = m.splitAfter('[help] #PresentTense', 0)
  // what i can sell is..
  m = m.splitBefore('(#PresentTense|#PastTense) [#Copula]$', 0)
  // what i can sell will be
  m = m.splitBefore('(#PresentTense|#PastTense) [will be]$', 0)
  // directing had
  m = m.splitBefore('(#PresentTense|#PastTense) [(had|has)]', 0)

  // 'allow yourself'
  m = m.not('#Reflexive$')
  // sitting near
  m = m.not('#Adjective')

  // pastTense-pastTense
  // Everyone he [met] [told] him
  m = m.splitAfter('[#PastTense] #PastTense', 0)
  // Everyone he [met] had [told] him
  m = m.splitAfter('[#PastTense] #Auxiliary+ #PastTense', 0)

  // fans that were blowing felt amazing
  m = m.splitAfter('#Copula [#Gerund] #PastTense', 0)

  // managed to see
  // m = m.splitOn('#PastTense [to] #Infinitive', 0)


  //ensure there's actually a verb
  m = m.if('#Verb')
  // the reason he will is ...
  // ensure it's not two verbs
  // held annually is called
  if (m.has('(#Verb && !#Auxiliary) #Adverb+? #Copula')) {
    m = m.splitBefore('#Copula')
  }
  return m
}
export default findVerbs
