const defaults = {
  people: true,
  emails: true,
  phoneNumbers: true,
  places: true,
}

const redact = function (opts = {}) {
  opts = Object.assign({}, defaults, opts)
  if (opts.people !== false) {
    this.people().replaceWith('██████████')
  }
  if (opts.emails !== false) {
    this.emails().replaceWith('██████████')
  }
  if (opts.places !== false) {
    this.places().replaceWith('██████████')
  }
  if (opts.phoneNumbers !== false) {
    this.phoneNumbers().replaceWith('███████')
  }
  return this
}

const plugin = {
  api: function (View) {
    View.prototype.redact = redact
  }
}
export default plugin
