const Histogram = function () {
  this.counts = {}
}

const methods = {
  init: function (sym) {
    if (this.counts[sym] === undefined) {
      this.counts[sym] = 0
    }
  },
  add: function (sym, n) {
    if (n === undefined) {
      n = 1
    }
    this.init(sym)
    this.counts[sym] += n
  },
  countOf: function (sym) {
    this.init(sym)
    return this.counts[sym]
  },
  highest: function (top) {
    let sorted = []
    const keys = Object.keys(this.counts)
    for (let i = 0; i < keys.length; i++) {
      const sym = keys[i]
      sorted.push([sym, this.counts[sym]])
    }
    sorted.sort(function (a, b) {
      return b[1] - a[1]
    })
    if (top) {
      sorted = sorted.slice(0, top)
    }
    return sorted
  }
}

Object.keys(methods).forEach(function (k) {
  Histogram.prototype[k] = methods[k]
})

export default Histogram
