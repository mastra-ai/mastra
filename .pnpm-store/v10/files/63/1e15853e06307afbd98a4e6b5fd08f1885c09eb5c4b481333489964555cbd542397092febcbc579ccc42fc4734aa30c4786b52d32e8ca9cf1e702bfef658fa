import parse from './01-parse.js'

// do some indexing on the list of matches
const buildNet = function (matches, world) {
  // turn match-syntax into json
  matches = parse(matches, world)

  // collect by wants and needs
  let hooks = {}
  matches.forEach(obj => {
    // add needs
    obj.needs.forEach(str => {
      hooks[str] = Array.isArray(hooks[str]) ? hooks[str] : []
      hooks[str].push(obj)
    })
    // add wants
    obj.wants.forEach(str => {
      hooks[str] = Array.isArray(hooks[str]) ? hooks[str] : []
      hooks[str].push(obj)
    })
  })
  // remove duplicates
  Object.keys(hooks).forEach(k => {
    let already = {}
    hooks[k] = hooks[k].filter(obj => {
      if (typeof already[obj.match] === 'boolean') {
        return false
      }
      already[obj.match] = true
      return true
    })
  })

  // keep all un-cacheable matches (those with no needs) 
  let always = matches.filter(o => o.needs.length === 0 && o.wants.length === 0)
  return {
    hooks,
    always
  }
}

export default buildNet
