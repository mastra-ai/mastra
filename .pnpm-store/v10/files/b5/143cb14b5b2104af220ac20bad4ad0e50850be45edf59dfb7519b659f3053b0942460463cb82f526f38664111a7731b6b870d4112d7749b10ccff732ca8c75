import lexData from './_data.js'
import { unpack } from 'efrt'
import misc from './misc.js'
import frozenLex from './frozenLex.js'
import emoticons from './emoticons.js'
import toPlural from '../../methods/transform/nouns/toPlural/index.js'
import irregularPlurals from '../irregulars/plurals.js'
// unpack our lexicon of words
// (found in ./lexicon/)

// more clever things are done on the data later
//  - once the plugin is applied
const hasSwitch = /\|/
let lexicon = misc
let switches = {}

const tmpModel = { two: { irregularPlurals, uncountable: {} } }

Object.keys(lexData).forEach(tag => {
  let wordsObj = unpack(lexData[tag])
  // POS tag, or something fancier?
  if (!hasSwitch.test(tag)) {
    // set them as simple word key-value lookup
    Object.keys(wordsObj).forEach(w => {
      lexicon[w] = tag
    })
    return
  }
  // add them as seperate key-val object
  Object.keys(wordsObj).forEach(w => {
    switches[w] = tag
    // pluralize Noun|Verb switches
    if (tag === 'Noun|Verb') {
      let plural = toPlural(w, tmpModel)
      switches[plural] = 'Plural|Verb'
    }
  })
})
// add ':)'
emoticons.forEach(str => (lexicon[str] = 'Emoticon'))

// misc cleanup
delete lexicon['']
delete lexicon[null]
delete lexicon[' ']

export { lexicon, switches, frozenLex }
