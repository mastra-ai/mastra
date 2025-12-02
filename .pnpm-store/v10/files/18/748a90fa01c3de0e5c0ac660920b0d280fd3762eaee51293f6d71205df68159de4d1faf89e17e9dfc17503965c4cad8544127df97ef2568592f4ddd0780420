import simpleSplit from './01-simple-split.js'
import simpleMerge from './02-simple-merge.js'
import smartMerge from './03-smart-merge.js'
import quoteMerge from './04-quote-merge.js'
import parensMerge from './05-parens-merge.js'
//(Rule-based sentence boundary segmentation) - chop given text into its proper sentences.
// Ignore periods/questions/exclamations used in acronyms/abbreviations/numbers, etc.
//regs-
const hasSomething = /\S/
const startWhitespace = /^\s+/

const splitSentences = function (text, world) {
  text = text || ''
  text = String(text)
  // Ensure it 'smells like' a sentence
  if (!text || typeof text !== 'string' || hasSomething.test(text) === false) {
    return []
  }
  // cleanup unicode-spaces
  text = text.replace('\xa0', ' ')
  // First do a greedy-split..
  let splits = simpleSplit(text)
  // Filter-out the crap ones
  let sentences = simpleMerge(splits)
  //detection of non-sentence chunks:
  sentences = smartMerge(sentences, world)
  // allow 'he said "no sir." and left.'
  sentences = quoteMerge(sentences)
  // allow 'i thought (no way!) and left.'
  sentences = parensMerge(sentences)
  //if we never got a sentence, return the given text
  if (sentences.length === 0) {
    return [text]
  }
  //move whitespace to the ends of sentences, when possible
  //['hello',' world'] -> ['hello ','world']
  for (let i = 1; i < sentences.length; i += 1) {
    let ws = sentences[i].match(startWhitespace)
    if (ws !== null) {
      sentences[i - 1] += ws[0]
      sentences[i] = sentences[i].replace(startWhitespace, '')
    }
  }
  return sentences
}
export default splitSentences
