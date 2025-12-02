// scan-ahead to match multiple-word terms - 'jack rabbit'
const multiWord = function (terms, start_i, world) {
  const { model, methods } = world
  const setTag = methods.one.setTag
  const multi = model.one._multiCache || {}
  const { lexicon } = model.one || {}
  let t = terms[start_i]
  let word = t.machine || t.normal

  // found a word to scan-ahead on
  if (multi[word] !== undefined && terms[start_i + 1]) {
    let end = start_i + multi[word] - 1
    for (let i = end; i > start_i; i -= 1) {
      let words = terms.slice(start_i, i + 1)
      if (words.length <= 1) {
        return false
      }
      let str = words.map(term => term.machine || term.normal).join(' ')
      // lookup regular lexicon
      if (lexicon.hasOwnProperty(str) === true) {
        let tag = lexicon[str]
        setTag(words, tag, world, false, '1-multi-lexicon')
        // special case for phrasal-verbs - 2nd word is a #Particle
        if (tag && tag.length === 2 && (tag[0] === 'PhrasalVerb' || tag[1] === 'PhrasalVerb')) {
          setTag([words[1]], 'Particle', world, false, '1-phrasal-particle')
        }
        return true
      }
    }
    return false
  }
  return null
}
export default multiWord
