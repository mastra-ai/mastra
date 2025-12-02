import api from './api/index.js'
import compress from './api/buildTrie/compress.js'
import build from './api/buildTrie/index.js'

/** pre-compile a list of matches to lookup */
const lib = {
  /** turn an array or object into a compressed trie*/
  buildTrie: function (input) {
    const trie = build(input, this.world())
    return compress(trie)
  }
}
// add alias
lib.compile = lib.buildTrie

export default {
  api,
  lib
}
