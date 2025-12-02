import allPrefixes from './allPrefixes.js'

const isObject = val => {
  return Object.prototype.toString.call(val) === '[object Object]'
}

const defaults = {
  safe: true,
  min: 3,
}

const prepare = function (words = [], opts = {}) {
  let model = this.model()
  opts = Object.assign({}, defaults, opts)
  if (isObject(words)) {
    Object.assign(model.one.lexicon, words)
    words = Object.keys(words)
  }
  let prefixes = allPrefixes(words, opts, this.world())
  // manually combine these with any existing prefixes
  Object.keys(prefixes).forEach(str => {
    // explode any overlaps
    if (model.one.typeahead.hasOwnProperty(str)) {
      delete model.one.typeahead[str]
      return
    }
    model.one.typeahead[str] = prefixes[str]
  })
  return this
}

export default {
  typeahead: prepare
}