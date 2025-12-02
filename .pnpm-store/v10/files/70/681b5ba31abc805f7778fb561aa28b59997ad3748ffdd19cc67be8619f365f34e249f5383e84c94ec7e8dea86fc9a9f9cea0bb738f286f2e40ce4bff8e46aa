import type View from './two.d.ts'

interface Three extends View {
  // Selections
  /** split-up results into multi-term phrases */
  clauses: (n?: number) => View
  /** split-up noun-phrase and verb-phrases */
  chunks: () => View

  /** clean-up the document, in various ways */
  normalize: (options?: string | object) => View

  /** remove any people, places, and organizations */
  redact: (opts?: object) => View

  /** return all terms connected with a hyphen or dash like `'wash-out'`*/
  hyphenated: (n?: number) => View
  /** return terms like `'#nlp'` */
  hashTags: (n?: number) => View
  /** return terms like `'hi@compromise.cool'` */
  emails: (n?: number) => View
  /** return terms like `💋` */
  emoji: (n?: number) => View
  /** return  terms like `:)` */
  emoticons: (n?: number) => View
  /** return terms like `'@nlp_compromise'`*/
  atMentions: (n?: number) => View
  /** return terms like `'compromise.cool'` */
  urls: (n?: number) => View
  /** return terms like `'he'` */
  pronouns: (n?: number) => View
  /** return terms like `'but'`*/
  conjunctions: (n?: number) => View
  /** return terms like `'of'`*/
  prepositions: (n?: number) => View
  /** return terms like `'Dr.'`*/
  honorifics: (n?: number) => View
  /** return terms like `'st.'`*/
  abbreviations: (n?: number) => View
  /** return terms like `'(939) 555-0113'` */
  phoneNumbers: (n?: number) => View

  // Subsets
  /** return terms like `'FBI'` */
  acronyms: (n?: number) => Acronyms
  /** return anything inside (parentheses) */
  parentheses: (n?: number) => Parentheses
  /** return terms like "Spencer's" */
  possessives: (n?: number) => Possessives
  /** return any terms inside 'quotation marks' */
  quotations: (n?: number) => Quotations
  /** return any slashed terms like 'love/hate' */
  slashes: (n?: number) => Slashes
  /** return words like "clean" */
  adjectives: (n?: number) => Adjectives
  /** return words like "quickly" */
  adverbs: (n?: number) => Adverbs

  /** return noun phrases in the view */
  nouns: (n?: number, opts?: object) => Nouns
  /** return any numbers in the view */
  numbers: (n?: number, opts?: object) => Numbers
  /** return any percentages in the view */
  percentages: (n?: number, opts?: object) => Numbers
  /** return any money in the view */
  money: (n?: number, opts?: object) => Numbers
  /** return any fractions in the view */
  fractions: (n?: number, opts?: object) => Fractions


  /** return full sentences in the view */
  sentences: (n?: number, opts?: object) => Sentences
  /** find full sentences of any questions in the view */
  questions: (n?: number, opts?: object) => View
  /** return any subsequent terms tagged as a Verb */
  verbs: (n?: number) => Verbs
  /** return person names like `'John A. Smith'`*/
  people: (n?: number) => People
  /** return location names like `'Paris, France'`*/
  places: (n?: number) => View
  /** return companies and org names like `'Google Inc.'`*/
  organizations: (n?: number) => View
  /** return people, places, and organizations */
  topics: (n?: number) => View
}

// Nouns class
export interface Nouns extends View {
  /** grab the parsed noun-phrase */
  parse: (n?: number) => object[]
  /** return only plural nouns */
  isPlural: () => View
  /** get any adjectives describing this noun*/
  adjectives: () => View
  /** 'football captain' → 'football captains' */
  toPlural: (setArticle?: boolean) => View
  /** 'turnovers' → 'turnover' */
  toSingular: (setArticle?: boolean) => View
}

export interface Numbers extends View {
  /** grab the parsed number */
  parse: (n?: number) => object[]
  /** grab the parsed number */
  get: (n?: number) => number | number[]
  /** grab 'kilos' from `25 kilos' */
  // units: () => View
  /** return only ordinal numbers */
  isOrdinal: () => View
  /** return only cardinal numbers */
  isCardinal: () => View
  /** return only numbers with the given unit(s), like 'km' */
  isUnit: (units: string | string[] | object) => View
  /** convert number to `5` or `5th` */
  toNumber: () => View
  /** add commas, or nicer formatting for numbers */
  toLocaleString: () => View
  /** convert number to `five` or `fifth` */
  toText: () => View
  /** convert number to `five` or `5` */
  toCardinal: () => View
  /** convert number to `fifth` or `5th` */
  toOrdinal: () => View
  /** return numbers with this value */
  isEqual: () => View
  /** return numbers bigger than n */
  greaterThan: (min: number) => View
  /** return numbers smaller than n */
  lessThan: (max: number) => View
  /** return numbers between min and max */
  between: (min: number, max: number) => View
  /** set number to n */
  set: (n: number) => View
  /** increase number by n */
  add: (n: number) => View
  /** decrease number by n*/
  subtract: (n: number) => View
  /** increase number by 1 */
  increment: () => View
  /** decrease number by 1*/
  decrement: () => View
}

export interface Fractions extends View {
  /** grab the parsed number */
  parse: (n?: number) => object[]
  /** grab the parsed number */
  get: (n?: number) => number | number[]
  /** convert '1/4' to `0.25` */
  toDecimal: () => View
  /** convert 'one fourth' to `1/4` */
  toFraction: () => View
  /** convert '1/4' to '1/4th' */
  toOrdinal: () => View
  /** convert '1/4th' to '1/4' */
  toCardinal: () => View
  /** convert '1/4' to `25%` */
  toPercentage: () => View
}

// Sentences class
export interface Sentences extends View {
  /** grab the parsed sentence */
  parse: (n?: number) => object[]
  /** 'will go' → 'went' */
  toPastTense: () => View
  /** 'walked' → 'walks' */
  toPresentTense: () => View
  /** 'walked' → 'will walk' */
  toFutureTense: () => View
  /** 'walks' → 'walk' */
  toInfinitive: () => View
  /** 'walks' → 'walking' */
  // toGerund: () => View
  /** 'he is cool' → 'he is not cool' */
  toNegative: () => View
  /** 'he isn't cool' -> 'he is cool' */
  toPositive: () => View
  /** keep only questions */
  isQuestion: () => View
  /** keep only sentences with an exclamation-mark*/
  isExclamation: () => View
  /** remove questions, and exclamations */
  isStatement: () => View
}

export interface People extends View {
  /** get first/last/middle names */
  parse: () => object[]
}

// Verbs class
export interface Verbs extends View {
  /** grab the parsed verb-phrase */
  parse: (n?: number) => object[]
  /** grab what [doing] the verb */
  subjects: () => View
  /** return the adverbs describing this verb */
  adverbs: () => View
  /** return only singular nouns */
  isSingular: () => View
  /** return only plural nouns */
  isPlural: () => View
  /** only verbs that are instructions*/
  isImperative: () => View

  /** 'walks' → 'walk' */
  toInfinitive: () => View
  /** 'walked' → 'walks' */
  toPresentTense: () => View
  /** 'will go' → 'went' */
  toPastTense: () => View
  /** 'walked' → 'will walk' */
  toFutureTense: () => View
  /** 'walks' → 'walking' */
  toGerund: () => View

  /** return all forms of these verbs */
  conjugate: () => object[]
  /** return verbs with 'not' */
  isNegative: () => View
  /** only verbs without 'not'*/
  isPositive: () => View
  /** "didn't study" → 'studied' */
  toPositive: () => View
  /** 'went' → 'did not go'*/
  toNegative: () => View
}

export interface Acronyms extends View {
  /** 'F.B.I.' -> 'FBI' */
  strip: () => View
  /** 'FBI' -> 'F.B.I.' */
  addPeriods: () => View
}
export interface Parentheses extends View {
  /** remove ( and ) punctuation */
  strip: () => View
}
export interface Possessives extends View {
  /** "spencer's" -> "spencer" */
  strip: () => View
}
export interface Quotations extends View {
  /** remove leading and trailing quotation marks */
  strip: () => View
}
export interface Slashes extends View {
  /** turn 'love/hate' into 'love hate' */
  split: () => View
}

export interface Adjectives extends View {
  /** get the words describing this adjective */
  adverbs: () => View
  /**  return all forms of these */
  conjugate: () => object[]
  /** 'quick' -> 'quicker' */
  toComparative: (n?: number) => View
  /** 'quick' -> 'quickest' */
  toSuperlative: (n?: number) => View
  /** 'quick' -> 'quickly' */
  toAdverb: (n?: number) => View
  /** 'quick' -> 'quickness' */
  toNoun: (n?: number) => View
}

// only overloads .json()
export interface Adverbs extends View { }

export default Three
