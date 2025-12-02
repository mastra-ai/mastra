const api = function (View) {

  class Pronouns extends View {
    constructor(document, pointer, groups) {
      super(document, pointer, groups)
      this.viewType = 'Pronouns'
    }
    hasReference() {
      this.compute('coreference')
      return this.filter(m => {
        let term = m.docs[0][0]
        return term.reference
      })
    }
    // get the noun-phrase this pronoun refers to
    refersTo() {
      //calculate links
      this.compute('coreference')
      // return them
      return this.map(m => {
        if (!m.found) {
          return m.none()
        }
        let term = m.docs[0][0]
        if (term.reference) {
          return m.update([term.reference])
        }
        return m.none()
      })
    }
    // overloaded - keep Numbers class
    update(pointer) {
      let m = new Pronouns(this.document, pointer)
      m._cache = this._cache // share this full thing
      return m
    }
  }

  View.prototype.pronouns = function (n) {
    let m = this.match('#Pronoun')
    m = m.getNth(n)
    return new Pronouns(m.document, m.pointer)
  }
}
export default api
