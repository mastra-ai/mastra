// chop-off tail of redundant vals at end of array
const truncate = (list, val) => {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i] !== val) {
      list = list.slice(0, i + 1)
      return list
    }
  }
  return list
}

// prune trie a bit
const compress = function (trie) {
  trie.goNext = trie.goNext.map(o => {
    if (Object.keys(o).length === 0) {
      return undefined
    }
    return o
  })
  // chop-off tail of undefined vals in goNext array
  trie.goNext = truncate(trie.goNext, undefined)
  // chop-off tail of zeros in failTo array
  trie.failTo = truncate(trie.failTo, 0)
  // chop-off tail of nulls in endAs array
  trie.endAs = truncate(trie.endAs, null)
  return trie
}
export default compress