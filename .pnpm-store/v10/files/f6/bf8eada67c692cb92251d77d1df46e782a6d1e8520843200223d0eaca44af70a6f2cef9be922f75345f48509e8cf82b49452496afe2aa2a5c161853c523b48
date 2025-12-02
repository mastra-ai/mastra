import misc from './abbreviations/misc.js'
import honorifics from './abbreviations/honorifics.js'
import months from './abbreviations/months.js'
import nouns from './abbreviations/nouns.js'
import organizations from './abbreviations/organizations.js'
import places from './abbreviations/places.js'
import units from './abbreviations/units.js'

// add our abbreviation list to our lexicon
let list = [
  [misc],
  [units, 'Unit'],
  [nouns, 'Noun'],
  [honorifics, 'Honorific'],
  [months, 'Month'],
  [organizations, 'Organization'],
  [places, 'Place'],
]
// create key-val for sentence-tokenizer
let abbreviations = {}
// add them to a future lexicon
let lexicon = {}

list.forEach(a => {
  a[0].forEach(w => {
    // sentence abbrevs
    abbreviations[w] = true
    // future-lexicon
    lexicon[w] = 'Abbreviation'
    if (a[1] !== undefined) {
      lexicon[w] = [lexicon[w], a[1]]
    }
  })
})

export { lexicon, abbreviations }
