import verbs from './verb.js'
import adjectives from './adjective.js'
import nouns from './noun.js'

const byWord = {}
const setup = function (senses, tag) {
  Object.keys(senses).forEach(ambig => {
    const words = {}
    let fallback = null
    Object.keys(senses[ambig]).forEach(name => {
      if (senses[ambig][name].words) {
        senses[ambig][name].words.forEach(w => {
          words[w] = name
        })
      }
      if (senses[ambig][name].fallback) {
        fallback = name
      }
    })
    byWord[ambig] = byWord[ambig] || []
    byWord[ambig].push({
      tag: tag,
      fallback,
      words,
    })
  })
}

setup(verbs, 'Verb')
setup(nouns, 'Noun')
setup(adjectives, 'Adjective')

export default byWord
