// simply chunk Nouns as <Noun>
const byNeighbour = function (document) {
  for (let n = 0; n < document.length; n += 1) {
    for (let t = 0; t < document[n].length; t += 1) {
      let term = document[n][t]
      if (term.chunk) {
        continue
      }
      // based on next-term
      let onRight = document[n][t + 1]
      // based on last-term
      let onLeft = document[n][t - 1]

      //'is cool' vs 'the cool dog'
      if (term.tags.has('Adjective')) {
        // 'is cool'
        if (onLeft && onLeft.tags.has('Copula')) {
          term.chunk = 'Adjective'
          continue
        }
        // 'the cool'
        if (onLeft && onLeft.tags.has('Determiner')) {
          term.chunk = 'Noun'
          continue
        }
        // 'cool dog'
        if (onRight && onRight.tags.has('Noun')) {
          term.chunk = 'Noun'
          continue
        }
        continue
      }
      // 'really swimming' vs 'really cool'
      if (term.tags.has('Adverb') || term.tags.has('Negative')) {
        if (onLeft && onLeft.tags.has('Adjective')) {
          term.chunk = 'Adjective'
          continue
        }
        if (onLeft && onLeft.tags.has('Verb')) {
          term.chunk = 'Verb'
          continue
        }

        if (onRight && onRight.tags.has('Adjective')) {
          term.chunk = 'Adjective'
          continue
        }
        if (onRight && onRight.tags.has('Verb')) {
          term.chunk = 'Verb'
          continue
        }
      }
    }
  }
}
export default byNeighbour
