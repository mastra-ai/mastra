const keep = { tags: true }

const nounToSingular = function (m, parsed) {
  // already singular?
  if (parsed.isPlural === false) {
    return m
  }
  const { methods, model } = m.world
  const { toSingular } = methods.two.transform.noun
  // inflect the root noun
  let str = parsed.root.text('normal')
  let single = toSingular(str, model)
  m.replace(parsed.root, single, keep).tag('Singular', 'toPlural')
  // should we change the determiner/article?
  // m.debug()
  return m
}
export default nounToSingular
