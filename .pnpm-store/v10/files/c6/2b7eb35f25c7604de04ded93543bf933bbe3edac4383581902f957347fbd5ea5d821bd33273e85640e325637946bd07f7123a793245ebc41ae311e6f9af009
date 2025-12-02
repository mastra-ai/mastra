const rules = [
  // === Conjunction ===
  // that the houses
  { match: '[that] #Determiner #Noun', group: 0, chunk: 'Pivot' },
  // estimated that
  { match: '#PastTense [that]', group: 0, chunk: 'Pivot' },
  // so the
  { match: '[so] #Determiner', group: 0, chunk: 'Pivot' },

  // === Adjective ===
  // was really nice
  { match: '#Copula #Adverb+? [#Adjective]', group: 0, chunk: 'Adjective' },
  // was nice
  // { match: '#Copula [#Adjective]', group: 0, chunk: 'Adjective' },
  // nice and cool
  { match: '#Adjective and #Adjective', chunk: 'Adjective' },
  // really nice
  // { match: '#Adverb+ #Adjective', chunk: 'Adjective' },

  // === Verb ===
  // quickly and suddenly run
  { match: '#Adverb+ and #Adverb #Verb', chunk: 'Verb' },
  // sitting near
  { match: '#Gerund #Adjective$', chunk: 'Verb' },
  // going to walk
  { match: '#Gerund to #Verb', chunk: 'Verb' },
  // come and have a drink
  { match: '#PresentTense and #PresentTense', chunk: 'Verb' },
  // really not
  { match: '#Adverb #Negative', chunk: 'Verb' },
  // want to see
  { match: '(want|wants|wanted) to #Infinitive', chunk: 'Verb' },
  // walk ourselves
  { match: '#Verb #Reflexive', chunk: 'Verb' },
  // tell him the story
  // { match: '#PresentTense [#Pronoun] #Determiner', group: 0, chunk: 'Verb' },
  // tries to walk
  { match: '#Verb [to] #Adverb? #Infinitive', group: 0, chunk: 'Verb' },
  // upon seeing
  { match: '[#Preposition] #Gerund', group: 0, chunk: 'Verb' },
  // ensure that
  { match: '#Infinitive [that] <Noun>', group: 0, chunk: 'Verb' },

  // === Noun ===
  // the brown fox
  // { match: '#Determiner #Adjective+ #Noun', chunk: 'Noun' },
  // the fox
  // { match: '(the|this) <Noun>', chunk: 'Noun' },
  // brown fox
  // { match: '#Adjective+ <Noun>', chunk: 'Noun' },
  // --- of ---
  // son of a gun
  { match: '#Noun of #Determiner? #Noun', chunk: 'Noun' },
  // 3 beautiful women
  { match: '#Value+ #Adverb? #Adjective', chunk: 'Noun' },
  // the last russian tsar
  { match: 'the [#Adjective] #Noun', chunk: 'Noun' },
  // breakfast in bed
  { match: '#Singular in #Determiner? #Singular', chunk: 'Noun' },
  // Some citizens in this Canadian capital
  { match: '#Plural [in] #Determiner? #Noun', group: 0, chunk: 'Pivot' },
  // indoor and outdoor seating
  { match: '#Noun and #Determiner? #Noun', notIf: '(#Possessive|#Pronoun)', chunk: 'Noun' },
  //  boys and girls
  // { match: '#Plural and #Determiner? #Plural', chunk: 'Noun' },
  // tomatoes and cheese
  // { match: '#Noun and #Determiner? #Noun', notIf: '#Pronoun', chunk: 'Noun' },
  // that is why
  // { match: '[that] (is|was)', group: 0, chunk: 'Noun' },
]

let net = null
const matcher = function (view, _, world) {
  const { methods } = world
  net = net || methods.one.buildNet(rules, world)
  view.sweep(net)
}
export default matcher
