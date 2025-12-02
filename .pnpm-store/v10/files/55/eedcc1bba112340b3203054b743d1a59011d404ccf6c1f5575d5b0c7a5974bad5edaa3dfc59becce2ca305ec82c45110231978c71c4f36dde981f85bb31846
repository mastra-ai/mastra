/** insert new words/phrases into the lexicon */
const addWords = function (words, isFrozen = false) {
  const world = this.world()
  const { methods, model } = world
  if (!words) {
    return
  }
  // normalize tag vals
  Object.keys(words).forEach(k => {
    if (typeof words[k] === 'string' && words[k].startsWith('#')) {
      words[k] = words[k].replace(/^#/, '')
    }
  })
  // these words go into a seperate lexicon
  if (isFrozen === true) {
    let { lex, _multi } = methods.one.expandLexicon(words, world)
    Object.assign(model.one._multiCache, _multi)
    Object.assign(model.one.frozenLex, lex)
    return
  }
  // add some words to our lexicon
  if (methods.two.expandLexicon) {
    // do fancy ./two version
    let { lex, _multi } = methods.two.expandLexicon(words, world)
    Object.assign(model.one.lexicon, lex)
    Object.assign(model.one._multiCache, _multi)
  }
  // do basic ./one version
  let { lex, _multi } = methods.one.expandLexicon(words, world)
  Object.assign(model.one.lexicon, lex)
  Object.assign(model.one._multiCache, _multi)
}

export default { addWords }
