
const toArr = function (input) {
  if (!input) {
    return []
  }
  if (typeof input === 'string') {
    return [input]
  }
  return input
}

const addImplied = function (tags, already) {
  Object.keys(tags).forEach(k => {
    // support deprecated fmts
    if (tags[k].isA) {
      tags[k].is = tags[k].isA
    }
    if (tags[k].notA) {
      tags[k].not = tags[k].notA
    }
    // add any implicit 'is' tags
    if (tags[k].is && typeof tags[k].is === 'string') {
      if (!already.hasOwnProperty(tags[k].is) && !tags.hasOwnProperty(tags[k].is)) {
        tags[tags[k].is] = {}
      }
    }
    // add any implicit 'not' tags
    if (tags[k].not && typeof tags[k].not === 'string' && !tags.hasOwnProperty(tags[k].not)) {
      if (!already.hasOwnProperty(tags[k].not) && !tags.hasOwnProperty(tags[k].not)) {
        tags[tags[k].not] = {}
      }
    }
  })
  return tags
}


const validate = function (tags, already) {

  tags = addImplied(tags, already)

  // property validation
  Object.keys(tags).forEach(k => {
    tags[k].children = toArr(tags[k].children)
    tags[k].not = toArr(tags[k].not)
  })
  // not links are bi-directional
  // add any incoming not tags
  Object.keys(tags).forEach(k => {
    let nots = tags[k].not || []
    nots.forEach(no => {
      if (tags[no] && tags[no].not) {
        tags[no].not.push(k)
      }
    })
  })
  return tags
}
export default validate