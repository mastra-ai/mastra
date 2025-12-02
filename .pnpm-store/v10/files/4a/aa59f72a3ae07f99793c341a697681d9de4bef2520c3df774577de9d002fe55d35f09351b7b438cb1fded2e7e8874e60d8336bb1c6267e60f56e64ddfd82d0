const range = 20 // look 20 words in either direction

const chooseSense = function (terms, i, sense) {
  if (!sense) {
    return null
  }
  const words = sense.words
  for (let n = 1; n < range; n += 1) {
    // look left by n
    if (terms[i - n] && words[terms[i - n].normal]) {
      // console.log(` <- '${words[terms[i - n].normal]}'`)
      return words[terms[i - n].normal]
    }
    // look right by n
    if (terms[i + n] && words[terms[i + n].normal]) {
      // console.log(` -> '${words[terms[i + n].normal]}'`)
      return words[terms[i + n].normal]
    }
  }
  return sense.fallback || null
}

const getSense = function (view) {
  const { world, doc } = view
  const { senses } = world.model.four
  const terms = doc.termList()
  for (let i = 0; i < terms.length; i += 1) {
    const term = terms[i]
    const str = term.normal
    if (senses.hasOwnProperty(str) === true) {
      // get appropriate sense for the term's tag
      const sense = senses[str].find(obj => term.tags.has(obj.tag))
      const name = chooseSense(terms, i, sense)
      if (name !== null) {
        term.sense = `${term.normal}/${name}`
      }
    }
  }
}
export default getSense
