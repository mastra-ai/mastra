const lastNoun = function (terms, i) {
  for (let n = i - 1; n >= 0; n -= 1) {
    if (
      terms[n].tags.has('Noun') ||
      terms[n].tags.has('Pronoun') ||
      terms[n].tags.has('Plural') ||
      terms[n].tags.has('Singular')
    ) {
      return terms[n]
    }
  }
  return null
}

//ain't -> are/is not
const apostropheT = function (terms, i) {
  if (terms[i].normal === "ain't" || terms[i].normal === 'aint') {
    // "ain't never" -> have never (?)
    if (terms[i + 1] && terms[i + 1].normal === 'never') {
      return ['have']
    }
    // we aint -> are not,   she aint -> is not
    let noun = lastNoun(terms, i)
    if (noun) {
      // plural/singular pronouns
      if (noun.normal === 'we' || noun.normal === 'they') {
        return ['are', 'not']
      }
      if (noun.normal === 'i') {
        return ['am', 'not']
      }
      // plural/singular tags
      if (noun.tags && noun.tags.has('Plural')) {
        return ['are', 'not']
      }
    }
    return ['is', 'not']
  }
  let before = terms[i].normal.replace(/n't/, '')
  return [before, 'not']
}

export default apostropheT
