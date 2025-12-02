import fuzzy from './_fuzzy.js'
import methods from '../../termMethods.js' //this should load off of 'methods.one.termMethods'

//declare it up here
let wrapMatch = function () { }
/** ignore optional/greedy logic, straight-up term match*/
const doesMatch = function (term, reg, index, length) {
  // support '.'
  if (reg.anything === true) {
    return true
  }
  // support '^' (in parentheses)
  if (reg.start === true && index !== 0) {
    return false
  }
  // support '$' (in parentheses)
  if (reg.end === true && index !== length - 1) {
    return false
  }
  // match an id
  if (reg.id !== undefined && reg.id === term.id) {
    return true
  }
  //support a text match
  if (reg.word !== undefined) {
    // check case-sensitivity, etc
    if (reg.use) {
      return reg.word === term[reg.use]
    }
    //match contractions, machine-form
    if (term.machine !== null && term.machine === reg.word) {
      return true
    }
    // term aliases for slashes and things
    if (term.alias !== undefined && term.alias.hasOwnProperty(reg.word)) {
      return true
    }
    // support ~ fuzzy match
    if (reg.fuzzy === true) {
      if (reg.word === term.root) {
        return true
      }
      let score = fuzzy(reg.word, term.normal)
      if (score >= reg.min) {
        return true
      }
    }
    // match slashes and things
    if (term.alias && term.alias.some(str => str === reg.word)) {
      return true
    }
    //match either .normal or .text
    return reg.word === term.text || reg.word === term.normal
  }
  //support #Tag
  if (reg.tag !== undefined) {
    return term.tags.has(reg.tag) === true
  }
  //support @method
  if (reg.method !== undefined) {
    if (typeof methods[reg.method] === 'function' && methods[reg.method](term) === true) {
      return true
    }
    return false
  }
  //support whitespace/punctuation
  if (reg.pre !== undefined) {
    return term.pre && term.pre.includes(reg.pre)
  }
  if (reg.post !== undefined) {
    return term.post && term.post.includes(reg.post)
  }
  //support /reg/
  if (reg.regex !== undefined) {
    let str = term.normal
    if (reg.use) {
      str = term[reg.use]
    }
    return reg.regex.test(str)
  }
  //support <chunk>
  if (reg.chunk !== undefined) {
    return term.chunk === reg.chunk
  }
  //support %Noun|Verb%
  if (reg.switch !== undefined) {
    return term.switch === reg.switch
  }
  //support {machine}
  if (reg.machine !== undefined) {
    return term.normal === reg.machine || term.machine === reg.machine || term.root === reg.machine
  }
  //support {word/sense}
  if (reg.sense !== undefined) {
    return term.sense === reg.sense
  }
  // support optimized (one|two)
  if (reg.fastOr !== undefined) {
    // {work/verb} must be a verb
    if (reg.pos && !term.tags.has(reg.pos)) {
      return null
    }
    let str = term.root || term.implicit || term.machine || term.normal
    return reg.fastOr.has(str) || reg.fastOr.has(term.text)
  }
  //support slower (one|two)
  if (reg.choices !== undefined) {
    // try to support && operator
    if (reg.operator === 'and') {
      // must match them all
      return reg.choices.every(r => wrapMatch(term, r, index, length))
    }
    // or must match one
    return reg.choices.some(r => wrapMatch(term, r, index, length))
  }
  return false
}
// wrap result for !negative match logic
wrapMatch = function (t, reg, index, length) {
  let result = doesMatch(t, reg, index, length)
  if (reg.negative === true) {
    return !result
  }
  return result
}
export default wrapMatch
