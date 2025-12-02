import doesMatch from '../../term/doesMatch.js'

const negGreedy = function (state, reg, nextReg) {
  let skip = 0
  for (let t = state.t; t < state.terms.length; t += 1) {
    let found = doesMatch(state.terms[t], reg, state.start_i + state.t, state.phrase_length)
    // we don't want a match, here
    if (found) {
      break//stop going
    }
    // are we doing 'greedy-to'?
    // - "!foo+ after"  should stop at 'after'
    if (nextReg) {
      found = doesMatch(state.terms[t], nextReg, state.start_i + state.t, state.phrase_length)
      if (found) {
        break
      }
    }
    skip += 1
    // is it max-length now?
    if (reg.max !== undefined && skip === reg.max) {
      break
    }
  }
  if (skip === 0) {
    return false //dead
  }
  // did we satisfy min for !foo{min,max}
  if (reg.min && reg.min > skip) {
    return false//dead
  }
  state.t += skip
  // state.r += 1
  return true
}

export default negGreedy