import methods from './methods.js'

// turn presets into key-vals
const split = (str) => {
  return str.split('|').reduce((h, k) => {
    h[k] = true
    return h
  }, {})
}

const light = 'unicode|punctuation|whitespace|acronyms'
const medium = '|case|contractions|parentheses|quotations|emoji|honorifics|debullet'
const heavy = '|possessives|adverbs|nouns|verbs'
const presets = {
  light: split(light),
  medium: split(light + medium),
  heavy: split(light + medium + heavy)
}

export default function (View) {
  View.prototype.normalize = function (opts = 'light') {
    if (typeof opts === 'string') {
      opts = presets[opts]
    }
    // run each method
    Object.keys(opts).forEach(fn => {
      if (methods.hasOwnProperty(fn)) {
        methods[fn](this, opts[fn])
      }
    })
    return this
  }
}