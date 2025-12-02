import fastTag from '../_fastTag.js'
import fillTag from './_fillTags.js'

const lookAtWord = function (term, words) {
  if (!term) {
    return null
  }
  // look at prev word <-
  let found = words.find(a => term.normal === a[0])
  if (found) {
    return found[1]
  }
  return null
}

const lookAtTag = function (term, tags) {
  if (!term) {
    return null
  }
  let found = tags.find(a => term.tags.has(a[0]))
  if (found) {
    return found[1]
  }
  return null
}

// look at neighbours for hints on unknown words
const neighbours = function (terms, i, model) {
  const { leftTags, leftWords, rightWords, rightTags } = model.two.neighbours
  let term = terms[i]
  if (term.tags.size === 0) {
    let tag = null
    // look left <-
    tag = tag || lookAtWord(terms[i - 1], leftWords)
    // look right ->
    tag = tag || lookAtWord(terms[i + 1], rightWords)
    // look left <-
    tag = tag || lookAtTag(terms[i - 1], leftTags)
    // look right ->
    tag = tag || lookAtTag(terms[i + 1], rightTags)
    if (tag) {
      fastTag(term, tag, '3-[neighbour]')
      fillTag(terms, i, model)
      terms[i].confidence = 0.2
      return true
    }
  }
  return null
}
export default neighbours
