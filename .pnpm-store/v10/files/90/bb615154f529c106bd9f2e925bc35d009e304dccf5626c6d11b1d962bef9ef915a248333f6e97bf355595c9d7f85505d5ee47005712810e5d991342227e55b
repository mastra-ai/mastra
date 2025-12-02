import parseSymbols from './symbols.js'
import encoding from '../encoding.js'

// References are either absolute (symbol) or relative (1 - based)
const indexFromRef = function (trie, ref, index) {
  const dnode = encoding.fromAlphaCode(ref)
  if (dnode < trie.symCount) {
    return trie.syms[dnode]
  }
  return index + dnode + 1 - trie.symCount
}

const toArray = function (trie) {
  const all = []
  const crawl = (index, pref) => {
    let node = trie.nodes[index]
    if (node[0] === '!') {
      all.push(pref)
      node = node.slice(1) //ok, we tried. remove it.
    }
    const matches = node.split(/([A-Z0-9,]+)/g)
    for (let i = 0; i < matches.length; i += 2) {
      const str = matches[i]
      const ref = matches[i + 1]
      if (!str) {
        continue
      }
      const have = pref + str
      //branch's end
      if (ref === ',' || ref === undefined) {
        all.push(have)
        continue
      }
      const newIndex = indexFromRef(trie, ref, index)
      crawl(newIndex, have)
    }
  }
  crawl(0, '')
  return all
}

//PackedTrie - Trie traversal of the Trie packed-string representation.
const unpack = function (str) {
  const trie = {
    nodes: str.split(';'),
    syms: [],
    symCount: 0
  }
  //process symbols, if they have them
  if (str.match(':')) {
    parseSymbols(trie)
  }
  return toArray(trie)
}

export default unpack
