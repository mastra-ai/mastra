// quick check if this tag will require any untagging
const canBe = function (term, tag, tagSet) {
  if (!tagSet.hasOwnProperty(tag)) {
    return true // everything can be an unknown tag
  }
  let not = tagSet[tag].not || []
  for (let i = 0; i < not.length; i += 1) {
    if (term.tags.has(not[i])) {
      return false
    }
  }
  return true
}
export default canBe
