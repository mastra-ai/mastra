import noun from './_noun.js'
import verb from './_verb.js'
const nn = 'Singular'
const vb = 'Infinitive'
// 'boot the ball'   -  'the red boot'
// 'boots the ball'  -   'the red boots'
const clue = {
  beforeTags: Object.assign({}, verb.beforeTags, noun.beforeTags, {
    // Noun: undefined
    Adjective: nn,//great name
    Particle: nn//brought under control
  }),
  afterTags: Object.assign({}, verb.afterTags, noun.afterTags, {
    ProperNoun: vb, Gerund: vb, Adjective: vb,
    Copula: nn,
  }),
  beforeWords: Object.assign({}, verb.beforeWords, noun.beforeWords, {
    // is time
    is: nn, was: nn,
    //balance of power
    of: nn,
    have: null //have cash
  }),
  afterWords: Object.assign({}, verb.afterWords, noun.afterWords, {
    // for: vb,//work for
    instead: vb,
    // that: nn,//subject that was
    // for: vb,//work for
    about: vb,//talk about
    his: vb,//shot his
    her: vb,//
    to: null,
    by: null,
    in: null
  }),
}

export default clue