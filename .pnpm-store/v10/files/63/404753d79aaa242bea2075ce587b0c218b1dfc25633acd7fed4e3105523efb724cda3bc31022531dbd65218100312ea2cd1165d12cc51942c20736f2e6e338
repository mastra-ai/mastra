
const parseNoun = function (chunk) {
  let root = chunk.match('#Noun').not('#Demonym').text('root')
  let obj = chunk.nouns().json()[0].noun
  obj.chunk = 'Noun'
  obj.ptr = chunk.ptrs[0]
  obj.root = root
  return obj
}

export default parseNoun