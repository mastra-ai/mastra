import { doAndBlock } from './logic/and-or.js'
import { getGroup } from '../_lib.js'

// '(foo && #Noun)' - require all matches on the term
const andBlock = function (state) {
  const { regs } = state
  let reg = regs[state.r]

  let skipNum = doAndBlock(state)
  if (skipNum) {
    // handle 'not' logic
    if (reg.negative === true) {
      return null // die
    }
    if (state.hasGroup === true) {
      const g = getGroup(state, state.t)
      g.length += skipNum
    }
    // ensure we're at the end
    if (reg.end === true) {
      let end = state.phrase_length - 1
      if (state.t + state.start_i !== end) {
        return null
      }
    }
    state.t += skipNum
    // log(`✓ |found-and|`)
    return true
  } else if (!reg.optional) {
    return null //die
  }
  return true
}
export default andBlock