const boringTags = new Set(['Auxiliary', 'Possessive'])

const sortByKids = function (tags, tagSet) {
  tags = tags.sort((a, b) => {
    // (unknown tags are interesting)
    if (boringTags.has(a) || !tagSet.hasOwnProperty(b)) {
      return 1
    }
    if (boringTags.has(b) || !tagSet.hasOwnProperty(a)) {
      return -1
    }
    let kids = tagSet[a].children || []
    let aKids = kids.length
    kids = tagSet[b].children || []
    let bKids = kids.length
    return aKids - bKids
  })
  return tags
}

const tagRank = function (view) {
  const { document, world } = view
  const tagSet = world.model.one.tagSet
  document.forEach(terms => {
    terms.forEach(term => {
      let tags = Array.from(term.tags)
      term.tagRank = sortByKids(tags, tagSet)
    })
  })
}
export default tagRank
