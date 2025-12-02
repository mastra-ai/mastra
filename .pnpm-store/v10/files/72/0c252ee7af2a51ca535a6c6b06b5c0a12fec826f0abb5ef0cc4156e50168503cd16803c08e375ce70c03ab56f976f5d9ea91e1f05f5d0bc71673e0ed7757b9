import { greedyTo } from './logic/greedy.js'
import { getGroup } from '../_lib.js'

//support 'unspecific greedy' .* properly
// its logic is 'greedy until', where it's looking for the next token
// '.+ foo' means we check for 'foo', indefinetly
const doAstrix = function (state) {
  let { regs } = state
  let reg = regs[state.r]

  let skipto = greedyTo(state, regs[state.r + 1])
  //maybe we couldn't find it
  if (skipto === null || skipto === 0) {
    return null
  }
  // ensure it's long enough
  if (reg.min !== undefined && skipto - state.t < reg.min) {
    return null
  }
  // reduce it back, if it's too long
  if (reg.max !== undefined && skipto - state.t > reg.max) {
    state.t = state.t + reg.max
    return true
  }
  // set the group result
  if (state.hasGroup === true) {
    const g = getGroup(state, state.t)
    g.length = skipto - state.t
  }
  state.t = skipto
  // log(`✓ |greedy|`)
  return true
}
export default doAstrix