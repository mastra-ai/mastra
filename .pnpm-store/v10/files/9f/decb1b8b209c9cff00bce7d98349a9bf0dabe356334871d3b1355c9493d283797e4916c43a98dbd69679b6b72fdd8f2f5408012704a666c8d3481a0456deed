import adj from './_adj.js'
import noun from './_noun.js'
// the commercial market
// watching the commercial

const misc = {
  beforeTags: {
    Determiner: undefined, //the premier university
    Cardinal: 'Noun',//1950 convertable
    PhrasalVerb: 'Adjective'//starts out fine
  },
  afterTags: {
    // Pronoun: 'Noun'//as an adult i
  }
}
const clue = {
  beforeTags: Object.assign({}, adj.beforeTags, noun.beforeTags, misc.beforeTags),
  afterTags: Object.assign({}, adj.afterTags, noun.afterTags, misc.afterTags),
  beforeWords: Object.assign({}, adj.beforeWords, noun.beforeWords, {
    // are representative
    are: 'Adjective', is: 'Adjective', was: 'Adjective', be: 'Adjective',
    // phrasals
    off: 'Adjective',//start off fine
    out: 'Adjective',//comes out fine
  }),
  afterWords: Object.assign({}, adj.afterWords, noun.afterWords),
}
export default clue