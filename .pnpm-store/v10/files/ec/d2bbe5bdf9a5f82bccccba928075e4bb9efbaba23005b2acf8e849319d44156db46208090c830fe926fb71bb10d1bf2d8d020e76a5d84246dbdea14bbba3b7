import methods from './methods.js'
/*
 A JavaScript implementation of a Trie search datastructure.
Each node of the Trie is an Object that can contain the following properties:
      '' - If present (with value == 1), the node is a Terminal Node - the prefix
          leading to this node is a word in the dictionary.
      numeric properties (value == 1) - the property name is a terminal string
          so that the prefix + string is a word in the dictionary.
      Object properties - the property name is one or more characters to be consumed
          from the prefix of the test string, with the remainder to be checked in
          the child node.
      '_c': A unique name for the node (starting from 1), used in combining Suffixes.
      '_n': Created when packing the Trie, the sequential node number
          (in pre-order traversal).
      '_d': The number of times a node is shared (it's in-degree from other nodes).
      '_v': Visited in DFS.
      '_g': For singleton nodes, the name of it's single property.
 */
const Trie = function (words) {
  this.root = {}
  this.lastWord = ''
  this.suffixes = {}
  this.suffixCounts = {}
  this.cNext = 1
  this.wordCount = 0
  this.insertWords(words)
  this.vCur = 0
}

Object.keys(methods).forEach(function (k) {
  Trie.prototype[k] = methods[k]
})

export default Trie
