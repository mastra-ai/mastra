import byDepth from '../crawl/crawl.js'
import c from '../lib/color.js'
const indent = '    '

const toText = function (json, color) {
  let arrow = '-> '
  if (color) {
    arrow = c.dim('→ ')
  }
  let txt = ''
  let rows = byDepth(json)
  rows.forEach((node, i) => {
    let label = node.id || ''
    if (color) {
      label = c.red(label)
    }
    if (i === 0 && !node.id) {
      return //skip empty root
    }
    let depth = node._cache.parents.length
    txt += indent.repeat(depth) + arrow + label + '\n'
  })
  return txt
}
export default toText
