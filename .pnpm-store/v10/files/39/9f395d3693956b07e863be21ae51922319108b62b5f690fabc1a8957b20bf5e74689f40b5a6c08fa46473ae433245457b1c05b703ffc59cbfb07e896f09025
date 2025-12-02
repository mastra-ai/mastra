export default [
  //the above is clear
  { match: '#Determiner [#Adjective] #Copula', group: 0, tag: 'Noun', reason: 'the-adj-is' },
  //real evil is
  { match: '#Adjective [#Adjective] #Copula', group: 0, tag: 'Noun', reason: 'adj-adj-is' },
  //his fine
  { match: '(his|its) [%Adj|Noun%]', group: 0, tag: 'Noun', notIf: '#Hyphenated', reason: 'his-fine' },
  //is all
  { match: '#Copula #Adverb? [all]', group: 0, tag: 'Noun', reason: 'is-all' },
  // have fun
  { match: `(have|had) [#Adjective] #Preposition .`, group: 0, tag: 'Noun', reason: 'have-fun' },
  // brewing giant
  { match: `#Gerund (giant|capital|center|zone|application)`, tag: 'Noun', reason: 'brewing-giant' },
  // in an instant
  { match: `#Preposition (a|an) [#Adjective]$`, group: 0, tag: 'Noun', reason: 'an-instant' },
  // no golden would
  { match: `no [#Adjective] #Modal`, group: 0, tag: 'Noun', reason: 'no-golden' },
  // brand new
  { match: `[brand #Gerund?] new`, group: 0, tag: 'Adverb', reason: 'brand-new' },
  // some kind
  { match: `(#Determiner|#Comparative|new|different) [kind]`, group: 0, tag: 'Noun', reason: 'some-kind' },
  // her favourite sport
  { match: `#Possessive [%Adj|Noun%] #Noun`, group: 0, tag: 'Adjective', reason: 'her-favourite' },
  // must-win
  { match: `must && #Hyphenated .`, tag: 'Adjective', reason: 'must-win' },
  // the present
  {
    match: `#Determiner [#Adjective]$`,
    tag: 'Noun',
    notIf: '(this|that|#Comparative|#Superlative)',
    reason: 'the-south',
  }, //are that crazy.
  // company-wide
  {
    match: `(#Noun && #Hyphenated) (#Adjective && #Hyphenated)`,
    tag: 'Adjective',
    notIf: '(this|that|#Comparative|#Superlative)',
    reason: 'company-wide',
  },
  // the poor were
  {
    match: `#Determiner [#Adjective] (#Copula|#Determiner)`,
    notIf: '(#Comparative|#Superlative)',
    group: 0,
    tag: 'Noun',
    reason: 'the-poor',
  },
  // professional bodybuilder
  {
    match: `[%Adj|Noun%] #Noun`,
    notIf: '(#Pronoun|#ProperNoun)',
    group: 0,
    tag: 'Adjective',
    reason: 'stable-foundations',
  },
]
