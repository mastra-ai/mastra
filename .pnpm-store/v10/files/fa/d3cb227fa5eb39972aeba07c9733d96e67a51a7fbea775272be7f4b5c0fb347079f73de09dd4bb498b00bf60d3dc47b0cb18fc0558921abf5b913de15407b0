// rough connection between compromise tagset and Penn Treebank
// https://www.ling.upenn.edu/courses/Fall_2003/ling001/penn_treebank_pos.html

const mapping = {
  // adverbs
  // 'Comparative': 'RBR',
  // 'Superlative': 'RBS',
  Adverb: 'RB',

  // adjectives
  Comparative: 'JJR',
  Superlative: 'JJS',
  Adjective: 'JJ',
  TO: 'Conjunction',

  // verbs
  Modal: 'MD',
  Auxiliary: 'MD',
  Gerund: 'VBG', //throwing
  PastTense: 'VBD', //threw
  Participle: 'VBN', //thrown
  PresentTense: 'VBZ', //throws
  Infinitive: 'VB', //throw
  Particle: 'RP', //phrasal particle
  Verb: 'VB', // throw

  // pronouns
  Pronoun: 'PRP',

  // misc
  Cardinal: 'CD',
  Conjunction: 'CC',
  Determiner: 'DT',
  Preposition: 'IN',
  // 'Determiner': 'WDT',
  // 'Expression': 'FW',
  QuestionWord: 'WP',
  Expression: 'UH',

  //nouns
  Possessive: 'POS',
  ProperNoun: 'NNP',
  Person: 'NNP',
  Place: 'NNP',
  Organization: 'NNP',
  Singular: 'NN',
  Plural: 'NNS',
  Noun: 'NN',

  There: 'EX', //'there'
  // 'Adverb':'WRB',
  // 'Noun':'PDT', //predeterminer
  // 'Noun':'SYM', //symbol
  // 'Noun':'NFP', //

  //  WDT 	Wh-determiner
  // 	WP 	Wh-pronoun
  // 	WP$ 	Possessive wh-pronoun
  // 	WRB 	Wh-adverb
}

const toPenn = function (term) {
  // try some ad-hoc ones
  if (term.tags.has('ProperNoun') && term.tags.has('Plural')) {
    return 'NNPS'
  }
  if (term.tags.has('Possessive') && term.tags.has('Pronoun')) {
    return 'PRP$'
  }
  if (term.normal === 'there') {
    return 'EX'
  }
  if (term.normal === 'to') {
    return 'TO'
  }
  // run through an ordered list of tags
  let arr = term.tagRank || []
  for (let i = 0; i < arr.length; i += 1) {
    if (mapping.hasOwnProperty(arr[i])) {
      return mapping[arr[i]]
    }
  }
  return null
}

const pennTag = function (view) {
  view.compute('tagRank')
  view.docs.forEach(terms => {
    terms.forEach(term => {
      term.penn = toPenn(term)
    })
  })
}
export default pennTag
