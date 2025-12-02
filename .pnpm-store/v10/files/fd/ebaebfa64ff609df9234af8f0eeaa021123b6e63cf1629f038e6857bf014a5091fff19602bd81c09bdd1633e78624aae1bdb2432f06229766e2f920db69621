import doAstrix from './steps/astrix.js'
import doOrBlock from './steps/or-block.js'
import doAndBlock from './steps/and-block.js'
import doNegative from './steps/negative.js'
import simpleMatch from './steps/simple-match.js'
import { isEndGreedy } from './steps/logic/greedy.js'
import matchTerm from './term/doesMatch.js'
// i formally apologize for how complicated this is.

/** 
 * try a sequence of match tokens ('regs') 
 * on a sequence of terms, 
 * starting at this certain term.
 */
const tryHere = function (terms, regs, start_i, phrase_length) {
  // console.log(`\n\n:start: '${terms[0].text}':`)
  if (terms.length === 0 || regs.length === 0) {
    return null
  }
  // all the variables that matter
  let state = {
    t: 0,
    terms: terms,
    r: 0,
    regs: regs,
    groups: {},
    start_i: start_i,
    phrase_length: phrase_length,
    inGroup: null,
  }

  // we must satisfy every token in 'regs'
  // if we get to the end, we have a match.
  for (; state.r < regs.length; state.r += 1) {
    let reg = regs[state.r]
    // Check if this reg has a named capture group
    state.hasGroup = Boolean(reg.group)
    // Reuse previous capture group if same
    if (state.hasGroup === true) {
      state.inGroup = reg.group
    } else {
      state.inGroup = null
    }
    //have we run-out of terms?
    if (!state.terms[state.t]) {
      //are all remaining regs optional or negative?
      const alive = regs.slice(state.r).some(remain => !remain.optional)
      if (alive === false) {
        break //done!
      }
      return null // die
    }
    // support 'unspecific greedy' .* properly
    if (reg.anything === true && reg.greedy === true) {
      let alive = doAstrix(state)
      if (!alive) {
        return null
      }
      continue
    }
    // slow-OR - multi-word OR (a|b|foo bar)
    if (reg.choices !== undefined && reg.operator === 'or') {
      let alive = doOrBlock(state)
      if (!alive) {
        return null
      }
      continue
    }
    // slow-AND - multi-word AND (#Noun && foo) blocks
    if (reg.choices !== undefined && reg.operator === 'and') {
      let alive = doAndBlock(state)
      if (!alive) {
        return null
      }
      continue
    }
    // support '.' as any-single
    if (reg.anything === true) {
      // '!.' negative anything should insta-fail
      if (reg.negative && reg.anything) {
        return null
      }
      let alive = simpleMatch(state)
      if (!alive) {
        return null
      }
      continue
    }
    // support 'foo*$' until the end
    if (isEndGreedy(reg, state) === true) {
      let alive = simpleMatch(state)
      if (!alive) {
        return null
      }
      continue
    }
    // ok, it doesn't match - but maybe it wasn't *supposed* to?
    if (reg.negative) {
      // we want *anything* but this term
      let alive = doNegative(state)
      if (!alive) {
        return null
      }
      continue
    }
    // ok, finally test the term-reg
    let hasMatch = matchTerm(state.terms[state.t], reg, state.start_i + state.t, state.phrase_length)
    if (hasMatch === true) {
      let alive = simpleMatch(state)
      if (!alive) {
        return null
      }
      continue
    }
    //ok who cares, keep going
    if (reg.optional === true) {
      continue
    }

    // finally, we die
    return null
  }
  //return our results, as pointers
  let pntr = [null, start_i, state.t + start_i]
  if (pntr[1] === pntr[2]) {
    return null //found 0 terms
  }
  let groups = {}
  Object.keys(state.groups).forEach(k => {
    let o = state.groups[k]
    let start = start_i + o.start
    groups[k] = [null, start, start + o.length]
  })
  return { pointer: pntr, groups: groups }
}
export default tryHere
