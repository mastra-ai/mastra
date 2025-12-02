import fns from './fns.js'
import pack from './pack.js'
const NOT_ALLOWED = new RegExp('[0-9A-Z,;!:|¦]') //characters banned from entering the trie
// reserved propery names
const internal = {
  _d: true,
  _v: true,
  _c: true,
  _g: true,
  _n: true,
}

const methods = {
  // Insert words from one big string, or from an array.
  insertWords: function (words) {
    if (words === undefined) {
      return
    }
    if (typeof words === 'string') {
      words = words.split(/[^a-zA-Z]+/)
    }
    for (let i = 0; i < words.length; i++) {
      words[i] = words[i].toLowerCase()
    }
    fns.unique(words)
    for (let i = 0; i < words.length; i++) {
      if (words[i].match(NOT_ALLOWED) === null) {
        this.insert(words[i])
      }
    }
  },

  insert: function (word) {
    this._insert(word, this.root)
    const lastWord = this.lastWord
    this.lastWord = word

    const prefix = fns.commonPrefix(word, lastWord)
    if (prefix === lastWord) {
      return
    }

    const freeze = this.uniqueNode(lastWord, word, this.root)
    if (freeze) {
      this.combineSuffixNode(freeze)
    }
  },

  _insert: function (word, node) {
    let prefix, next

    // Duplicate word entry - ignore
    if (word.length === 0) {
      return
    }

    // Do any existing props share a common prefix?
    const keys = Object.keys(node)
    for (let i = 0; i < keys.length; i++) {
      const prop = keys[i]
      prefix = fns.commonPrefix(word, prop)
      if (prefix.length === 0) {
        continue
      }
      // Prop is a proper prefix - recurse to child node
      if (prop === prefix && typeof node[prop] === 'object') {
        this._insert(word.slice(prefix.length), node[prop])
        return
      }
      // Duplicate terminal string - ignore
      if (prop === word && typeof node[prop] === 'number') {
        return
      }
      next = {}
      next[prop.slice(prefix.length)] = node[prop]
      this.addTerminal(next, word = word.slice(prefix.length))
      delete node[prop]
      node[prefix] = next
      this.wordCount++
      return
    }

    // No shared prefix.  Enter the word here as a terminal string.
    this.addTerminal(node, word)
    this.wordCount++
  },

  // Add a terminal string to node.
  // If 2 characters or less, just add with value == 1.
  // If more than 2 characters, point to shared node
  // Note - don't prematurely share suffixes - these
  // terminals may become split and joined with other
  // nodes in this part of the tree.
  addTerminal: function (node, prop) {
    if (prop.length <= 1) {
      node[prop] = 1
      return
    }
    const next = {}
    node[prop[0]] = next
    this.addTerminal(next, prop.slice(1))
  },

  // Well ordered list of properties in a node (string or object properties)
  // Use nodesOnly==true to return only properties of child nodes (not
  // terminal strings.
  nodeProps: function (node, nodesOnly) {
    const props = []
    for (const prop in node) {
      // is it a usuable prop, or a special reserved one?
      if (prop !== '' && !internal.hasOwnProperty(prop)) {
        if (!nodesOnly || typeof node[prop] === 'object') {
          props.push(prop)
        }
      }
    }
    props.sort()
    return props
  },

  optimize: function () {
    this.combineSuffixNode(this.root)
    this.prepDFS()
    this.countDegree(this.root)
    this.prepDFS()
    this.collapseChains(this.root)
  },

  // Convert Trie to a DAWG by sharing identical nodes
  combineSuffixNode: function (node) {
    // Frozen node - can't change.
    if (node._c) {
      return node
    }
    // Make sure all children are combined and generate unique node
    // signature for this node.
    let sig = []
    if (this.isTerminal(node)) {
      sig.push('!')
    }
    const props = this.nodeProps(node)
    for (let i = 0; i < props.length; i++) {
      const prop = props[i]
      if (typeof node[prop] === 'object') {
        node[prop] = this.combineSuffixNode(node[prop])
        sig.push(prop)
        sig.push(node[prop]._c)
      } else {
        sig.push(prop)
      }
    }
    sig = sig.join('-')

    const shared = this.suffixes[sig]
    if (shared) {
      return shared
    }
    this.suffixes[sig] = node
    node._c = this.cNext++
    return node
  },

  prepDFS: function () {
    this.vCur++
  },

  visited: function (node) {
    if (node._v === this.vCur) {
      return true
    }
    node._v = this.vCur
    return false
  },

  countDegree: function (node) {
    if (node._d === undefined) {
      node._d = 0
    }
    node._d++
    if (this.visited(node)) {
      return
    }
    const props = this.nodeProps(node, true)
    for (let i = 0; i < props.length; i++) {
      this.countDegree(node[props[i]])
    }
  },

  // Remove intermediate singleton nodes by hoisting into their parent
  collapseChains: function (node) {
    let prop, child, i
    if (this.visited(node)) {
      return
    }
    const props = this.nodeProps(node)
    for (i = 0; i < props.length; i++) {
      prop = props[i]
      child = node[prop]
      if (typeof child !== 'object') {
        continue
      }
      this.collapseChains(child)
      // Hoist the singleton child's single property to the parent
      if (child._g !== undefined && (child._d === 1 || child._g.length === 1)) {
        delete node[prop]
        prop += child._g
        node[prop] = child[child._g]
      }
    }
    // Identify singleton nodes
    if (props.length === 1 && !this.isTerminal(node)) {
      node._g = prop
    }
  },

  isTerminal: function (node) {
    return !!node['']
  },

  // Find highest node in Trie that is on the path to word
  // and that is NOT on the path to other.
  uniqueNode: function (word, other, node) {
    const props = this.nodeProps(node, true)
    for (let i = 0; i < props.length; i++) {
      const prop = props[i]
      if (prop === word.slice(0, prop.length)) {
        if (prop !== other.slice(0, prop.length)) {
          return node[prop]
        }
        return this.uniqueNode(word.slice(prop.length), other.slice(prop.length), node[prop])
      }
    }
    return undefined
  },

  pack: function () {
    return pack(this)
  }
}
export default methods
