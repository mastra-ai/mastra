const senseMethods = function (View) {
  /** add sense to these terms*/
  View.prototype.sense = function (s) {
    this.docs.forEach(terms =>
      terms.forEach(t => {
        t.sense = s
      })
    )
  }
}
export default senseMethods
