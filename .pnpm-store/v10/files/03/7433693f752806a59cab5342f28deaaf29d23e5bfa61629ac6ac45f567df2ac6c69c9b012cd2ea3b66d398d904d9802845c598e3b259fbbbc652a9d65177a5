const utils = {
  /** */
  termList: function () {
    return this.methods.one.termList(this.docs)
  },
  /** return individual terms*/
  terms: function (n) {
    let m = this.match('.')
    // this is a bit faster than .match('.') 
    // let ptrs = []
    // this.docs.forEach((terms) => {
    //   terms.forEach((term) => {
    //     let [y, x] = term.index || []
    //     ptrs.push([y, x, x + 1])
    //   })
    // })
    // let m = this.update(ptrs)
    return typeof n === 'number' ? m.eq(n) : m
  },

  /** */
  groups: function (group) {
    if (group || group === 0) {
      return this.update(this._groups[group] || [])
    }
    // return an object of Views
    let res = {}
    Object.keys(this._groups).forEach(k => {
      res[k] = this.update(this._groups[k])
    })
    // this._groups = null
    return res
  },
  /** */
  eq: function (n) {
    let ptr = this.pointer
    if (!ptr) {
      ptr = this.docs.map((_doc, i) => [i])
    }
    if (ptr[n]) {
      return this.update([ptr[n]])
    }
    return this.none()
  },
  /** */
  first: function () {
    return this.eq(0)
  },
  /** */
  last: function () {
    let n = this.fullPointer.length - 1
    return this.eq(n)
  },

  /** grab term[0] for every match */
  firstTerms: function () {
    return this.match('^.')
  },

  /** grab the last term for every match  */
  lastTerms: function () {
    return this.match('.$')
  },

  /** */
  slice: function (min, max) {
    let pntrs = this.pointer || this.docs.map((_o, n) => [n])
    pntrs = pntrs.slice(min, max)
    return this.update(pntrs)
  },

  /** return a view of the entire document */
  all: function () {
    return this.update().toView()
  },
  /**  */
  fullSentences: function () {
    let ptrs = this.fullPointer.map(a => [a[0]]) //lazy!
    return this.update(ptrs).toView()
  },
  /** return a view of no parts of the document */
  none: function () {
    return this.update([])
  },

  /** are these two views looking at the same words? */
  isDoc: function (b) {
    if (!b || !b.isView) {
      return false
    }
    let aPtr = this.fullPointer
    let bPtr = b.fullPointer
    if (!aPtr.length === bPtr.length) {
      return false
    }
    // ensure pointers are the same
    return aPtr.every((ptr, i) => {
      if (!bPtr[i]) {
        return false
      }
      // ensure [n, start, end] are all the same
      return ptr[0] === bPtr[i][0] && ptr[1] === bPtr[i][1] && ptr[2] === bPtr[i][2]
    })
  },

  /** how many seperate terms does the document have? */
  wordCount: function () {
    return this.docs.reduce((count, terms) => {
      count += terms.filter(t => t.text !== '').length
      return count
    }, 0)
  },

  // is the pointer the full sentence?
  isFull: function () {
    let ptrs = this.pointer
    if (!ptrs) {
      return true
    }
    // must start at beginning
    if (ptrs.length === 0 || ptrs[0][0] !== 0) {
      return false
    }
    let wantTerms = 0
    let haveTerms = 0
    this.document.forEach(terms => wantTerms += terms.length)
    this.docs.forEach(terms => haveTerms += terms.length)
    return wantTerms === haveTerms
    // for (let i = 0; i < ptrs.length; i += 1) {
    //   let [n, start, end] = ptrs[i]
    //   // it's not the start
    //   if (n !== i || start !== 0) {
    //     return false
    //   }
    //   // it's too short
    //   if (document[n].length > end) {
    //     return false
    //   }
    // }
    // return true
  },

  // return the nth elem of a doc
  getNth: function (n) {
    if (typeof n === 'number') {
      return this.eq(n)
    } else if (typeof n === 'string') {
      return this.if(n)
    }
    return this
  }

}
utils.group = utils.groups
utils.fullSentence = utils.fullSentences
utils.sentence = utils.fullSentences
utils.lastTerm = utils.lastTerms
utils.firstTerm = utils.firstTerms
export default utils
