export default [
  // amusing his aunt
  // { match: '[#Adjective] #Possessive #Noun', group: 0, tag: 'Verb', reason: 'gerund-his-noun' },
  // loving you
  // { match: '[#Adjective] (us|you)', group: 0, tag: 'Gerund', reason: 'loving-you' },
  // slowly stunning
  { match: '(slowly|quickly) [#Adjective]', group: 0, tag: 'Verb', reason: 'slowly-adj' },
  // does mean
  { match: 'does (#Adverb|not)? [#Adjective]', group: 0, tag: 'PresentTense', reason: 'does-mean' },
  // okay by me
  { match: '[(fine|okay|cool|ok)] by me', group: 0, tag: 'Adjective', reason: 'okay-by-me' },
  // i mean
  { match: 'i (#Adverb|do)? not? [mean]', group: 0, tag: 'PresentTense', reason: 'i-mean' },
  //will secure our
  { match: 'will #Adjective', tag: 'Auxiliary Infinitive', reason: 'will-adj' },
  //he disguised the thing
  { match: '#Pronoun [#Adjective] #Determiner #Adjective? #Noun', group: 0, tag: 'Verb', reason: 'he-adj-the' },
  //is eager to go
  { match: '#Copula [%Adj|Present%] to #Verb', group: 0, tag: 'Verb', reason: 'adj-to' },
  //is done well
  { match: '#Copula [#Adjective] (well|badly|quickly|slowly)', group: 0, tag: 'Verb', reason: 'done-well' },
  // rude and insulting
  { match: '#Adjective and [#Gerund] !#Preposition?', group: 0, tag: 'Adjective', reason: 'rude-and-x' },
  // were over cooked
  { match: '#Copula #Adverb? (over|under) [#PastTense]', group: 0, tag: 'Adjective', reason: 'over-cooked' },
  // was bland and overcooked
  { match: '#Copula #Adjective+ (and|or) [#PastTense]$', group: 0, tag: 'Adjective', reason: 'bland-and-overcooked' },
  // got tired of
  { match: 'got #Adverb? [#PastTense] of', group: 0, tag: 'Adjective', reason: 'got-tired-of' },
  //felt loved
  {
    match:
      '(seem|seems|seemed|appear|appeared|appears|feel|feels|felt|sound|sounds|sounded) (#Adverb|#Adjective)? [#PastTense]',
    group: 0,
    tag: 'Adjective',
    reason: 'felt-loved',
  },
  // seem confused
  { match: '(seem|feel|seemed|felt) [#PastTense #Particle?]', group: 0, tag: 'Adjective', reason: 'seem-confused' },
  // a bit confused
  { match: 'a (bit|little|tad) [#PastTense #Particle?]', group: 0, tag: 'Adjective', reason: 'a-bit-confused' },
  // do not be embarrassed
  { match: 'not be [%Adj|Past% #Particle?]', group: 0, tag: 'Adjective', reason: 'do-not-be-confused' },
  // is just right
  { match: '#Copula just [%Adj|Past% #Particle?]', group: 0, tag: 'Adjective', reason: 'is-just-right' },
  // as pale as
  { match: 'as [#Infinitive] as', group: 0, tag: 'Adjective', reason: 'as-pale-as' },
  //failed and oppressive
  { match: '[%Adj|Past%] and #Adjective', group: 0, tag: 'Adjective', reason: 'faled-and-oppressive' },
  // or heightened emotion
  {
    match: 'or [#PastTense] #Noun',
    group: 0,
    tag: 'Adjective',
    notIf: '(#Copula|#Pronoun)',
    reason: 'or-heightened-emotion',
  },
  // became involved
  { match: '(become|became|becoming|becomes) [#Verb]', group: 0, tag: 'Adjective', reason: 'become-verb' },
  // their declared intentions
  { match: '#Possessive [#PastTense] #Noun', group: 0, tag: 'Adjective', reason: 'declared-intentions' },
  // is he cool
  { match: '#Copula #Pronoun [%Adj|Present%]', group: 0, tag: 'Adjective', reason: 'is-he-cool' },
  // is crowded with
  {
    match: '#Copula [%Adj|Past%] with',
    group: 0,
    tag: 'Adjective',
    notIf: '(associated|worn|baked|aged|armed|bound|fried|loaded|mixed|packed|pumped|filled|sealed)',
    reason: 'is-crowded-with',
  },
  // is empty$
  { match: '#Copula #Adverb? [%Adj|Present%]$', group: 0, tag: 'Adjective', reason: 'was-empty$' },
]
