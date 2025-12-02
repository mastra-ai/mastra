const anything = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Value', 'QuestionWord']

export default {
  Adjective: {
    not: ['Noun', 'Verb', 'Adverb', 'Value'],
  },
  Comparable: {
    is: 'Adjective',
  },
  Comparative: {
    is: 'Adjective',
  },
  Superlative: {
    is: 'Adjective',
    not: ['Comparative'],
  },
  NumberRange: {},
  Adverb: {
    not: ['Noun', 'Verb', 'Adjective', 'Value'],
  },

  Determiner: {
    not: ['Noun', 'Verb', 'Adjective', 'Adverb', 'QuestionWord', 'Conjunction'], //allow 'a' to be a Determiner/Value
  },
  Conjunction: {
    not: anything,
  },
  Preposition: {
    not: ['Noun', 'Verb', 'Adjective', 'Adverb', 'QuestionWord', 'Determiner'],
  },
  QuestionWord: {
    not: ['Determiner'],
  },
  Currency: {
    is: 'Noun',
  },
  Expression: {
    not: ['Noun', 'Adjective', 'Verb', 'Adverb'],
  },
  Abbreviation: {},
  Url: {
    not: ['HashTag', 'PhoneNumber', 'Verb', 'Adjective', 'Value', 'AtMention', 'Email', 'SlashedTerm'],
  },
  PhoneNumber: {
    not: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention', 'Email'],
  },
  HashTag: {},
  AtMention: {
    is: 'Noun',
    not: ['HashTag', 'Email'],
  },
  Emoji: {
    not: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention'],
  },
  Emoticon: {
    not: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention', 'SlashedTerm'],
  },
  SlashedTerm: {
    not: ['Emoticon', 'Url', 'Value']
  },
  Email: {
    not: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention'],
  },
  Acronym: {
    not: ['Plural', 'RomanNumeral', 'Pronoun', 'Date'],
  },
  Negative: {
    not: ['Noun', 'Adjective', 'Value', 'Expression'],
  },
  Condition: {
    not: ['Verb', 'Adjective', 'Noun', 'Value'],
  },
  // existential 'there'
  There: {
    not: ['Verb', 'Adjective', 'Noun', 'Value', 'Conjunction', 'Preposition'],
  },
  // 'co-wrote'
  Prefix: {
    not: ['Abbreviation', 'Acronym', 'ProperNoun'],
  },
  // hard-nosed, bone-headed
  Hyphenated: {},
}
