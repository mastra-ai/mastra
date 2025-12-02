import splice from './_splice.js'
import apostropheS from './apostrophe-s.js'
import apostropheD from './apostrophe-d.js'
import apostropheT from './apostrophe-t.js'
import isPossessive from './isPossessive.js'

const byApostrophe = /'/

// poor-mans reindexing of this sentence only
const reIndex = function (terms) {
  terms.forEach((t, i) => {
    if (t.index) {
      t.index[1] = i
    }
  })
}

// run tagger on our new implicit terms
const reTag = function (terms, view, start, len) {
  let tmp = view.update()
  tmp.document = [terms]
  // offer to re-tag neighbours, too
  let end = start + len
  if (start > 0) {
    start -= 1
  }
  if (terms[end]) {
    end += 1
  }
  tmp.ptrs = [[0, start, end]]
  tmp.compute(['freeze', 'lexicon', 'preTagger', 'unfreeze'])
  // don't for a reindex of the whole document
  reIndex(terms)
}

const byEnd = {
  // how'd
  d: (terms, i) => apostropheD(terms, i),
  // we ain't
  t: (terms, i) => apostropheT(terms, i),
  // bob's
  s: (terms, i, world) => {
    // [bob's house] vs [bob's cool]
    if (isPossessive(terms, i)) {
      return world.methods.one.setTag([terms[i]], 'Possessive', world, null, '2-contraction')
    }
    return apostropheS(terms, i)
  },
}

const toDocs = function (words, view) {
  let doc = view.fromText(words.join(' '))
  doc.compute('id')
  return doc.docs[0]
}

//really easy ones
const contractionTwo = view => {
  let { world, document } = view
  // each sentence
  document.forEach((terms, n) => {
    // loop through terms backwards
    for (let i = terms.length - 1; i >= 0; i -= 1) {
      // is it already a contraction
      if (terms[i].implicit) {
        continue
      }
      let after = null
      if (byApostrophe.test(terms[i].normal) === true) {
        after = terms[i].normal.split(byApostrophe)[1]
      }
      let words = null
      // any known-ones, like 'dunno'?
      if (byEnd.hasOwnProperty(after)) {
        words = byEnd[after](terms, i, world)
      }
      // actually insert the new terms
      if (words) {
        words = toDocs(words, view)
        splice(document, [n, i], words)
        reTag(document[n], view, i, words.length)
        continue
      }
    }
  })
}
export default { contractionTwo }
