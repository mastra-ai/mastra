import { getGreedy } from './logic/greedy.js'

// keep 'foo+' or 'foo*' going..
const greedyMatch = function (state) {
  const { regs, phrase_length } = state
  let reg = regs[state.r]
  state.t = getGreedy(state, regs[state.r + 1])
  if (state.t === null) {
    return null //greedy was too short
  }
  // foo{2,4} - has a greed-minimum
  if (reg.min && reg.min > state.t) {
    return null //greedy was too short
  }
  // 'foo+$' - if also an end-anchor, ensure we really reached the end
  if (reg.end === true && state.start_i + state.t !== phrase_length) {
    return null //greedy didn't reach the end
  }
  return true
}
export default greedyMatch