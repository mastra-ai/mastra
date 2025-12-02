// extract the clear needs for an individual match token
const getTokenNeeds = function (reg) {
  // negatives can't be cached
  if (reg.optional === true || reg.negative === true) {
    return null
  }
  if (reg.tag) {
    return '#' + reg.tag
  }
  if (reg.word) {
    return reg.word
  }
  if (reg.switch) {
    return `%${reg.switch}%`
  }
  return null
}

const getNeeds = function (regs) {
  let needs = []
  regs.forEach(reg => {
    needs.push(getTokenNeeds(reg))
    // support AND (foo && tag)
    if (reg.operator === 'and' && reg.choices) {
      reg.choices.forEach(oneSide => {
        oneSide.forEach(r => {
          needs.push(getTokenNeeds(r))
        })
      })
    }
  })
  return needs.filter(str => str)
}

const getWants = function (regs) {
  let wants = []
  let count = 0
  regs.forEach(reg => {
    if (reg.operator === 'or' && !reg.optional && !reg.negative) {
      // add fast-or terms
      if (reg.fastOr) {
        Array.from(reg.fastOr).forEach(w => {
          wants.push(w)
        })
      }
      // add slow-or
      if (reg.choices) {
        reg.choices.forEach(rs => {
          rs.forEach(r => {
            let n = getTokenNeeds(r)
            if (n) {
              wants.push(n)
            }
          })
        })
      }
      count += 1
    }
  })
  return { wants, count }
}

const parse = function (matches, world) {
  const parseMatch = world.methods.one.parseMatch
  matches.forEach(obj => {
    obj.regs = parseMatch(obj.match, {}, world)
    // wrap these ifNo properties into an array
    if (typeof obj.ifNo === 'string') {
      obj.ifNo = [obj.ifNo]
    }
    if (obj.notIf) {
      obj.notIf = parseMatch(obj.notIf, {}, world)
    }
    // cache any requirements up-front 
    obj.needs = getNeeds(obj.regs)
    let { wants, count } = getWants(obj.regs)
    obj.wants = wants
    obj.minWant = count
    // get rid of tiny sentences
    obj.minWords = obj.regs.filter(o => !o.optional).length
  })
  return matches
}

export default parse
