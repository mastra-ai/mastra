export default [
  // the planning processes
  { match: '(this|that|the|a|an) [#Gerund #Infinitive]', group: 0, tag: 'Singular', reason: 'the-planning-process' },
  // the paving stones
  { match: '(that|the) [#Gerund #PresentTense]', group: 0, ifNo: '#Copula', tag: 'Plural', reason: 'the-paving-stones' },
  // this swimming
  // { match: '(this|that|the) [#Gerund]', group: 0, tag: 'Noun', reason: 'this-gerund' },
  // the remaining claims
  { match: '#Determiner [#Gerund] #Noun', group: 0, tag: 'Adjective', reason: 'the-gerund-noun' },
  // i think tipping sucks
  { match: `#Pronoun #Infinitive [#Gerund] #PresentTense`, group: 0, tag: 'Noun', reason: 'tipping-sucks' },
  // early warning
  { match: '#Adjective [#Gerund]', group: 0, tag: 'Noun', notIf: '(still|even|just)', reason: 'early-warning' },
  //walking is cool
  { match: '[#Gerund] #Adverb? not? #Copula', group: 0, tag: 'Activity', reason: 'gerund-copula' },
  //are doing is
  { match: '#Copula [(#Gerund|#Activity)] #Copula', group: 0, tag: 'Gerund', reason: 'are-doing-is' },
  //walking should be fun
  { match: '[#Gerund] #Modal', group: 0, tag: 'Activity', reason: 'gerund-modal' },
  // finish listening
  // { match: '#Infinitive [#Gerund]', group: 0, tag: 'Activity', reason: 'finish-listening' },
  // the ruling party

  // responsibility for setting
  { match: '#Singular for [%Noun|Gerund%]', group: 0, tag: 'Gerund', reason: 'noun-for-gerund' },
  // better for training
  { match: '#Comparative (for|at) [%Noun|Gerund%]', group: 0, tag: 'Gerund', reason: 'better-for-gerund' },
  // keep the touching
  { match: '#PresentTense the [#Gerund]', group: 0, tag: 'Noun', reason: 'keep-the-touching' },
]
