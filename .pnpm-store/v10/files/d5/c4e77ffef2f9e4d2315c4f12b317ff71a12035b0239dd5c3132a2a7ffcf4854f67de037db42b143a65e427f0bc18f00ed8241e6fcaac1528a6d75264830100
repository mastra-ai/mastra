// for each cached-sentence, find a list of possible matches
const getHooks = function (docCaches, hooks) {
  return docCaches.map((set, i) => {
    let maybe = []
    Object.keys(hooks).forEach(k => {
      if (docCaches[i].has(k)) {
        maybe = maybe.concat(hooks[k])
      }
    })
    // remove duplicates
    let already = {}
    maybe = maybe.filter(m => {
      if (typeof already[m.match] === 'boolean') {
        return false
      }
      already[m.match] = true
      return true
    })
    return maybe
  })
}

export default getHooks
