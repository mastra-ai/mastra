import grad from 'grad-school'
import fmt from './02-fmt.js'
import validate from './01-validate.js'

// 'fill-down' parent logic inference
const compute = function (allTags) {
  // setup graph-lib format
  const flatList = Object.keys(allTags).map(k => {
    let o = allTags[k]
    const props = { not: new Set(o.not), also: o.also, is: o.is, novel: o.novel }
    return { id: k, parent: o.is, props, children: [] }
  })
  const graph = grad(flatList).cache().fillDown()
  return graph.out('array')
}

const fromUser = function (tags) {
  Object.keys(tags).forEach(k => {
    tags[k] = Object.assign({}, tags[k])
    tags[k].novel = true
  })
  return tags
}

const addTags = function (tags, already) {
  // are these tags internal ones, or user-generated?
  if (Object.keys(already).length > 0) {
    tags = fromUser(tags)
  }
  tags = validate(tags, already)

  let allTags = Object.assign({}, already, tags)
  // do some basic setting-up
  // 'fill-down' parent logic
  const nodes = compute(allTags)
  // convert it to our final format
  const res = fmt(nodes)
  return res
}
export default addTags
