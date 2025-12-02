import find from './find.js'

const addMethod = function (View) {
  View.prototype.places = function (n) {
    let m = find(this)
    m = m.getNth(n)
    return new View(this.document, m.pointer)
  }
}
export default addMethod
