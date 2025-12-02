// is this tag consistent with the tags they already have?
const canBe = function (terms, tag, model) {
  let tagSet = model.one.tagSet
  if (!tagSet.hasOwnProperty(tag)) {
    return true
  }
  let not = tagSet[tag].not || []
  for (let i = 0; i < terms.length; i += 1) {
    let term = terms[i]
    for (let k = 0; k < not.length; k += 1) {
      if (term.tags.has(not[k]) === true) {
        return false //found a tag conflict - bail!
      }
    }
  }
  return true
}
export default canBe
