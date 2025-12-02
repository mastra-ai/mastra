import { find, strip } from './fns.js'

const api = function (View) {
  class Parentheses extends View {
    constructor(document, pointer, groups) {
      super(document, pointer, groups)
      this.viewType = 'Possessives'
    }
    strip() {
      return strip(this)
    }
  }

  View.prototype.parentheses = function (n) {
    let m = find(this)
    m = m.getNth(n)
    return new Parentheses(m.document, m.pointer)
  }
}
export default api
