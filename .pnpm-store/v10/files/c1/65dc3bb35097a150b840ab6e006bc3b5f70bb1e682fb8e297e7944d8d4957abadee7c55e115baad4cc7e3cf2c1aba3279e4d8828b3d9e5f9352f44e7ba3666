const methods = {
  /** add this punctuation or whitespace before each match: */
  pre: function (str, concat) {
    if (str === undefined && this.found) {
      return this.docs[0][0].pre
    }
    this.docs.forEach(terms => {
      let term = terms[0]
      if (concat === true) {
        term.pre += str
      } else {
        term.pre = str
      }
    })
    return this
  },

  /** add this punctuation or whitespace after each match: */
  post: function (str, concat) {
    if (str === undefined) {
      let last = this.docs[this.docs.length - 1]
      return last[last.length - 1].post
    }
    this.docs.forEach(terms => {
      let term = terms[terms.length - 1]
      if (concat === true) {
        term.post += str
      } else {
        term.post = str
      }
    })
    return this
  },

  /** remove whitespace from start/end */
  trim: function () {
    if (!this.found) {
      return this
    }
    let docs = this.docs
    let start = docs[0][0]
    start.pre = start.pre.trimStart()
    let last = docs[docs.length - 1]
    let end = last[last.length - 1]
    end.post = end.post.trimEnd()
    return this
  },

  /** connect words with hyphen, and remove whitespace */
  hyphenate: function () {
    this.docs.forEach(terms => {
      //remove whitespace
      terms.forEach((t, i) => {
        if (i !== 0) {
          t.pre = ''
        }
        if (terms[i + 1]) {
          t.post = '-'
        }
      })
    })
    return this
  },

  /** remove hyphens between words, and set whitespace */
  dehyphenate: function () {
    const hasHyphen = /[-–—]/
    this.docs.forEach(terms => {
      //remove whitespace
      terms.forEach(t => {
        if (hasHyphen.test(t.post)) {
          t.post = ' '
        }
      })
    })
    return this
  },

  /** add quotations around these matches */
  toQuotations: function (start, end) {
    start = start || `"`
    end = end || `"`
    this.docs.forEach(terms => {
      terms[0].pre = start + terms[0].pre
      let last = terms[terms.length - 1]
      last.post = end + last.post
    })
    return this
  },

  /** add brackets around these matches */
  toParentheses: function (start, end) {
    start = start || `(`
    end = end || `)`
    this.docs.forEach(terms => {
      terms[0].pre = start + terms[0].pre
      let last = terms[terms.length - 1]
      last.post = end + last.post
    })
    return this
  },
}

// aliases
methods.deHyphenate = methods.dehyphenate
methods.toQuotation = methods.toQuotations

export default methods
