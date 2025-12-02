import normalize from '../compute/normal/index.js'

// turn a string input into a 'document' json format
const parse = function (input, world) {
  const { methods, model } = world
  const { splitSentences, splitTerms, splitWhitespace } = methods.one.tokenize
  input = input || ''
  // split into sentences
  let sentences = splitSentences(input, world)
  // split into word objects
  input = sentences.map((txt) => {
    let terms = splitTerms(txt, model)
    // split into [pre-text-post]
    terms = terms.map(t => splitWhitespace(t, model))
    // add normalized term format, always
    terms.forEach((t) => {
      normalize(t, world)
    })
    return terms
  })
  return input
}
export default parse