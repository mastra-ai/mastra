export const relPointer = function (ptrs, parent) {
  if (!parent) {
    return ptrs
  }
  ptrs.forEach(ptr => {
    let n = ptr[0]
    if (parent[n]) {
      ptr[0] = parent[n][0] //n
      ptr[1] += parent[n][1] //start
      ptr[2] += parent[n][1] //end
    }
  })
  return ptrs
}

// make match-result relative to whole document
export const fixPointers = function (res, parent) {
  let { ptrs, byGroup } = res
  ptrs = relPointer(ptrs, parent)
  Object.keys(byGroup).forEach(k => {
    byGroup[k] = relPointer(byGroup[k], parent)
  })
  return { ptrs, byGroup }
}

// turn any matchable input intp a list of matches
export const parseRegs = function (regs, opts, world) {
  const one = world.methods.one
  if (typeof regs === 'number') {
    regs = String(regs)
  }
  // support param as string
  if (typeof regs === 'string') {
    regs = one.killUnicode(regs, world)
    regs = one.parseMatch(regs, opts, world)
  }
  return regs
}

const isObject = val => {
  return Object.prototype.toString.call(val) === '[object Object]'
}

// did they pass-in a compromise object?
export const isView = val => val && isObject(val) && val.isView === true

export const isNet = val => val && isObject(val) && val.isNet === true
