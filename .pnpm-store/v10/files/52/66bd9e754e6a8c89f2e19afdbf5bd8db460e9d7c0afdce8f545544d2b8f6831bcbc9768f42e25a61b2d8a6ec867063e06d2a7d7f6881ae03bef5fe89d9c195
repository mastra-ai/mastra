const shouldSkip = function (last) {
  // is it our only choice?
  if (last.length <= 1) {
    return false
  }
  let obj = last.parse()[0] || {}
  return obj.isSubordinate
}

// try to chop-out any obvious conditional phrases
// he wore, [if it was raining], a raincoat.
const noSubClause = function (before) {
  let parts = before.clauses()
  parts = parts.filter((m, i) => {
    // if it was raining..
    if (m.has('^(if|unless|while|but|for|per|at|by|that|which|who|from)')) {
      return false
    }
    // bowed to her,
    if (i > 0 && m.has('^#Verb . #Noun+$')) {
      return false
    }
    // the fog, suddenly increasing in..
    if (i > 0 && m.has('^#Adverb')) {
      return false
    }
    return true
  })
  // don't drop the whole thing.
  if (parts.length === 0) {
    return before
  }
  return parts
}

//
const lastNoun = function (vb) {
  let before = vb.before()
  // try to drop any mid-sentence clauses
  before = noSubClause(before)
  // parse-out our preceding nouns
  let nouns = before.nouns()
  // look for any dead-ringers
  let last = nouns.last()
  // i/she/he/they are very strong
  let pronoun = last.match('(i|he|she|we|you|they)')
  if (pronoun.found) {
    return pronoun.nouns()
  }
  // these are also good hints
  let det = nouns.if('^(that|this|those)')
  if (det.found) {
    return det
  }
  if (nouns.found === false) {
    det = before.match('^(that|this|those)')
    if (det.found) {
      return det
    }
  }

  // should we skip a subbordinate clause or two?
  last = nouns.last()
  if (shouldSkip(last)) {
    nouns.remove(last)
    last = nouns.last()
  }
  // i suppose we can skip two?
  if (shouldSkip(last)) {
    nouns.remove(last)
    last = nouns.last()
  }
  return last
}

const isPlural = function (subj, vb) {
  // 'we are' vs 'he is'
  if (vb.has('(are|were|does)')) {
    return true
  }
  if (subj.has('(those|they|we)')) {
    return true
  }
  if (subj.found && subj.isPlural) {
    return subj.isPlural().found
  }
  return false
}

const getSubject = function (vb) {
  let subj = lastNoun(vb)
  return {
    subject: subj,
    plural: isPlural(subj, vb),
  }
}
export default getSubject
