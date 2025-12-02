const beside = {
  there: true, //go there
  this: true, //try this
  it: true, //do it
  him: true,
  her: true,
  us: true, //tell us
}

// '[place] tea bags in hot water'
const imperative = function (terms, world) {
  const setTag = world.methods.one.setTag
  const multiWords = world.model.one._multiCache || {}
  let t = terms[0]
  let isRight = t.switch === 'Noun|Verb' || t.tags.has('Infinitive')
  if (isRight && terms.length >= 2) {
    // ensure rest of sentence is ok
    if (terms.length < 4 && !beside[terms[1].normal]) {
      return
    }
    // avoid multi-noun words like '[board] room'
    if (!t.tags.has('PhrasalVerb') && multiWords.hasOwnProperty(t.normal)) {
      return
    }
    // is the next word a noun? - 'compile information ..'
    let nextNoun = terms[1].tags.has('Noun') || terms[1].tags.has('Determiner')
    if (nextNoun) {
      // ensure no soon-verb -  'waste materials are ..'
      let soonVerb = terms.slice(1, 3).some(term => term.tags.has('Verb'))
      if (!soonVerb || t.tags.has('#PhrasalVerb')) {
        setTag([t], 'Imperative', world, null, '3-[imperative]')
      }
    }
  }
}
export default imperative
