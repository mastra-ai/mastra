import alias from './alias.js'
import normal from './normal/index.js'
import machine from './machine.js'
import freq from './freq.js'
import offset from './offset.js'
import index from './reindex.js'
import wordCount from './wordCount.js'

// cheat-method for a quick loop
const termLoop = function (view, fn) {
  let docs = view.docs
  for (let i = 0; i < docs.length; i += 1) {
    for (let t = 0; t < docs[i].length; t += 1) {
      fn(docs[i][t], view.world)
    }
  }
}

const methods = {
  alias: (view) => termLoop(view, alias),
  machine: (view) => termLoop(view, machine),
  normal: (view) => termLoop(view, normal),
  freq,
  offset,
  index,
  wordCount,
}
export default methods
