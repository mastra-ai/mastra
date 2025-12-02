import build from './buildTrie/index.js'
import scan from './scan.js'

const isObject = val => {
  return Object.prototype.toString.call(val) === '[object Object]'
}

export default function (View) {

  /** find all matches in this document */
  View.prototype.lookup = function (input, opts = {}) {
    if (!input) {
      return this.none()
    }
    if (typeof input === 'string') {
      input = [input]
    }
    let trie = isObject(input) ? input : build(input, this.world)
    let res = scan(this, trie, opts)
    res = res.settle()
    return res
  }
}