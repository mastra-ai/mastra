import byDepth from './crawl.js'

// count children
const cacheDown = root => {
  byDepth(root, (parent, child) => {
    if (parent.id) {
      parent._cache.parents = parent._cache.parents || []
      child._cache.parents = parent._cache.parents.concat([parent.id])
    }
  })
}

// count parents
const cacheUp = root => {
  let nodes = byDepth(root, (parent, child) => {
    if (parent.id) {
      parent._cache.parents = parent._cache.parents || []
      parent._cache.children = parent._cache.children || []
      child._cache.parents = parent._cache.parents.concat([parent.id])
    }
  })
  let byId = {}
  nodes.forEach(node => {
    if (node.id) {
      byId[node.id] = node
    }
  })
  nodes.forEach(node => {
    node._cache.parents.forEach(id => {
      if (byId.hasOwnProperty(id)) {
        byId[id]._cache.children.push(node.id)
      }
    })
  })
  root._cache.children = Object.keys(byId)
}
export { cacheDown, cacheUp }
