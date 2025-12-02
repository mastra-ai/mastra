import splice from './_splice.js'
import apostropheD from './apostrophe-d.js'
import apostropheT from './apostrophe-t.js'
import french from './french.js'
import numberRange from './number-range.js'
import numberUnit from './number-unit.js'

const byApostrophe = /'/
const numDash = /^[0-9][^-–—]*[-–—].*?[0-9]/

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
}

const byEnd = {
  // ain't
  t: (terms, i) => apostropheT(terms, i),
  // how'd
  d: (terms, i) => apostropheD(terms, i),
}

const byStart = {
  // j'aime
  j: (terms, i) => french.preJ(terms, i),
  // l'amour
  l: (terms, i) => french.preL(terms, i),
  // d'amerique
  d: (terms, i) => french.preD(terms, i),
}

// pull-apart known contractions from model
const knownOnes = function (list, term, before, after) {
  for (let i = 0; i < list.length; i += 1) {
    let o = list[i]
    // look for word-word match (cannot-> [can, not])
    if (o.word === term.normal) {
      return o.out
    }
    // look for after-match ('re -> [_, are])
    else if (after !== null && after === o.after) {
      return [before].concat(o.out)
    }
    // look for before-match (l' -> [le, _])
    else if (before !== null && before === o.before && after && after.length > 2) {
      return o.out.concat(after)
      // return [o.out, after] //typeof o.out === 'string' ? [o.out, after] : o.out(terms, i)
    }
  }
  return null
}

const toDocs = function (words, view) {
  let doc = view.fromText(words.join(' '))
  doc.compute(['id', 'alias'])
  return doc.docs[0]
}

// there's is usually [there, is]
// but can be 'there has' for 'there has (..) been'
const thereHas = function (terms, i) {
  for (let k = i + 1; k < 5; k += 1) {
    if (!terms[k]) {
      break
    }
    if (terms[k].normal === 'been') {
      return ['there', 'has']
    }
  }
  return ['there', 'is']
}

//really easy ones
const contractions = view => {
  let { world, document } = view
  const { model, methods } = world
  let list = model.one.contractions || []
  // let units = new Set(model.one.units || [])
  // each sentence
  document.forEach((terms, n) => {
    // loop through terms backwards
    for (let i = terms.length - 1; i >= 0; i -= 1) {
      let before = null
      let after = null
      if (byApostrophe.test(terms[i].normal) === true) {
        let res = terms[i].normal.split(byApostrophe)
        before = res[0]
        after = res[1]
      }
      // any known-ones, like 'dunno'?
      let words = knownOnes(list, terms[i], before, after)
      // ['foo', 's']
      if (!words && byEnd.hasOwnProperty(after)) {
        words = byEnd[after](terms, i, world)
      }
      // ['j', 'aime']
      if (!words && byStart.hasOwnProperty(before)) {
        words = byStart[before](terms, i)
      }
      // 'there is' vs 'there has'
      if (before === 'there' && after === 's') {
        words = thereHas(terms, i)
      }
      // actually insert the new terms
      if (words) {
        words = toDocs(words, view)
        splice(document, [n, i], words)
        reTag(document[n], view, i, words.length)
        continue
      }
      // '44-2' has special care
      if (numDash.test(terms[i].normal)) {
        words = numberRange(terms, i)
        if (words) {
          words = toDocs(words, view)
          splice(document, [n, i], words)
          methods.one.setTag(words, 'NumberRange', world) //add custom tag
          // is it a time-range, like '5-9pm'
          if (words[2] && words[2].tags.has('Time')) {
            methods.one.setTag([words[0]], 'Time', world, null, 'time-range')
          }
          reTag(document[n], view, i, words.length)
        }
        continue
      }
      // split-apart '4km'
      words = numberUnit(terms, i, world)
      if (words) {
        words = toDocs(words, view)
        splice(document, [n, i], words)
        methods.one.setTag([words[1]], 'Unit', world, null, 'contraction-unit')
      }
    }
  })
}
export default contractions
