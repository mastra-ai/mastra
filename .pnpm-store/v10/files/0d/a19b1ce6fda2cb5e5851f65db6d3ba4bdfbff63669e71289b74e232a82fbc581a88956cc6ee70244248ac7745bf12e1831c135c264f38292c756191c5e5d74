// generate all the possible prefixes up-front
const getPrefixes = function (arr, opts, world) {
  let index = {}
  let collisions = []
  let existing = world.prefixes || {}
  arr.forEach((str) => {
    str = str.toLowerCase().trim()
    let max = str.length
    if (opts.max && max > opts.max) {
      max = opts.max
    }
    for (let size = opts.min; size < max; size += 1) {
      let prefix = str.substring(0, size)
      // ensure prefix is not a word
      if (opts.safe && world.model.one.lexicon.hasOwnProperty(prefix)) {
        continue
      }
      // does it already exist?
      if (existing.hasOwnProperty(prefix) === true) {
        collisions.push(prefix)
        continue
      }
      if (index.hasOwnProperty(prefix) === true) {
        collisions.push(prefix)
        continue
      }
      index[prefix] = str
    }
  })
  // merge with existing prefixes
  index = Object.assign({}, existing, index)
  // remove ambiguous-prefixes
  collisions.forEach((str) => {
    delete index[str]
  })
  return index
}

export default getPrefixes
