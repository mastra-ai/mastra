import irregularPlurals from './irregulars/plurals.js'
import { lexicon, switches, frozenLex } from './lexicon/index.js'
import clues from './clues/index.js'
import suffixPatterns from './patterns/suffixes.js'
import prefixPatterns from './patterns/prefixes.js'
import endsWith from './patterns/endsWith.js'
import neighbours from './patterns/neighbours.js'
import models from './models/index.js'
import regexNormal from './regex/regex-normal.js'
import regexText from './regex/regex-text.js'
import regexNumbers from './regex/regex-numbers.js'
import orgWords from './orgWords.js'
import placeWords from './placeWords.js'
import expandLexicon from './_expand/index.js'

let model = {
  one: {
    _multiCache: {},
    lexicon,
    frozenLex,
  },
  two: {
    irregularPlurals,
    models,

    suffixPatterns,
    prefixPatterns,
    endsWith,
    neighbours,

    regexNormal,
    regexText,
    regexNumbers,

    switches,
    clues,

    uncountable: {},

    orgWords,
    placeWords,
  },
}
model = expandLexicon(model)
export default model

// console.log(model.one.lexicon.see)
