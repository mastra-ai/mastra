import matchTerm from '../term/doesMatch.js'

// 'foo? foo' matches are tricky.
const foundOptional = function (state) {
  const { regs } = state
  let reg = regs[state.r]
  let term = state.terms[state.t]
  // does the next reg match it too?
  let nextRegMatched = matchTerm(term, regs[state.r + 1], state.start_i + state.t, state.phrase_length)
  if (reg.negative || nextRegMatched) {
    // but does the next reg match the next term??
    // only skip if it doesn't
    let nextTerm = state.terms[state.t + 1]
    if (!nextTerm || !matchTerm(nextTerm, regs[state.r + 1], state.start_i + state.t, state.phrase_length)) {
      state.r += 1
    }
  }
}

export default foundOptional