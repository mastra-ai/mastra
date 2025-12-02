const toRoot = {
  // 'spencer's' -> 'spencer'
  'Possessive': (term) => {
    let str = term.machine || term.normal || term.text
    str = str.replace(/'s$/, '')
    return str
  },
  // 'drinks' -> 'drink'
  'Plural': (term, world) => {
    let str = term.machine || term.normal || term.text
    return world.methods.two.transform.noun.toSingular(str, world.model)
  },
  // ''
  'Copula': () => {
    return 'is'
  },
  // 'walked' -> 'walk'
  'PastTense': (term, world) => {
    let str = term.machine || term.normal || term.text
    return world.methods.two.transform.verb.toInfinitive(str, world.model, 'PastTense')
  },
  // 'walking' -> 'walk'
  'Gerund': (term, world) => {
    let str = term.machine || term.normal || term.text
    return world.methods.two.transform.verb.toInfinitive(str, world.model, 'Gerund')
  },
  // 'walks' -> 'walk'
  'PresentTense': (term, world) => {
    let str = term.machine || term.normal || term.text
    if (term.tags.has('Infinitive')) {
      return str
    }
    return world.methods.two.transform.verb.toInfinitive(str, world.model, 'PresentTense')
  },
  // 'quieter' -> 'quiet'
  'Comparative': (term, world) => {
    let str = term.machine || term.normal || term.text
    return world.methods.two.transform.adjective.fromComparative(str, world.model)
  },
  // 'quietest' -> 'quiet'
  'Superlative': (term, world) => {
    let str = term.machine || term.normal || term.text
    return world.methods.two.transform.adjective.fromSuperlative(str, world.model)
  },
  // 'suddenly' -> 'sudden'
  'Adverb': (term, world) => {
    const { fromAdverb } = world.methods.two.transform.adjective
    let str = term.machine || term.normal || term.text
    return fromAdverb(str)
  },
}

const getRoot = function (view) {
  const world = view.world
  const keys = Object.keys(toRoot)
  view.docs.forEach(terms => {
    for (let i = 0; i < terms.length; i += 1) {
      const term = terms[i]
      for (let k = 0; k < keys.length; k += 1) {
        if (term.tags.has(keys[k])) {
          const fn = toRoot[keys[k]]
          let root = fn(term, world)
          if (term.normal !== root) {
            term.root = root
          }
          break
        }
      }
    }
  })
}
export default getRoot