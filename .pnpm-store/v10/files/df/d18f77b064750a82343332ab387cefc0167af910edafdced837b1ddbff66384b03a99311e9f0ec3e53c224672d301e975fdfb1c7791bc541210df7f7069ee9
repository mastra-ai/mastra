const hasSlash = /\//

const api = function (View) {

  class Slashes extends View {
    constructor(document, pointer, groups) {
      super(document, pointer, groups)
      this.viewType = 'Slashes'
    }
    split() {
      return this.map((m) => {
        let str = m.text()
        let arr = str.split(hasSlash)
        m = m.replaceWith(arr.join(' '))
        return m.growRight('(' + arr.join('|') + ')+')
      })
    }
  }

  View.prototype.slashes = function (n) {
    let m = this.match('#SlashedTerm')
    m = m.getNth(n)
    return new Slashes(m.document, m.pointer)
  }
}
export default api
