const isTitleCase = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str)

const isOrg = function (term, i, yelling) {
  if (!term) {
    return false
  }
  if (term.tags.has('FirstName') || term.tags.has('Place')) {
    return false
  }
  if (term.tags.has('ProperNoun') || term.tags.has('Organization') || term.tags.has('Acronym')) {
    return true
  }
  // allow anything titlecased to be an org
  if (!yelling && isTitleCase(term.text)) {
    // only tag a titlecased first-word, if it checks-out
    if (i === 0) {
      return term.tags.has('Singular')
    }
    return true
  }
  return false
}

const tagOrgs = function (terms, i, world, yelling) {
  const orgWords = world.model.two.orgWords
  const setTag = world.methods.one.setTag
  let term = terms[i]
  let str = term.machine || term.normal
  if (orgWords[str] === true && isOrg(terms[i - 1], i - 1, yelling)) {
    setTag([terms[i]], 'Organization', world, null, '3-[org-word]')
    // loop backwards, tag organization-like things
    for (let t = i; t >= 0; t -= 1) {
      if (isOrg(terms[t], t, yelling)) {
        setTag([terms[t]], 'Organization', world, null, '3-[org-word]')
      } else {
        break
      }
    }
  }
  return null
}
export default tagOrgs