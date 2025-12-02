// order matters
let matches = [
  // u r cool
  { match: 'u r', tag: '#Pronoun #Copula', reason: 'u r' },
  { match: '#Noun [(who|whom)]', group: 0, tag: 'Determiner', reason: 'captain-who' },

  // ==== Conditions ====
  // had he survived,
  { match: '[had] #Noun+ #PastTense', group: 0, tag: 'Condition', reason: 'had-he' },
  // were he to survive
  { match: '[were] #Noun+ to #Infinitive', group: 0, tag: 'Condition', reason: 'were-he' },

  // some sort of
  { match: 'some sort of', tag: 'Adjective Noun Conjunction', reason: 'some-sort-of' },
  // some of
  // { match: 'some of', tag: 'Noun Conjunction', reason: 'some-of' },
  // of some sort
  { match: 'of some sort', tag: 'Conjunction Adjective Noun', reason: 'of-some-sort' },
  // such skill
  { match: '[such] (a|an|is)? #Noun', group: 0, tag: 'Determiner', reason: 'such-skill' },
  // another one
  // { match: '[another] (#Noun|#Value)', group: 0, tag: 'Adjective', reason: 'another-one' },
  // right after
  { match: '[right] (before|after|in|into|to|toward)', group: 0, tag: '#Adverb', reason: 'right-into' },
  // at about
  { match: '#Preposition [about]', group: 0, tag: 'Adjective', reason: 'at-about' },
  // are ya
  { match: '(are|#Modal|see|do|for) [ya]', group: 0, tag: 'Pronoun', reason: 'are-ya' },
  // long live
  { match: '[long live] .', group: 0, tag: '#Adjective #Infinitive', reason: 'long-live' },
  // plenty of
  { match: '[plenty] of', group: 0, tag: '#Uncountable', reason: 'plenty-of' },
  // 'there' as adjective
  { match: '(always|nearly|barely|practically) [there]', group: 0, tag: 'Adjective', reason: 'always-there' },
  // existential 'there'
  // there she is
  { match: '[there] (#Adverb|#Pronoun)? #Copula', group: 0, tag: 'There', reason: 'there-is' },
  // is there food
  { match: '#Copula [there] .', group: 0, tag: 'There', reason: 'is-there' },
  // should there
  { match: '#Modal #Adverb? [there]', group: 0, tag: 'There', reason: 'should-there' },
  // do you
  { match: '^[do] (you|we|they)', group: 0, tag: 'QuestionWord', reason: 'do-you' },
  // does he
  { match: '^[does] (he|she|it|#ProperNoun)', group: 0, tag: 'QuestionWord', reason: 'does-he' },
  // the person who
  { match: '#Determiner #Noun+ [who] #Verb', group: 0, tag: 'Preposition', reason: 'the-x-who' },
  // the person which
  { match: '#Determiner #Noun+ [which] #Verb', group: 0, tag: 'Preposition', reason: 'the-x-which' },
  // a while
  { match: 'a [while]', group: 0, tag: 'Noun', reason: 'a-while' },
  // guess who
  { match: 'guess who', tag: '#Infinitive #QuestionWord', reason: 'guess-who' },
  // swear words
  { match: '[fucking] !#Verb', group: 0, tag: '#Gerund', reason: 'f-as-gerund' },
]
export default matches
