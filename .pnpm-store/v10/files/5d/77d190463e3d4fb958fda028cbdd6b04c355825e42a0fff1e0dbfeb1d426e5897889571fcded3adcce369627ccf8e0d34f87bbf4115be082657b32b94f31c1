const combine = function (left, right) {
  return [left[0], left[1], right[2]]
}

const isArray = function (arr) {
  return Object.prototype.toString.call(arr) === '[object Array]'
}

const getDoc = (reg, view, group) => {
  if (typeof reg === 'string' || isArray(reg)) {
    return view.match(reg, group)
  }
  if (!reg) {
    return view.none()
  }
  return reg
}

const addIds = function (ptr, view) {
  let [n, start, end] = ptr
  if (view.document[n] && view.document[n][start]) {
    ptr[3] = ptr[3] || view.document[n][start].id
    if (view.document[n][end - 1]) {
      ptr[4] = ptr[4] || view.document[n][end - 1].id
    }
  }
  return ptr
}

const methods = {}
// [before], [match], [after]
methods.splitOn = function (m, group) {
  const { splitAll } = this.methods.one.pointer
  let splits = getDoc(m, this, group).fullPointer
  let all = splitAll(this.fullPointer, splits)
  let res = []
  all.forEach(o => {
    res.push(o.passthrough)
    res.push(o.before)
    res.push(o.match)
    res.push(o.after)
  })
  res = res.filter(p => p)
  res = res.map(p => addIds(p, this))
  return this.update(res)
}

// [before], [match after]
methods.splitBefore = function (m, group) {
  const { splitAll } = this.methods.one.pointer
  let splits = getDoc(m, this, group).fullPointer
  let all = splitAll(this.fullPointer, splits)
  // repair matches to favor [match, after]
  // - instead of [before, match]
  for (let i = 0; i < all.length; i += 1) {
    // move a before to a preceding after
    if (!all[i].after && all[i + 1] && all[i + 1].before) {
      // ensure it's from the same original sentence
      if (all[i].match && all[i].match[0] === all[i + 1].before[0]) {
        all[i].after = all[i + 1].before
        delete all[i + 1].before
      }
    }
  }

  let res = []
  all.forEach(o => {
    res.push(o.passthrough)
    res.push(o.before)
    // a, [x, b]
    if (o.match && o.after) {
      res.push(combine(o.match, o.after))
    } else {
      // a, [x], b
      res.push(o.match)
    }
  })
  res = res.filter(p => p)
  res = res.map(p => addIds(p, this))
  return this.update(res)
}

// [before match], [after]
methods.splitAfter = function (m, group) {
  const { splitAll } = this.methods.one.pointer
  let splits = getDoc(m, this, group).fullPointer
  let all = splitAll(this.fullPointer, splits)
  let res = []
  all.forEach(o => {
    res.push(o.passthrough)
    if (o.before && o.match) {
      res.push(combine(o.before, o.match))
    } else {
      res.push(o.before)
      res.push(o.match)
    }
    res.push(o.after)
  })
  res = res.filter(p => p)
  res = res.map(p => addIds(p, this))
  return this.update(res)
}
methods.split = methods.splitAfter

export default methods
