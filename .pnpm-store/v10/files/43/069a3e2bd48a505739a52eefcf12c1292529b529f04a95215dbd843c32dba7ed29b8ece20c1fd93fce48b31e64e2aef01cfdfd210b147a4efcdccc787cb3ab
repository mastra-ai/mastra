const createCache = function (document) {
  let cache = document.map(terms => {
    let items = new Set()
    terms.forEach(term => {
      // add words
      if (term.normal !== '') {
        items.add(term.normal)
      }
      // cache switch-status - '%Noun|Verb%'
      if (term.switch) {
        items.add(`%${term.switch}%`)
      }
      // cache implicit words, too
      if (term.implicit) {
        items.add(term.implicit)
      }
      if (term.machine) {
        items.add(term.machine)
      }
      if (term.root) {
        items.add(term.root)
      }
      // cache slashes words, etc
      if (term.alias) {
        term.alias.forEach(str => items.add(str))
      }
      let tags = Array.from(term.tags)
      for (let t = 0; t < tags.length; t += 1) {
        items.add('#' + tags[t])
      }
    })
    return items
  })
  return cache
}
export default createCache
