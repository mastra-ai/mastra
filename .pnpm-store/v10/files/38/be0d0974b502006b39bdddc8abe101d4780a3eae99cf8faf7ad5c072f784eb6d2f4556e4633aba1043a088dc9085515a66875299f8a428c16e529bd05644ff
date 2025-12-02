import colons from './1st-pass/01-colons.js'
import hyphens from './1st-pass/02-hyphens.js'

import tagSwitch from './2nd-pass/00-tagSwitch.js'
import checkCase from './2nd-pass/01-case.js'
import checkSuffix from './2nd-pass/02-suffix.js'
import checkRegex from './2nd-pass/03-regex.js'
import checkPrefix from './2nd-pass/04-prefix.js'
import checkYear from './2nd-pass/05-year.js'
import verbType from './3rd-pass/07-verb-type.js'

import fillTags from './3rd-pass/_fillTags.js'
import checkAcronym from './3rd-pass/01-acronym.js'
import neighbours from './3rd-pass/02-neighbours.js'
import orgWords from './3rd-pass/03-orgWords.js'
import placeWords from './3rd-pass/04-placeWords.js'
import nounFallback from './3rd-pass/05-fallback.js'
import switches from './3rd-pass/06-switches.js'
import imperative from './3rd-pass/08-imperative.js'

// is it all yelling-case?
const ignoreCase = function (terms) {
  // allow 'John F Kennedy'
  if (terms.filter(t => !t.tags.has('ProperNoun')).length <= 3) {
    return false
  }
  const lowerCase = /^[a-z]/
  return terms.every(t => !lowerCase.test(t.text))
}

// taggers with no clause-splitting
const firstPass = function (docs, model, world) {
  docs.forEach(terms => {
    // check whitespace/punctuation
    colons(terms, 0, model, world)
  })
}

// these methods don't care about word-neighbours
const secondPass = function (terms, model, world, isYelling) {
  for (let i = 0; i < terms.length; i += 1) {
    // skip frozen terms, for now
    if (terms[i].frozen === true) {
      continue
    }
    // mark Noun|Verb on term metadata
    tagSwitch(terms, i, model)
    //  is it titlecased?
    if (isYelling === false) {
      checkCase(terms, i, model)
    }
    // look at word ending
    checkSuffix(terms, i, model)
    // try look-like rules
    checkRegex(terms, i, model, world)
    // check for recognized prefix, like 'micro-'
    checkPrefix(terms, i, model)
    // turn '1993' into a year
    checkYear(terms, i, model)
  }
}

// neighbour-based tagging
const thirdPass = function (terms, model, world, isYelling) {
  for (let i = 0; i < terms.length; i += 1) {
    // let these tags get layered
    let found = checkAcronym(terms, i, model)
    // deduce parent tags
    fillTags(terms, i, model)
    // look left+right for hints
    found = found || neighbours(terms, i, model)
    //  ¯\_(ツ)_/¯ - found nothing
    found = found || nounFallback(terms, i, model)
  }
  for (let i = 0; i < terms.length; i += 1) {
    // skip these
    if (terms[i].frozen === true) {
      continue
    }
    // Johnson LLC
    orgWords(terms, i, world, isYelling)
    // Wawel Castle
    placeWords(terms, i, world, isYelling)
    // verb-noun disambiguation, etc
    switches(terms, i, world)
    // give bare verbs more tags
    verbType(terms, i, model, world)
    // hard-nosed
    hyphens(terms, i, model, world)
  }
  // place tea bags
  imperative(terms, world)
}

const preTagger = function (view) {
  const { methods, model, world } = view
  let docs = view.docs
  // try some early stuff
  firstPass(docs, model, world)
  // roughly split sentences up by clause
  let document = methods.two.quickSplit(docs)
  // start with all terms
  for (let n = 0; n < document.length; n += 1) {
    let terms = document[n]
    // is it all upper-case?
    const isYelling = ignoreCase(terms)
    // guess by the letters
    secondPass(terms, model, world, isYelling)
    // guess by the neighbours
    thirdPass(terms, model, world, isYelling)
  }
  return document
}

export default preTagger
