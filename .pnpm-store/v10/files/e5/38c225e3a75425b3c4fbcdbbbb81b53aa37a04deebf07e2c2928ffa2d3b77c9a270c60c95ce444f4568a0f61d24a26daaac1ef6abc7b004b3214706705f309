import fastTag from '../_fastTag.js'

//sweep-through all suffixes
const suffixLoop = function (str = '', suffixes = []) {
  const len = str.length
  let max = 7
  if (len <= max) {
    max = len - 1
  }
  for (let i = max; i > 1; i -= 1) {
    let suffix = str.substring(len - i, len)
    if (suffixes[suffix.length].hasOwnProperty(suffix) === true) {
      // console.log(suffix)
      let tag = suffixes[suffix.length][suffix]
      return tag
    }
  }
  return null
}

// decide tag from the ending of the word
const tagBySuffix = function (terms, i, model) {
  let term = terms[i]
  if (term.tags.size === 0) {
    let tag = suffixLoop(term.normal, model.two.suffixPatterns)
    if (tag !== null) {
      fastTag(term, tag, '2-suffix')
      term.confidence = 0.7
      return true
    }
    // try implicit form of word, too
    if (term.implicit) {
      tag = suffixLoop(term.implicit, model.two.suffixPatterns)
      if (tag !== null) {
        fastTag(term, tag, '2-implicit-suffix')
        term.confidence = 0.7
        return true
      }
    }
    // Infinitive suffix + 's' can be PresentTense
    // if (term.normal[term.normal.length - 1] === 's') {
    //   let str = term.normal.replace(/s$/, '')
    //   if (suffixLoop(str, model.two.suffixPatterns) === 'Infinitive') {
    //     console.log(str)
    //     fastTag(term, 'PresentTense', '2-implied-present')
    //     term.confidence = 0.5
    //     return true
    //   }
    // }
  }
  return null
}
export default tagBySuffix
