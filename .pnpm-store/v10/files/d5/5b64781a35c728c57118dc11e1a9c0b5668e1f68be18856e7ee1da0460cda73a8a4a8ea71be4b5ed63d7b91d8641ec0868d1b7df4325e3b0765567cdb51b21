import methods from '../../methods/index.js'
import expandIrregulars from './irregulars.js'
import toPlural from '../../methods/transform/nouns/toPlural/index.js'
import conjugate from '../../methods/transform/verbs/conjugate/index.js'
import { toSuperlative, toComparative } from '../../methods/transform/adjectives/inflect.js'
import toInfinitive from '../../methods/transform/verbs/toInfinitive/index.js'
import models from '../models/index.js'
let tmpModel = {
  one: { lexicon: {} },
  two: { models }
}

// defaults for switches
const switchDefaults = {
  // 'pilot'
  'Actor|Verb': 'Actor', //
  // 'amusing'
  'Adj|Gerund': 'Adjective', //+conjugations
  // 'standard'
  'Adj|Noun': 'Adjective',
  // 'boiled'
  'Adj|Past': 'Adjective', //+conjugations
  // 'smooth'
  'Adj|Present': 'Adjective',//+conjugations
  // 'box'
  'Noun|Verb': 'Singular', //+conjugations (no-present)
  //'singing'
  'Noun|Gerund': 'Gerund', //+conjugations
  // 'hope'
  'Person|Noun': 'Noun',
  // 'April'
  'Person|Date': 'Month',
  // 'rob'
  'Person|Verb': 'FirstName',//+conjugations
  // 'victoria'
  'Person|Place': 'Person',
  // 'rusty'
  'Person|Adj': 'Comparative',
  // 'boxes'
  'Plural|Verb': 'Plural', //(these are already derivative)
  // 'miles'
  'Unit|Noun': 'Noun',
}

const expandLexicon = function (words, model) {
  // do clever tricks to grow the words
  const world = { model, methods }
  let { lex, _multi } = methods.two.expandLexicon(words, world)
  // store multiple-word terms in a cache
  Object.assign(model.one.lexicon, lex)
  Object.assign(model.one._multiCache, _multi)
  return model
}

// these words have no singular/plural conjugation
const addUncountables = function (words, model) {
  Object.keys(words).forEach(k => {
    if (words[k] === 'Uncountable') {
      model.two.uncountable[k] = true
      words[k] = 'Uncountable'
    }
  })
  return model
}

const expandVerb = function (str, words, doPresent) {
  let obj = conjugate(str, tmpModel)
  words[obj.PastTense] = words[obj.PastTense] || 'PastTense'
  words[obj.Gerund] = words[obj.Gerund] || 'Gerund'
  if (doPresent === true) {
    // is this plural noun, or present-tense?
    words[obj.PresentTense] = words[obj.PresentTense] || 'PresentTense'
  }
}

const expandAdjective = function (str, words, model) {
  let sup = toSuperlative(str, model)
  words[sup] = words[sup] || 'Superlative'
  let comp = toComparative(str, model)
  words[comp] = words[comp] || 'Comparative'
}

const expandNoun = function (str, words, model) {
  let plur = toPlural(str, model)
  words[plur] = words[plur] || 'Plural'
}

// harvest ambiguous words for any conjugations
const expandVariable = function (switchWords, model) {
  let words = {}
  const lex = model.one.lexicon
  //add first tag as an assumption for each variable word
  Object.keys(switchWords).forEach(w => {
    const name = switchWords[w]
    words[w] = switchDefaults[name]
    // conjugate some verbs
    if (name === 'Noun|Verb' || name === 'Person|Verb' || name === 'Actor|Verb') {
      expandVerb(w, lex, false)
    }
    if (name === 'Adj|Present') {
      expandVerb(w, lex, true)
      expandAdjective(w, lex, model)
    }
    if (name === 'Person|Adj') {
      expandAdjective(w, lex, model)
    }
    // add infinitives for gerunds
    if (name === 'Adj|Gerund' || name === 'Noun|Gerund') {
      let inf = toInfinitive(w, tmpModel, 'Gerund')
      if (!lex[inf]) {
        words[inf] = 'Infinitive' //expand it later
      }
    }
    // add plurals for nouns
    if (name === 'Noun|Gerund' || name === 'Adj|Noun' || name === 'Person|Noun') {
      expandNoun(w, lex, model)
    }
    if (name === 'Adj|Past') {
      let inf = toInfinitive(w, tmpModel, 'PastTense')
      if (!lex[inf]) {
        words[inf] = 'Infinitive' //expand it later
      }
    }
  })
  // add conjugations
  model = expandLexicon(words, model)
  return model
}

const expand = function (model) {
  model = expandLexicon(model.one.lexicon, model)
  model = addUncountables(model.one.lexicon, model)
  model = expandVariable(model.two.switches, model)
  model = expandIrregulars(model)
  return model
}
export default expand
