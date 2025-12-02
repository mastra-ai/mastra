import { doOrBlock } from './logic/and-or.js'
import { getGroup } from '../_lib.js'

const orBlock = function (state) {
  const { regs } = state
  let reg = regs[state.r]
  let skipNum = doOrBlock(state)
  // did we find a match?
  if (skipNum) {
    // handle 'not' logic
    if (reg.negative === true) {
      return null // die
    }
    // tuck in as named-group
    if (state.hasGroup === true) {
      const g = getGroup(state, state.t)
      g.length += skipNum
    }
    // ensure we're at the end
    if (reg.end === true) {
      let end = state.phrase_length
      if (state.t + state.start_i + skipNum !== end) {
        return null
      }
    }
    state.t += skipNum
    // log(`✓ |found-or|`)
    return true
  } else if (!reg.optional) {
    return null //die
  }
  return true
}
export default orBlock