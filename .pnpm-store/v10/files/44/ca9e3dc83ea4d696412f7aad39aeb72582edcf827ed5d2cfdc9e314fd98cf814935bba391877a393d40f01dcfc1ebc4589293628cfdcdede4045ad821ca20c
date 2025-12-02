import multiWord from './multi-word.js'
import singleWord from './single-word.js'

// tag any words in our lexicon - even if it hasn't been filled-up yet
// rest of pre-tagger is in ./two/preTagger
const lexicon = function (view) {
  const world = view.world
  // loop through our terms
  view.docs.forEach(terms => {
    for (let i = 0; i < terms.length; i += 1) {
      if (terms[i].tags.size === 0) {
        let found = null
        found = found || multiWord(terms, i, world)
        // lookup known words
        found = found || singleWord(terms, i, world)
      }
    }
  })
}

export default {
  lexicon,
}
