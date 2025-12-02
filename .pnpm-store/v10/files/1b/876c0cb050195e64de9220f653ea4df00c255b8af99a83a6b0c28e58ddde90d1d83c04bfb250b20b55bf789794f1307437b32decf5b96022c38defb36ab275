import parse from './input/index.js'
import View from './View.js'

const grad = function (input) {
  let data = parse(input)
  return new View(data)
}

grad.prototype.plugin = function (fn) {
  fn(this)
}

export default grad
