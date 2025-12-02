import { toSuperlative, toComparative, fromSuperlative, fromComparative, toNoun } from './inflect.js'
import fromAdverb from './conjugate/fromAdverb.js'
import toAdverb from './conjugate/toAdverb.js'
// import toNoun from './conjugate/toNoun.js'

const all = function (str, model) {
  let arr = [str]
  arr.push(toSuperlative(str, model))
  arr.push(toComparative(str, model))
  arr.push(toAdverb(str))
  arr = arr.filter(s => s)
  arr = new Set(arr)
  return Array.from(arr)
}


export default {
  toSuperlative, toComparative, toAdverb, toNoun,
  fromAdverb, fromSuperlative, fromComparative,
  all,
}