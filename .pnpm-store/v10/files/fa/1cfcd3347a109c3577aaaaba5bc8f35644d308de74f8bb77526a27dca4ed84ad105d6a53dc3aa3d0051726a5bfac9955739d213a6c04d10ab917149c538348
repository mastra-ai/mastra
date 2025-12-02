import doesMatch from '../../term/doesMatch.js'

const isArray = function (arr) {
  return Object.prototype.toString.call(arr) === '[object Array]'
}

export const doOrBlock = function (state, skipN = 0) {
  let block = state.regs[state.r]
  let wasFound = false
  // do each multiword sequence
  for (let c = 0; c < block.choices.length; c += 1) {
    // try to match this list of tokens
    let regs = block.choices[c]
    if (!isArray(regs)) {
      return false
    }
    wasFound = regs.every((cr, w_index) => {
      let extra = 0
      let t = state.t + w_index + skipN + extra
      if (state.terms[t] === undefined) {
        return false
      }
      let foundBlock = doesMatch(state.terms[t], cr, t + state.start_i, state.phrase_length)
      // this can be greedy - '(foo+ bar)'
      if (foundBlock === true && cr.greedy === true) {
        for (let i = 1; i < state.terms.length; i += 1) {
          let term = state.terms[t + i]
          if (term) {
            let keepGoing = doesMatch(term, cr, state.start_i + i, state.phrase_length)
            if (keepGoing === true) {
              extra += 1
            } else {
              break
            }
          }
        }
      }
      skipN += extra
      return foundBlock
    })
    if (wasFound) {
      skipN += regs.length
      break
    }
  }
  // we found a match -  is it greedy though?
  if (wasFound && block.greedy === true) {
    return doOrBlock(state, skipN) // try it again!
  }
  return skipN
}

const doAndBlock = function (state) {
  let longest = 0
  // all blocks must match, and we return the greediest match
  let reg = state.regs[state.r]
  let allDidMatch = reg.choices.every(block => {
    //  for multi-word blocks, all must match
    let allWords = block.every((cr, w_index) => {
      let tryTerm = state.t + w_index
      if (state.terms[tryTerm] === undefined) {
        return false
      }
      return doesMatch(state.terms[tryTerm], cr, tryTerm, state.phrase_length)
    })
    if (allWords === true && block.length > longest) {
      longest = block.length
    }
    return allWords
  })
  if (allDidMatch === true) {
    // console.log(`doAndBlock ${state.terms[state.t].normal}`)
    return longest
  }
  return false
}
export { doAndBlock }