const verbType = function (terms, i, model, world) {
  const setTag = world.methods.one.setTag
  const term = terms[i]
  const types = ['PastTense', 'PresentTense', 'Auxiliary', 'Modal', 'Particle']
  if (term.tags.has('Verb')) {
    let type = types.find(typ => term.tags.has(typ))
    // is it a bare #Verb tag?
    if (!type) {
      setTag([term], 'Infinitive', world, null, `2-verb-type''`)
    }
  }
}
export default verbType