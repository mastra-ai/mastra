import out from './out/index.js'
import { normalize, getByPointer } from './lib/_lib.js'
import byDepth from './crawl/crawl.js'
import { isArray } from './lib/_lib.js'
import { cacheDown, cacheUp } from './crawl/cache.js'
import fillDown from './crawl/fillDown.js'
const hasSlash = /\//
import validate from './input/_validate.js'

class View {
  constructor(json = {}) {
    Object.defineProperty(this, 'json', {
      enumerable: false,
      value: json,
      writable: true,
    })
  }
  get children() {
    return this.json.children
  }
  get id() {
    return this.json.id
  }
  get found() {
    return this.json.id || this.json.children.length > 0
  }
  props(input = {}) {
    let props = this.json.props || {}
    if (typeof input === 'string') {
      props[input] = true
    }
    this.json.props = Object.assign(props, input)
    return this
  }
  get(id) {
    id = normalize(id)
    if (!hasSlash.test(id)) {
      // lookup by label name
      let found = this.json.children.find(obj => obj.id === id)
      return new View(found)
    }
    let obj = getByPointer(this.json, id) || validate({})
    return new View(obj)
  }
  add(id, props = {}) {
    if (isArray(id)) {
      id.forEach(str => this.add(normalize(str), props))
      return this
    }
    id = normalize(id)
    let node = validate({ id, props })
    this.json.children.push(node)
    return new View(node)
  }
  remove(id) {
    id = normalize(id)
    this.json.children = this.json.children.filter(obj => obj.id !== id)
    return this
  }
  nodes() {
    let nodes = byDepth(this.json)
    return nodes.map(node => {
      node = Object.assign({}, node)
      delete node.children
      return node
    })
  }
  cache() {
    cacheUp(this.json)
    return this
  }
  list() {
    return byDepth(this.json)
  }
  fillDown() {
    fillDown(this.json)
    return this
  }
  depth() {
    cacheDown(this.json)
    let nodes = byDepth(this.json)
    let max = nodes.length > 1 ? 1 : 0
    // count # of parents
    nodes.forEach(node => {
      if (node._cache.parents.length === 0) {
        return
      }
      let count = node._cache.parents.length + 1
      if (count > max) {
        max = count
      }
    })
    return max
  }
  out(fmt) {
    cacheDown(this.json)
    return out(this.json, fmt)
  }
  debug() {
    cacheDown(this.json)
    out(this.json, 'debug')
    return this
  }
}

export default View
