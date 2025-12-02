import colors from './_colors.js'

const getColor = function (node) {
  if (colors.hasOwnProperty(node.id)) {
    return colors[node.id]
  }
  if (colors.hasOwnProperty(node.is)) {
    return colors[node.is]
  }
  let found = node._cache.parents.find(c => colors[c])
  return colors[found]
}

// convert tags to our final format
const fmt = function (nodes) {
  const res = {}
  nodes.forEach(node => {
    let { not, also, is, novel } = node.props
    let parents = node._cache.parents
    if (also) {
      parents = parents.concat(also)
    }
    res[node.id] = {
      is,
      not,
      novel,
      also,
      parents,
      children: node._cache.children,
      color: getColor(node)
    }
  })
  // lastly, add all children of all nots
  Object.keys(res).forEach(k => {
    let nots = new Set(res[k].not)
    res[k].not.forEach(not => {
      if (res[not]) {
        res[not].children.forEach(tag => nots.add(tag))
      }
    })
    res[k].not = Array.from(nots)
  })
  return res
}

export default fmt