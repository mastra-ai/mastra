import parse from './parse/index.js'

const isArray = arr => Object.prototype.toString.call(arr) === '[object Array]'

// turn anything into {foo:true} format
const coerceToObject = function (input) {
  if (typeof input === 'string' || typeof input === 'number') {
    let tmp = {}
    tmp[input] = true
    return tmp
  }
  if (isArray(input)) {
    return input.reduce((h, s) => {
      h[s] = true
      return h
    }, {})
  }
  return input || {}
}

// only return values with the given unit
const isUnit = function (doc, input = {}) {
  input = coerceToObject(input)
  return doc.filter(p => {
    let { unit } = parse(p)
    if (unit && input[unit] === true) {
      return true
    }
    return false
  })
}
export default isUnit
