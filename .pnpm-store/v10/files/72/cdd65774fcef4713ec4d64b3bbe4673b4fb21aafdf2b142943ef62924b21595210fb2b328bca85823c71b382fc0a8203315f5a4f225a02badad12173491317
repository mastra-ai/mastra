
const parseAdjective = function (chunk) {
  // let obj = chunk.adjectives().json()[0]
  return {
    chunk: 'Adjective',
    ptr: chunk.ptrs[0],
    root: chunk.text('normal'),
    desc: chunk.adjectives().out('array')
  }
}

export default parseAdjective