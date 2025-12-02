export default [
  // ==== Conjunctions ====
  { match: '[so] #Noun', group: 0, tag: 'Conjunction', reason: 'so-conj' },
  //how he is driving
  {
    match: '[(who|what|where|why|how|when)] #Noun #Copula #Adverb? (#Verb|#Adjective)',
    group: 0,
    tag: 'Conjunction',
    reason: 'how-he-is-x',
  },
  // when he
  { match: '#Copula [(who|what|where|why|how|when)] #Noun', group: 0, tag: 'Conjunction', reason: 'when-he' },
  // says that he..
  { match: '#Verb [that] #Pronoun', group: 0, tag: 'Conjunction', reason: 'said-that-he' },
  // things that are required
  { match: '#Noun [that] #Copula', group: 0, tag: 'Conjunction', reason: 'that-are' },
  // things that seem cool
  { match: '#Noun [that] #Verb #Adjective', group: 0, tag: 'Conjunction', reason: 'that-seem' },
  // wasn't that wide..
  { match: '#Noun #Copula not? [that] #Adjective', group: 0, tag: 'Adverb', reason: 'that-adj' },

  // ==== Prepositions ====
  //all students
  { match: '#Verb #Adverb? #Noun [(that|which)]', group: 0, tag: 'Preposition', reason: 'that-prep' },
  //work, which has been done.
  { match: '@hasComma [which] (#Pronoun|#Verb)', group: 0, tag: 'Preposition', reason: 'which-copula' },
  //folks like her
  { match: '#Noun [like] #Noun', group: 0, tag: 'Preposition', reason: 'noun-like' },
  //like the time
  { match: '^[like] #Determiner', group: 0, tag: 'Preposition', reason: 'like-the' },
  //a day like this
  { match: 'a #Noun [like] (#Noun|#Determiner)', group: 0, tag: 'Preposition', reason: 'a-noun-like' },
  // really like
  { match: '#Adverb [like]', group: 0, tag: 'Verb', reason: 'really-like' },
  // nothing like
  { match: '(not|nothing|never) [like]', group: 0, tag: 'Preposition', reason: 'nothing-like' },
  // treat them like
  { match: '#Infinitive #Pronoun [like]', group: 0, tag: 'Preposition', reason: 'treat-them-like' },




  // ==== Questions ====
  // where
  // why
  // when
  // who
  // whom
  // whose
  // what
  // which
  //the word 'how many'
  // { match: '^(how|which)', tag: 'QuestionWord', reason: 'how-question' },
  // how-he, when the
  { match: '[#QuestionWord] (#Pronoun|#Determiner)', group: 0, tag: 'Preposition', reason: 'how-he' },
  // when stolen
  { match: '[#QuestionWord] #Participle', group: 0, tag: 'Preposition', reason: 'when-stolen' },
  // how is
  { match: '[how] (#Determiner|#Copula|#Modal|#PastTense)', group: 0, tag: 'QuestionWord', reason: 'how-is' },
  // children who dance
  { match: '#Plural [(who|which|when)] .', group: 0, tag: 'Preposition', reason: 'people-who' },
]
