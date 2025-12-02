// support returning a subset of a match
// like 'foo [bar] baz' -> bar
const getGroup = function (res, group) {
  let ptrs = []
  let byGroup = {}
  if (res.length === 0) {
    return { ptrs, byGroup }
  }
  if (typeof group === 'number') {
    group = String(group)
  }
  if (group) {
    res.forEach(r => {
      if (r.groups[group]) {
        ptrs.push(r.groups[group])
      }
    })
  } else {
    res.forEach(r => {
      ptrs.push(r.pointer)
      Object.keys(r.groups).forEach(k => {
        byGroup[k] = byGroup[k] || []
        byGroup[k].push(r.groups[k])
      })
    })
  }
  return { ptrs, byGroup }
}
export default getGroup
