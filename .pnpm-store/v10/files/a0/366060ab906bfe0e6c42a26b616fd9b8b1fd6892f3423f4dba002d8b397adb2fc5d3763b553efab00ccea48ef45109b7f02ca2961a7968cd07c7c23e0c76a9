const titleCase = /^\p{Lu}[\p{Ll}'’]/u //upercase, then lowercase
import contract from './contract.js'

const toTitleCase = function (str = '') {
  str = str.replace(/^ *[a-z\u00C0-\u00FF]/, x => x.toUpperCase()) //TODO: support unicode
  return str
}

const api = function (View) {
  /** */
  class Contractions extends View {
    constructor(document, pointer, groups) {
      super(document, pointer, groups)
      this.viewType = 'Contraction'
    }
    /** i've -> 'i have' */
    expand() {
      this.docs.forEach(terms => {
        let isTitleCase = titleCase.test(terms[0].text)
        terms.forEach((t, i) => {
          t.text = t.implicit || ''
          delete t.implicit
          //add whitespace
          if (i < terms.length - 1 && t.post === '') {
            t.post += ' '
          }
          // flag it as dirty
          t.dirty = true
        })
        // make the first word title-case?
        if (isTitleCase) {
          terms[0].text = toTitleCase(terms[0].text)
        }
      })
      this.compute('normal') //re-set normalized text
      return this
    }
  }
  // add fn to View
  View.prototype.contractions = function () {
    let m = this.match('@hasContraction+')
    return new Contractions(this.document, m.pointer)
  }
  View.prototype.contract = contract
}

export default api
