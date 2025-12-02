const byWord = {
  this: 'Noun',
  then: 'Pivot'
}

// simply chunk Nouns as <Noun>
const easyMode = function (document) {
  for (let n = 0; n < document.length; n += 1) {
    for (let t = 0; t < document[n].length; t += 1) {
      let term = document[n][t]

      if (byWord.hasOwnProperty(term.normal) === true) {
        term.chunk = byWord[term.normal]
        continue
      }
      if (term.tags.has('Verb')) {
        term.chunk = 'Verb'
        continue
      }
      if (term.tags.has('Noun') || term.tags.has('Determiner')) {
        term.chunk = 'Noun'
        continue
      }
      // 100 cats
      if (term.tags.has('Value')) {
        term.chunk = 'Noun'
        continue
      }
      //
      if (term.tags.has('QuestionWord')) {
        term.chunk = 'Pivot'
        continue
      }

    }
  }
}
export default easyMode
