import fastTag from '../_fastTag.js'
import fillTag from './_fillTags.js'

const nounFallback = function (terms, i, model) {
  let isEmpty = false
  let tags = terms[i].tags
  if (tags.size === 0) {
    isEmpty = true
  } else if (tags.size === 1) {
    // weaker tags to ignore
    if (tags.has('Hyphenated') || tags.has('HashTag') || tags.has('Prefix') || tags.has('SlashedTerm')) {
      isEmpty = true
    }
  }
  if (isEmpty) {
    fastTag(terms[i], 'Noun', '3-[fallback]')
    // try to give it singluar/plural tags, too
    fillTag(terms, i, model)
    terms[i].confidence = 0.1
  }
}
export default nounFallback
