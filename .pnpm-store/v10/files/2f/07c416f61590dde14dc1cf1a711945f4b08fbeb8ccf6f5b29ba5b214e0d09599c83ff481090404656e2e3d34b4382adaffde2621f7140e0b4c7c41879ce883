export default {
  /** */
  toLowerCase: function () {
    this.termList().forEach(t => {
      t.text = t.text.toLowerCase()
    })
    return this
  },
  /** */
  toUpperCase: function () {
    this.termList().forEach(t => {
      t.text = t.text.toUpperCase()
    })
    return this
  },
  /** */
  toTitleCase: function () {
    this.termList().forEach(t => {
      t.text = t.text.replace(/^ *[a-z\u00C0-\u00FF]/, x => x.toUpperCase()) //support unicode?
    })
    return this
  },
  /** */
  toCamelCase: function () {
    this.docs.forEach(terms => {
      terms.forEach((t, i) => {
        if (i !== 0) {
          t.text = t.text.replace(/^ *[a-z\u00C0-\u00FF]/, x => x.toUpperCase()) //support unicode?
        }
        if (i !== terms.length - 1) {
          t.post = ''
        }
      })
    })
    return this
  },
}
