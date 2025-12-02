import pluckOutTerm from './lib/remove.js'

const fixPointers = function (ptrs, gonePtrs) {
  ptrs = ptrs.map(ptr => {
    let [n] = ptr
    if (!gonePtrs[n]) {
      return ptr
    }
    gonePtrs[n].forEach(no => {
      let len = no[2] - no[1]
      // does it effect our pointer?
      if (ptr[1] <= no[1] && ptr[2] >= no[2]) {
        ptr[2] -= len
      }
    })
    return ptr
  })

  // decrement any pointers after a now-empty pointer
  ptrs.forEach((ptr, i) => {
    // is the pointer now empty?
    if (ptr[1] === 0 && ptr[2] == 0) {
      // go down subsequent pointers
      for (let n = i + 1; n < ptrs.length; n += 1) {
        ptrs[n][0] -= 1
        if (ptrs[n][0] < 0) {
          ptrs[n][0] = 0
        }
      }
    }
  })
  // remove any now-empty pointers
  ptrs = ptrs.filter(ptr => ptr[2] - ptr[1] > 0)

  // remove old hard-pointers
  ptrs = ptrs.map((ptr) => {
    ptr[3] = null
    ptr[4] = null
    return ptr
  })
  return ptrs
}

const methods = {
  /** */
  remove: function (reg) {
    const { indexN } = this.methods.one.pointer
    this.uncache()
    // two modes:
    //  - a. remove self, from full parent
    let self = this.all()
    let not = this
    //  - b. remove a match, from self
    if (reg) {
      self = this
      not = this.match(reg)
    }
    let isFull = !self.ptrs
    // is it part of a contraction?
    if (not.has('@hasContraction') && not.contractions) {
      let more = not.grow('@hasContraction')
      more.contractions().expand()
    }

    let ptrs = self.fullPointer
    let nots = not.fullPointer.reverse()
    // remove them from the actual document)
    let document = pluckOutTerm(this.document, nots)
    // repair our pointers
    let gonePtrs = indexN(nots)
    ptrs = fixPointers(ptrs, gonePtrs)
    // clean up our original inputs
    self.ptrs = ptrs
    self.document = document
    self.compute('index')
    // if we started zoomed-out, try to end zoomed-out
    if (isFull) {
      self.ptrs = undefined
    }
    if (!reg) {
      this.ptrs = []
      return self.none()
    }
    let res = self.toView(ptrs) //return new document
    return res
  },
}

// aliases
methods.delete = methods.remove
export default methods
