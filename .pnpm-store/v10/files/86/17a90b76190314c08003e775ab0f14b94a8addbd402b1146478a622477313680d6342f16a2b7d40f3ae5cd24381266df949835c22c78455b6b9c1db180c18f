export default [
  //sometimes adverbs - 'pretty good','well above'
  {
    match: '#Copula (pretty|dead|full|well|sure) (#Adjective|#Noun)',
    tag: '#Copula #Adverb #Adjective',
    reason: 'sometimes-adverb',
  },
  //i better ..
  { match: '(#Pronoun|#Person) (had|#Adverb)? [better] #PresentTense', group: 0, tag: 'Modal', reason: 'i-better' },
  // adj -> gerund
  // like
  { match: '(#Modal|i|they|we|do) not? [like]', group: 0, tag: 'PresentTense', reason: 'modal-like' },
  // ==== Tense ====
  //he left
  { match: '#Noun #Adverb? [left]', group: 0, tag: 'PastTense', reason: 'left-verb' },

  // ==== Copula ====
  //will be running (not copula)
  { match: 'will #Adverb? not? #Adverb? [be] #Gerund', group: 0, tag: 'Copula', reason: 'will-be-copula' },
  //for more complex forms, just tag 'be'
  { match: 'will #Adverb? not? #Adverb? [be] #Adjective', group: 0, tag: 'Copula', reason: 'be-copula' },
  // ==== Infinitive ====
  //march to
  { match: '[march] (up|down|back|toward)', notIf: '#Date', group: 0, tag: 'Infinitive', reason: 'march-to' },
  //must march
  { match: '#Modal [march]', group: 0, tag: 'Infinitive', reason: 'must-march' },
  // may be
  { match: `[may] be`, group: 0, tag: 'Verb', reason: 'may-be' },
  // subject to
  { match: `[(subject|subjects|subjected)] to`, group: 0, tag: 'Verb', reason: 'subject to' },
  // subject to
  { match: `[home] to`, group: 0, tag: 'PresentTense', reason: 'home to' },

  // === misc==
  // side with
  // { match: '[(side|fool|monkey)] with', group: 0, tag: 'Infinitive', reason: 'fool-with' },
  // open the door
  { match: '[open] #Determiner', group: 0, tag: 'Infinitive', reason: 'open-the' },
  //were being run
  { match: `(were|was) being [#PresentTense]`, group: 0, tag: 'PastTense', reason: 'was-being' },
  //had been broken
  { match: `(had|has|have) [been /en$/]`, group: 0, tag: 'Auxiliary Participle', reason: 'had-been-broken' },
  //had been smoked
  { match: `(had|has|have) [been /ed$/]`, group: 0, tag: 'Auxiliary PastTense', reason: 'had-been-smoked' },
  //were being run
  { match: `(had|has) #Adverb? [been] #Adverb? #PastTense`, group: 0, tag: 'Auxiliary', reason: 'had-been-adj' },
  //had to walk
  { match: `(had|has) to [#Noun] (#Determiner|#Possessive)`, group: 0, tag: 'Infinitive', reason: 'had-to-noun' },
  // have read
  { match: `have [#PresentTense]`, group: 0, tag: 'PastTense', notIf: '(come|gotten)', reason: 'have-read' },
  // does that work
  { match: `(does|will|#Modal) that [work]`, group: 0, tag: 'PastTense', reason: 'does-that-work' },
  // sounds fun
  { match: `[(sound|sounds)] #Adjective`, group: 0, tag: 'PresentTense', reason: 'sounds-fun' },
  // look good
  { match: `[(look|looks)] #Adjective`, group: 0, tag: 'PresentTense', reason: 'looks-good' },
  // stops thinking
  { match: `[(start|starts|stop|stops|begin|begins)] #Gerund`, group: 0, tag: 'Verb', reason: 'starts-thinking' },
  // have read
  { match: `(have|had) read`, tag: 'Modal #PastTense', reason: 'read-read' },
  //were under cooked
  {
    match: `(is|was|were) [(under|over) #PastTense]`,
    group: 0,
    tag: 'Adverb Adjective',
    reason: 'was-under-cooked',
  },

  // damn them
  { match: '[shit] (#Determiner|#Possessive|them)', group: 0, tag: 'Verb', reason: 'swear1-verb' },
  { match: '[damn] (#Determiner|#Possessive|them)', group: 0, tag: 'Verb', reason: 'swear2-verb' },
  { match: '[fuck] (#Determiner|#Possessive|them)', group: 0, tag: 'Verb', reason: 'swear3-verb' },

  // jobs that fit
  { match: '#Plural that %Noun|Verb%', tag: '. #Preposition #Infinitive', reason: 'jobs-that-work' },
  // works for me
  { match: '[works] for me', group: 0, tag: 'PresentTense', reason: 'works-for-me' },
  // as we please
  { match: 'as #Pronoun [please]', group: 0, tag: 'Infinitive', reason: 'as-we-please' },
  // verb-prefixes - 'co write'
  { match: '[(co|mis|de|inter|intra|pre|re|un|out|under|over|counter)] #Verb', group: 0, tag: ['Verb', 'Prefix'], notIf: '(#Copula|#PhrasalVerb)', reason: 'co-write' },
  // dressed and left
  { match: '#PastTense and [%Adj|Past%]', group: 0, tag: 'PastTense', reason: 'dressed-and-left' },
  // melted and fallen
  { match: '[%Adj|Past%] and #PastTense', group: 0, tag: 'PastTense', reason: 'dressed-and-left' },
  // is he stoked
  { match: '#Copula #Pronoun [%Adj|Past%]', group: 0, tag: 'Adjective', reason: 'is-he-stoked' },
  // to dream of
  { match: 'to [%Noun|Verb%] #Preposition', group: 0, tag: 'Infinitive', reason: 'to-dream-of' },
]
