import Histogram from './histogram.js'
import encoding from '../encoding.js'

const config = {
  NODE_SEP: ';',
  KEY_VAL: ':',
  STRING_SEP: ',',
  TERMINAL_PREFIX: '!',
  BASE: 36
}
// Return packed representation of Trie as a string.
// Return packed representation of Trie as a string.
//
// Each node of the Trie is output on a single line.
//
// For example Trie("the them there thesis this"):
// {
//    "th": {
//      "is": 1,
//      "e": {
//        "": 1,
//        "m": 1,
//        "re": 1,
//        "sis": 1
//      }
//    }
//  }
//
// Would be reperesented as:
//
// th0
// e0is
// !m,re,sis
//
// The line begins with a '!' iff it is a terminal node of the Trie.
// For each string property in a node, the string is listed, along
// with a (relative!) line number of the node that string references.
// Terminal strings (those without child node references) are
// separated by ',' characters.
const nodeLine = function (self, node) {
  let line = '',
    sep = ''
  if (self.isTerminal(node)) {
    line += config.TERMINAL_PREFIX
  }
  const props = self.nodeProps(node)
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    if (typeof node[prop] === 'number') {
      line += sep + prop
      sep = config.STRING_SEP
      continue
    }
    if (self.syms[node[prop]._n]) {
      line += sep + prop + self.syms[node[prop]._n]
      sep = ''
      continue
    }
    let ref = encoding.toAlphaCode(node._n - node[prop]._n - 1 + self.symCount)
    // Large reference to smaller string suffix -> duplicate suffix
    if (node[prop]._g && ref.length >= node[prop]._g.length && node[node[prop]._g] === 1) {
      ref = node[prop]._g
      line += sep + prop + ref
      sep = config.STRING_SEP
      continue
    }
    line += sep + prop + ref
    sep = ''
  }
  return line
}

const analyzeRefs = function (self, node) {
  if (self.visited(node)) {
    return
  }
  const props = self.nodeProps(node, true)
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    const ref = node._n - node[prop]._n - 1
    // Count the number of single-character relative refs
    if (ref < config.BASE) {
      self.histRel.add(ref)
    }
    // Count the number of characters saved by converting an absolute
    // reference to a one-character symbol.
    self.histAbs.add(node[prop]._n, encoding.toAlphaCode(ref).length - 1)
    analyzeRefs(self, node[prop])
  }
}

const symbolCount = function (self) {
  self.histAbs = self.histAbs.highest(config.BASE)
  const savings = []
  savings[-1] = 0
  let best = 0,
    sCount = 0
  const defSize = 3 + encoding.toAlphaCode(self.nodeCount).length
  for (let sym = 0; sym < config.BASE; sym++) {
    if (self.histAbs[sym] === undefined) {
      break
    }
    savings[sym] =
      self.histAbs[sym][1] -
      defSize -
      self.histRel.countOf(config.BASE - sym - 1) +
      savings[sym - 1]
    if (savings[sym] >= best) {
      best = savings[sym]
      sCount = sym + 1
    }
  }
  return sCount
}

const numberNodes = function (self, node) {
  // Topological sort into nodes array
  if (node._n !== undefined) {
    return
  }
  const props = self.nodeProps(node, true)
  for (let i = 0; i < props.length; i++) {
    numberNodes(self, node[props[i]]) //recursive
  }
  node._n = self.pos++
  self.nodes.unshift(node)
}

const pack = function (self) {
  self.nodes = []
  self.nodeCount = 0
  self.syms = {}
  self.symCount = 0
  self.pos = 0
  // Make sure we've combined all the common suffixes
  self.optimize()
  self.histAbs = new Histogram()
  self.histRel = new Histogram()
  numberNodes(self, self.root)
  self.nodeCount = self.nodes.length
  self.prepDFS()
  analyzeRefs(self, self.root)
  self.symCount = symbolCount(self)
  for (let sym = 0; sym < self.symCount; sym++) {
    self.syms[self.histAbs[sym][0]] = encoding.toAlphaCode(sym)
  }
  for (let i = 0; i < self.nodeCount; i++) {
    self.nodes[i] = nodeLine(self, self.nodes[i])
  }
  // Prepend symbols
  for (let sym = self.symCount - 1; sym >= 0; sym--) {
    self.nodes.unshift(
      encoding.toAlphaCode(sym) +
        config.KEY_VAL +
        encoding.toAlphaCode(self.nodeCount - self.histAbs[sym][0] - 1)
    )
  }
  return self.nodes.join(config.NODE_SEP)
}

export default pack
