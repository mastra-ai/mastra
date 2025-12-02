import findMain from './mainClause.js'

const grammar = function (vb) {
  let tense = null
  if (vb.has('#PastTense')) {
    tense = 'PastTense'
  } else if (vb.has('#FutureTense')) {
    tense = 'FutureTense'
  } else if (vb.has('#PresentTense')) {
    tense = 'PresentTense'
  }
  return {
    tense
  }
}

const parse = function (s) {
  let clauses = s.clauses()
  let main = findMain(clauses)
  let chunks = main.chunks()
  let subj = s.none()
  let verb = s.none()
  let pred = s.none()
  chunks.forEach((ch, i) => {
    if (i === 0 && !ch.has('<Verb>')) {
      subj = ch
      return
    }
    if (!verb.found && ch.has('<Verb>')) {
      verb = ch
      return
    }
    if (verb.found) {
      pred = pred.concat(ch)
    }
  })
  // cleanup a missed parse
  if (verb.found && !subj.found) {
    subj = verb.before('<Noun>+').first()
  }
  return {
    subj,
    verb,
    pred,
    grammar: grammar(verb)
  }
}
export default parse