import { isSet, isObject, isArray } from '../lib/_lib.js'
import byDepth from './crawl.js'

// recursive merge of objects
const mergeDeep = (props, parent) => {
  Object.keys(parent).forEach(k => {
    // merge sets
    if (isSet(parent[k])) {
      let set = props[k] || new Set()
      props[k] = new Set([...set, ...parent[k]])
      return
    }
    // merge an object
    if (isObject(parent[k])) {
      let obj = props[k] || {}
      props[k] = Object.assign({}, parent[k], obj)
      return
    }
    //  concat an array
    if (isArray(parent[k])) {
      props[k] = parent[k].concat(props[k] || [])
      return
    }

    // just overwrite it
    if (props[k] === undefined) {
      props[k] = parent[k]
    }
  })
  return props
}

const fillDown = root => {
  byDepth(root, (parent, child) => {
    child.props = mergeDeep(child.props, parent.props)
  })
}

export default fillDown

// console.log(mergeDeep({}, { cool: false }))
