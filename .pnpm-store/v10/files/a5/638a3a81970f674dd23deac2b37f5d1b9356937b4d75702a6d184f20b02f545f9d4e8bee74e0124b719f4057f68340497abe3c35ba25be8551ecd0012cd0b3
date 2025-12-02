import fastTag from '../_fastTag.js'
import looksPlural from '../../../methods/looksPlural.js'
import getTense from '../../../methods/transform/verbs/getTense/index.js'
// tags that are neither plural or singular
const uncountable = [
  'Acronym',
  'Abbreviation',
  'ProperNoun',
  'Uncountable',
  'Possessive',
  'Pronoun',
  'Activity',
  'Honorific',
  'Month',
]
// try to guess if each noun is a plural/singular
const setPluralSingular = function (term) {
  if (!term.tags.has('Noun') || term.tags.has('Plural') || term.tags.has('Singular')) {
    return
  }
  if (uncountable.find(tag => term.tags.has(tag))) {
    return
  }
  if (looksPlural(term.normal)) {
    fastTag(term, 'Plural', '3-plural-guess')
  } else {
    fastTag(term, 'Singular', '3-singular-guess')
  }
}

// try to guess the tense of a naked verb
const setTense = function (term) {
  let tags = term.tags
  if (tags.has('Verb') && tags.size === 1) {
    let guess = getTense(term.normal)
    if (guess) {
      fastTag(term, guess, '3-verb-tense-guess')
    }
  }
}

//add deduced parent tags to our terms
const fillTags = function (terms, i, model) {
  let term = terms[i]
  //there is probably just one tag, but we'll allow more
  let tags = Array.from(term.tags)
  for (let k = 0; k < tags.length; k += 1) {
    if (model.one.tagSet[tags[k]]) {
      let toAdd = model.one.tagSet[tags[k]].parents
      fastTag(term, toAdd, ` -inferred by #${tags[k]}`)
    }
  }
  // turn 'Noun' into Plural/Singular
  setPluralSingular(term)
  // turn 'Verb' into Present/PastTense
  setTense(term, model)
}
export default fillTags
