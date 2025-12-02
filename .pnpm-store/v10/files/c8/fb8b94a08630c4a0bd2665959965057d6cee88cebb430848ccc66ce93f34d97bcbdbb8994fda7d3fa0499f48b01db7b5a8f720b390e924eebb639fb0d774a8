// filter-down list of maybe-matches
const localTrim = function (maybeList, docCache) {
  return maybeList.map((list, n) => {
    let haves = docCache[n]
    // ensure all stated-needs of the match are met
    list = list.filter(obj => {
      return obj.needs.every(need => haves.has(need))
    })
    // ensure nothing matches in our 'ifNo' property
    list = list.filter(obj => {
      if (obj.ifNo !== undefined && obj.ifNo.some(no => haves.has(no)) === true) {
        return false
      }
      return true
    })
    // ensure atleast one(?) of the wants is found
    list = list.filter(obj => {
      if (obj.wants.length === 0) {
        return true
      }
      // ensure there's one cache-hit
      let found = obj.wants.filter(str => haves.has(str)).length
      return found >= obj.minWant
    })
    return list
  })
}
export default localTrim
