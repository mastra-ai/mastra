import methods from './lib/_sort.js'
// aliases
const seqNames = new Set(['index', 'sequence', 'seq', 'sequential', 'chron', 'chronological'])
const freqNames = new Set(['freq', 'frequency', 'topk', 'repeats'])
const alphaNames = new Set(['alpha', 'alphabetical'])

// support function as parameter
const customSort = function (view, fn) {
  let ptrs = view.fullPointer
  ptrs = ptrs.sort((a, b) => {
    a = view.update([a])
    b = view.update([b])
    return fn(a, b)
  })
  view.ptrs = ptrs //mutate original
  return view
}

/** re-arrange the order of the matches (in place) */
const sort = function (input) {
  let { docs, pointer } = this
  this.uncache()
  if (typeof input === 'function') {
    return customSort(this, input)
  }
  input = input || 'alpha'
  let ptrs = pointer || docs.map((_d, n) => [n])
  let arr = docs.map((terms, n) => {
    return {
      index: n,
      words: terms.length,
      normal: terms.map(t => t.machine || t.normal || '').join(' '),
      pointer: ptrs[n],
    }
  })
  // 'chronological' sorting
  if (seqNames.has(input)) {
    input = 'sequential'
  }
  // alphabetical sorting
  if (alphaNames.has(input)) {
    input = 'alpha'
  }
  // sort by frequency
  if (freqNames.has(input)) {
    arr = methods.byFreq(arr)
    return this.update(arr.map(o => o.pointer))
  }
  // apply sort method on each phrase
  if (typeof methods[input] === 'function') {
    arr = arr.sort(methods[input])
    return this.update(arr.map(o => o.pointer))
  }
  return this
}

/** reverse the order of the matches, but not the words or index */
const reverse = function () {
  let ptrs = this.pointer || this.docs.map((_d, n) => [n])
  ptrs = [].concat(ptrs)
  ptrs = ptrs.reverse()
  if (this._cache) {
    this._cache = this._cache.reverse()
  }
  return this.update(ptrs)
}

/** remove any duplicate matches */
const unique = function () {
  let already = new Set()
  let res = this.filter(m => {
    let txt = m.text('machine')
    if (already.has(txt)) {
      return false
    }
    already.add(txt)
    return true
  })
  // this.ptrs = res.ptrs //mutate original?
  return res//.compute('index')
}

export default { unique, reverse, sort }
