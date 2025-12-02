import world from './world.js'
import api from './methods/index.js'

class View {
  constructor(document, pointer, groups = {}) {
    // invisible props
    let props = [
      ['document', document],
      ['world', world],
      ['_groups', groups],
      ['_cache', null],
      ['viewType', 'View'],
    ]
    props.forEach(a => {
      Object.defineProperty(this, a[0], {
        value: a[1],
        writable: true,
      })
    })
    this.ptrs = pointer
  }
  /* getters:  */
  get docs() {
    let docs = this.document
    if (this.ptrs) {
      docs = world.methods.one.getDoc(this.ptrs, this.document)
    }
    return docs
  }
  get pointer() {
    return this.ptrs
  }
  get methods() {
    return this.world.methods
  }
  get model() {
    return this.world.model
  }
  get hooks() {
    return this.world.hooks
  }
  get isView() {
    return true //this comes in handy sometimes
  }
  // is the view not-empty?
  get found() {
    return this.docs.length > 0
  }
  // how many matches we have
  get length() {
    return this.docs.length
  }
  // return a more-hackable pointer
  get fullPointer() {
    let { docs, ptrs, document } = this
    // compute a proper pointer, from docs
    let pointers = ptrs || docs.map((_d, n) => [n])
    // do we need to repair it, first?
    return pointers.map(a => {
      let [n, start, end, id, endId] = a
      start = start || 0
      end = end || (document[n] || []).length
      //add frozen id, for good-measure
      if (document[n] && document[n][start]) {
        id = id || document[n][start].id
        if (document[n][end - 1]) {
          endId = endId || document[n][end - 1].id
        }
      }
      return [n, start, end, id, endId]
    })
  }
  // create a new View, from this one
  update(pointer) {
    let m = new View(this.document, pointer)
    // send the cache down, too?
    if (this._cache && pointer && pointer.length > 0) {
      // only keep cache if it's a full-sentence
      let cache = []
      pointer.forEach((ptr, i) => {
        let [n, start, end] = ptr
        if (ptr.length === 1) {
          cache[i] = this._cache[n]
        } else if (start === 0 && this.document[n].length === end) {
          cache[i] = this._cache[n]
        }
      })
      if (cache.length > 0) {
        m._cache = cache
      }
    }
    m.world = this.world
    return m
  }
  // create a new View, from this one
  toView(pointer) {
    return new View(this.document, pointer || this.pointer)
  }
  fromText(input) {
    const { methods } = this
    //assume ./01-tokenize is installed
    let document = methods.one.tokenize.fromString(input, this.world)
    let doc = new View(document)
    doc.world = this.world
    doc.compute(['normal', 'freeze', 'lexicon'])
    if (this.world.compute.preTagger) {
      doc.compute('preTagger')
    }
    doc.compute('unfreeze')
    return doc
  }
  clone() {
    // clone the whole document
    let document = this.document.slice(0) //node 17: structuredClone(document);
    document = document.map(terms => {
      return terms.map(term => {
        term = Object.assign({}, term)
        term.tags = new Set(term.tags)
        return term
      })
    })
    // clone only sub-document ?
    let m = this.update(this.pointer)
    m.document = document
    m._cache = this._cache //clone this too?
    return m
  }
}
Object.assign(View.prototype, api)
export default View
