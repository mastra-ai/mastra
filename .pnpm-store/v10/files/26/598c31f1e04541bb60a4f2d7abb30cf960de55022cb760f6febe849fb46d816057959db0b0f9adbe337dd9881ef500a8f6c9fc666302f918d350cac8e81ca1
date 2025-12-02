// name any [unnamed] capture-groups with a number
const nameGroups = function (regs) {
  let index = 0
  let inGroup = null
  //'fill in' capture groups between start-end
  for (let i = 0; i < regs.length; i++) {
    const token = regs[i]
    if (token.groupStart === true) {
      inGroup = token.group
      if (inGroup === null) {
        inGroup = String(index)
        index += 1
      }
    }
    if (inGroup !== null) {
      token.group = inGroup
    }
    if (token.groupEnd === true) {
      inGroup = null
    }
  }
  return regs
}

// optimize an 'or' lookup, when the (a|b|c) list is simple or multi-word
const doFastOrMode = function (tokens) {
  return tokens.map(token => {
    if (token.choices !== undefined) {
      // make sure it's an OR
      if (token.operator !== 'or') {
        return token
      }
      if (token.fuzzy === true) {
        return token
      }
      // are they all straight-up words? then optimize them.
      let shouldPack = token.choices.every(block => {
        if (block.length !== 1) {
          return false
        }
        let reg = block[0]
        // ~fuzzy~ words need more care
        if (reg.fuzzy === true) {
          return false
        }
        // ^ and $ get lost in fastOr
        if (reg.start || reg.end) {
          return false
        }
        if (reg.word !== undefined && reg.negative !== true && reg.optional !== true && reg.method !== true) {
          return true //reg is simple-enough
        }
        return false
      })
      if (shouldPack === true) {
        token.fastOr = new Set()
        token.choices.forEach(block => {
          token.fastOr.add(block[0].word)
        })
        delete token.choices
      }
    }
    return token
  })
}

// support ~(a|b|c)~
const fuzzyOr = function (regs) {
  return regs.map(reg => {
    if (reg.fuzzy && reg.choices) {
      // pass fuzzy-data to each OR choice
      reg.choices.forEach(r => {
        if (r.length === 1 && r[0].word) {
          r[0].fuzzy = true
          r[0].min = reg.min
        }
      })
    }
    return reg
  })
}

const postProcess = function (regs) {
  // ensure all capture groups names are filled between start and end
  regs = nameGroups(regs)
  // convert 'choices' format to 'fastOr' format
  regs = doFastOrMode(regs)
  // support ~(foo|bar)~
  regs = fuzzyOr(regs)
  return regs
}
export default postProcess
