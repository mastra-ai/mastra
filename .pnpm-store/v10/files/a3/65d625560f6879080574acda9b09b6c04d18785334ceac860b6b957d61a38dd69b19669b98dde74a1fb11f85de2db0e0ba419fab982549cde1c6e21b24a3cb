// [a, b, a1, b1]
// const getBreadth = root => {
//   let list = []
//   let queue = [root]
//   while (queue.length > 0) {
//     // get first
//     let node = queue.shift()
//     // add to list
//     list.push(node)
//     // add kids to queue
//     node.children.forEach(n => {
//       // n._cache.parents = node._cache.parents + 1
//       queue.push(n)
//     })
//   }
//   return list
// }

// [a, a1, b, b1]
const byDepth = (root, fn) => {
  let list = []
  let queue = [root]
  while (queue.length > 0) {
    // get first
    let node = queue.pop()
    // add to list
    list.push(node)
    // add kids to queue
    if (node.children) {
      node.children.forEach(child => {
        if (fn) {
          fn(node, child)
        }
        queue.push(child)
      })
    }
  }
  return list
}

export default byDepth
