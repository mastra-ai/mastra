import { getGroup } from '../_lib.js'
import foundOptional from './optional-match.js'
import greedyMatch from './greedy-match.js'
import contractionSkip from './contraction-skip.js'


// '[foo]' should also be logged as a group
const setGroup = function (state, startAt) {
  let reg = state.regs[state.r]
  // Get or create capture group
  const g = getGroup(state, startAt)
  // Update group - add greedy or increment length
  if (state.t > 1 && reg.greedy) {
    g.length += state.t - startAt
  } else {
    g.length++
  }
}

// when a reg matches a term
const simpleMatch = function (state) {
  const { regs } = state
  let reg = regs[state.r]
  let term = state.terms[state.t]
  let startAt = state.t
  // if it's a negative optional match... :0
  if (reg.optional && regs[state.r + 1] && reg.negative) {
    return true
  }
  // okay, it was a match, but if it's optional too,
  // we should check the next reg too, to skip it?
  if (reg.optional && regs[state.r + 1]) {
    foundOptional(state)
  }
  // Contraction skip:
  // did we match the first part of a contraction?
  if (term.implicit && state.terms[state.t + 1]) {
    contractionSkip(state)
  }
  //advance to the next term!
  state.t += 1
  //check any ending '$' flags
  //if this isn't the last term, refuse the match
  if (reg.end === true && state.t !== state.terms.length && reg.greedy !== true) {
    return null //die
  }
  // keep 'foo+' going...
  if (reg.greedy === true) {
    let alive = greedyMatch(state)
    if (!alive) {
      return null
    }
  }
  // log '[foo]' as a group
  if (state.hasGroup === true) {
    setGroup(state, startAt)
  }
  return true
}
export default simpleMatch