// remove this tag, and its children, from these terms
const unTag = function (terms, tag, tagSet) {
  tag = tag.trim().replace(/^#/, '')
  for (let i = 0; i < terms.length; i += 1) {
    let term = terms[i]
    // don't untag anything if term is frozen
    if (term.frozen === true) {
      continue
    }
    // support clearing all tags, with '*'
    if (tag === '*') {
      term.tags.clear()
      continue
    }
    // for known tags, do logical dependencies first
    let known = tagSet[tag]
    // removing #Verb should also remove #PastTense
    if (known && known.children.length > 0) {
      for (let o = 0; o < known.children.length; o += 1) {
        term.tags.delete(known.children[o])
      }
    }
    term.tags.delete(tag)
  }
}
export default unTag
