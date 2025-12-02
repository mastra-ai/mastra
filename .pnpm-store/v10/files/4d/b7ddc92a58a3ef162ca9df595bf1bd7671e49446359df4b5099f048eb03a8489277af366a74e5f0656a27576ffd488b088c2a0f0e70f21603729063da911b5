import { textFromTerms } from './_text.js'
import fmts from './_fmts.js'
import hash from '../methods/hash.js'

const defaults = {
  text: true,
  terms: true,
}

let opts = { case: 'none', unicode: 'some', form: 'machine', punctuation: 'some' }

const merge = function (a, b) {
  return Object.assign({}, a, b)
}

const fns = {
  text: terms => textFromTerms(terms, { keepPunct: true }, false),
  normal: terms => textFromTerms(terms, merge(fmts.normal, { keepPunct: true }), false),
  implicit: terms => textFromTerms(terms, merge(fmts.implicit, { keepPunct: true }), false),

  machine: terms => textFromTerms(terms, opts, false),
  root: terms => textFromTerms(terms, merge(opts, { form: 'root' }), false),

  hash: terms => hash(textFromTerms(terms, { keepPunct: true }, false)),

  offset: terms => {
    let len = fns.text(terms).length
    return {
      index: terms[0].offset.index,
      start: terms[0].offset.start,
      length: len,
    }
  },
  terms: terms => {
    return terms.map(t => {
      let term = Object.assign({}, t)
      term.tags = Array.from(t.tags)
      return term
    })
  },
  confidence: (_terms, view, i) => view.eq(i).confidence(),
  syllables: (_terms, view, i) => view.eq(i).syllables(),
  sentence: (_terms, view, i) => view.eq(i).fullSentence().text(),
  dirty: terms => terms.some(t => t.dirty === true),
}
fns.sentences = fns.sentence
fns.clean = fns.normal
fns.reduced = fns.root

const toJSON = function (view, option) {
  option = option || {}
  if (typeof option === 'string') {
    option = {}
  }
  option = Object.assign({}, defaults, option)
  // run any necessary upfront steps
  if (option.offset) {
    view.compute('offset')
  }
  return view.docs.map((terms, i) => {
    let res = {}
    Object.keys(option).forEach(k => {
      if (option[k] && fns[k]) {
        res[k] = fns[k](terms, view, i)
      }
    })
    return res
  })
}

const methods = {
  /** return data */
  json: function (n) {
    let res = toJSON(this, n)
    if (typeof n === 'number') {
      return res[n]
    }
    return res
  },
}
methods.data = methods.json
export default methods
