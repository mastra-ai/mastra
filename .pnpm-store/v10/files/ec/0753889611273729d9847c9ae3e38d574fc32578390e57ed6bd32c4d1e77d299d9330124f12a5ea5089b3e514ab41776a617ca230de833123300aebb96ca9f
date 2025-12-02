import noun from './_noun.js'
import gerund from './_gerund.js'

// 'operating the crane', or 'operating room'
const misc = {
  beforeTags: {
    Copula: 'Gerund',
    PastTense: 'Gerund',
    PresentTense: 'Gerund',
    Infinitive: 'Gerund',
  },
  afterTags: {
    Value: 'Gerund', //maintaining 500
  },
  beforeWords: {
    are: 'Gerund',
    were: 'Gerund',
    be: 'Gerund',
    no: 'Gerund',
    without: 'Gerund',
    //are you playing
    you: 'Gerund',
    we: 'Gerund',
    they: 'Gerund',
    he: 'Gerund',
    she: 'Gerund',
    //stop us playing
    us: 'Gerund',
    them: 'Gerund',
  },
  afterWords: {
    // offering the
    the: 'Gerund',
    this: 'Gerund',
    that: 'Gerund',
    //got me thinking
    me: 'Gerund',
    us: 'Gerund',
    them: 'Gerund',
  },
}
const clue = {
  beforeTags: Object.assign({}, gerund.beforeTags, noun.beforeTags, misc.beforeTags),
  afterTags: Object.assign({}, gerund.afterTags, noun.afterTags, misc.afterTags),
  beforeWords: Object.assign({}, gerund.beforeWords, noun.beforeWords, misc.beforeWords),
  afterWords: Object.assign({}, gerund.afterWords, noun.afterWords, misc.afterWords),
}
export default clue
