import { cleanAppend, cleanPrepend } from './lib/insert.js'
import uuid from '../compute/uuid.js'
// are we inserting inside a contraction?
// expand it first
const expand = function (m) {
  if (m.has('@hasContraction') && typeof m.contractions === 'function') {
    //&& m.after('^.').has('@hasContraction')
    let more = m.grow('@hasContraction')
    more.contractions().expand()
  }
}

const isArray = arr => Object.prototype.toString.call(arr) === '[object Array]'

// set new ids for each terms
const addIds = function (terms) {
  terms = terms.map(term => {
    term.id = uuid(term)
    return term
  })
  return terms
}

const getTerms = function (input, world) {
  const { methods } = world
  // create our terms from a string
  if (typeof input === 'string') {
    return methods.one.tokenize.fromString(input, world)[0] //assume one sentence
  }
  //allow a view object
  if (typeof input === 'object' && input.isView) {
    return input.clone().docs[0] || [] //assume one sentence
  }
  //allow an array of terms, too
  if (isArray(input)) {
    return isArray(input[0]) ? input[0] : input
  }
  return []
}

const insert = function (input, view, prepend) {
  const { document, world } = view
  view.uncache()
  // insert words at end of each doc
  let ptrs = view.fullPointer
  let selfPtrs = view.fullPointer
  view.forEach((m, i) => {
    let ptr = m.fullPointer[0]
    let [n] = ptr
    // add-in the words
    let home = document[n]
    let terms = getTerms(input, world)
    // are we inserting nothing?
    if (terms.length === 0) {
      return
    }
    terms = addIds(terms)
    if (prepend) {
      expand(view.update([ptr]).firstTerm())
      cleanPrepend(home, ptr, terms, document)
    } else {
      expand(view.update([ptr]).lastTerm())
      cleanAppend(home, ptr, terms, document)
    }
    // harden the pointer
    if (document[n] && document[n][ptr[1]]) {
      ptr[3] = document[n][ptr[1]].id
    }
    // change self backwards by len
    selfPtrs[i] = ptr
    // extend the pointer
    ptr[2] += terms.length
    ptrs[i] = ptr
  })
  let doc = view.toView(ptrs)
  // shift our self pointer, if necessary
  view.ptrs = selfPtrs
  // try to tag them, too
  doc.compute(['id', 'index', 'freeze', 'lexicon'])
  if (doc.world.compute.preTagger) {
    doc.compute('preTagger')
  }
  doc.compute('unfreeze')
  return doc
}

const fns = {
  insertAfter: function (input) {
    return insert(input, this, false)
  },
  insertBefore: function (input) {
    return insert(input, this, true)
  },
}
fns.append = fns.insertAfter
fns.prepend = fns.insertBefore
fns.insert = fns.insertAfter

export default fns
