import hasPlural from './hasPlural.js'

const keep = { tags: true }

const nounToPlural = function (m, parsed) {
  // already plural?
  if (parsed.isPlural === true) {
    return m
  }
  // handle "steve's"
  if (parsed.root.has('#Possessive')) {
    parsed.root = parsed.root.possessives().strip()
  }
  // is a plural appropriate?
  if (!hasPlural(parsed.root)) {
    return m
  }
  const { methods, model } = m.world
  const { toPlural } = methods.two.transform.noun
  // inflect the root noun
  let str = parsed.root.text({ keepPunct: false })
  let plural = toPlural(str, model)
  m.match(parsed.root).replaceWith(plural, keep).tag('Plural', 'toPlural')
  // should we change the determiner/article?
  if (parsed.determiner.has('(a|an)')) {
    // 'a captain' -> 'the captains'
    // m.replace(parsed.determiner, 'the', keep)
    m.remove(parsed.determiner)
  }
  // should we change the following copula?
  let copula = parsed.root.after('not? #Adverb+? [#Copula]', 0)
  if (copula.found) {
    if (copula.has('is')) {
      m.replace(copula, 'are')
    } else if (copula.has('was')) {
      m.replace(copula, 'were')
    }
  }
  return m
}
export default nounToPlural
