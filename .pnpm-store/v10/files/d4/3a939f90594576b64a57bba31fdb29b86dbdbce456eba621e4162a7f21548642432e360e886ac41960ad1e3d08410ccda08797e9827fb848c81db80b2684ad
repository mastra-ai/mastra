import doesMatch from '../../term/doesMatch.js'

// for greedy checking, we no longer care about the reg.start
// value, and leaving it can cause failures for anchored greedy
// matches.  ditto for end-greedy matches: we need an earlier non-
// ending match to succceed until we get to the actual end.
const getGreedy = function (state, endReg) {
  let reg = Object.assign({}, state.regs[state.r], { start: false, end: false })
  let start = state.t
  for (; state.t < state.terms.length; state.t += 1) {
    //stop for next-reg match
    if (endReg && doesMatch(state.terms[state.t], endReg, state.start_i + state.t, state.phrase_length)) {
      return state.t
    }
    let count = state.t - start + 1
    // is it max-length now?
    if (reg.max !== undefined && count === reg.max) {
      return state.t
    }
    //stop here
    if (doesMatch(state.terms[state.t], reg, state.start_i + state.t, state.phrase_length) === false) {
      // is it too short?
      if (reg.min !== undefined && count < reg.min) {
        return null
      }
      return state.t
    }
  }
  return state.t
}

const greedyTo = function (state, nextReg) {
  let t = state.t
  //if there's no next one, just go off the end!
  if (!nextReg) {
    return state.terms.length
  }
  //otherwise, we're looking for the next one
  for (; t < state.terms.length; t += 1) {
    if (doesMatch(state.terms[t], nextReg, state.start_i + t, state.phrase_length) === true) {
      // console.log(`greedyTo ${state.terms[t].normal}`)
      return t
    }
  }
  //guess it doesn't exist, then.
  return null
}

const isEndGreedy = function (reg, state) {
  if (reg.end === true && reg.greedy === true) {
    if (state.start_i + state.t < state.phrase_length - 1) {
      let tmpReg = Object.assign({}, reg, { end: false })
      if (doesMatch(state.terms[state.t], tmpReg, state.start_i + state.t, state.phrase_length) === true) {
        // console.log(`endGreedy ${state.terms[state.t].normal}`)
        return true
      }
    }
  }
  return false
}

export { isEndGreedy, greedyTo, getGreedy }