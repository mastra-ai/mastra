
// 01- full-word exceptions
const checkEx = function (str, ex = {}) {
  if (ex.hasOwnProperty(str)) {
    return ex[str]
  }
  return null
}

// 02- suffixes that pass our word through
const checkSame = function (str, same = []) {
  for (let i = 0; i < same.length; i += 1) {
    if (str.endsWith(same[i])) {
      return str
    }
  }
  return null
}

// 03- check rules - longest first
const checkRules = function (str, fwd, both = {}) {
  fwd = fwd || {}
  let max = str.length - 1
  // look for a matching suffix
  for (let i = max; i >= 1; i -= 1) {
    let size = str.length - i
    let suff = str.substring(size, str.length)
    // check fwd rules, first
    if (fwd.hasOwnProperty(suff) === true) {
      return str.slice(0, size) + fwd[suff]
    }
    // check shared rules
    if (both.hasOwnProperty(suff) === true) {
      return str.slice(0, size) + both[suff]
    }
  }
  // try a fallback transform
  if (fwd.hasOwnProperty('')) {
    return str += fwd['']
  }
  if (both.hasOwnProperty('')) {
    return str += both['']
  }
  return null
}

//sweep-through all suffixes
const convert = function (str = '', model = {}) {
  // 01- check exceptions
  let out = checkEx(str, model.ex)
  // 02 - check same
  out = out || checkSame(str, model.same)
  // check forward and both rules
  out = out || checkRules(str, model.fwd, model.both)
  //return unchanged
  out = out || str
  return out
}
export default convert