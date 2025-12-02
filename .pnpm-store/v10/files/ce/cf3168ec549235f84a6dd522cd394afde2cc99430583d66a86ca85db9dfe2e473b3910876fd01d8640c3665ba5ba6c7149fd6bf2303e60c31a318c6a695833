// assume any discovered prefixes
const autoFill = function () {
  const docs = this.docs
  if (docs.length === 0) {
    return this
  }
  let lastPhrase = docs[docs.length - 1] || []
  let term = lastPhrase[lastPhrase.length - 1]
  if (term.typeahead === true && term.machine) {
    term.text = term.machine
    term.normal = term.machine
  }
  return this
}

const api = function (View) {
  View.prototype.autoFill = autoFill
}
export default api