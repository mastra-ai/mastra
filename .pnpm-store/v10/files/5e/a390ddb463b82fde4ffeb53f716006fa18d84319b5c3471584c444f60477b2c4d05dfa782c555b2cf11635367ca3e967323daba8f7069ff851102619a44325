const api = function (View) {

  /** speedy match a sequence of matches */
  View.prototype.sweep = function (net, opts = {}) {
    const { world, docs } = this
    const { methods } = world
    let found = methods.one.bulkMatch(docs, net, this.methods, opts)

    // apply any changes
    if (opts.tagger !== false) {
      methods.one.bulkTagger(found, docs, this.world)
    }
    // fix the pointers
    // collect all found results into a View
    found = found.map(o => {
      let ptr = o.pointer
      let term = docs[ptr[0]][ptr[1]]
      let len = ptr[2] - ptr[1]
      if (term.index) {
        o.pointer = [
          term.index[0],
          term.index[1],
          ptr[1] + len
        ]
      }
      return o
    })
    let ptrs = found.map(o => o.pointer)
    // cleanup results a bit
    found = found.map(obj => {
      obj.view = this.update([obj.pointer])
      delete obj.regs
      delete obj.needs
      delete obj.pointer
      delete obj._expanded
      return obj
    })
    return {
      view: this.update(ptrs),
      found
    }
  }

}
export default api