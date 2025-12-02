const isObject = val => {
  return Object.prototype.toString.call(val) === '[object Object]'
}

const isArray = function (arr) {
  return Object.prototype.toString.call(arr) === '[object Array]'
}

// internal Term objects are slightly different
const fromJson = function (json) {
  return json.map(o => {
    return o.terms.map(term => {
      if (isArray(term.tags)) {
        term.tags = new Set(term.tags)
      }
      return term
    })
  })
}

// interpret an array-of-arrays
const preTokenized = function (arr) {
  return arr.map((a) => {
    return a.map(str => {
      return {
        text: str,
        normal: str,//cleanup
        pre: '',
        post: ' ',
        tags: new Set()
      }
    })
  })
}

const inputs = function (input, View, world) {
  const { methods } = world
  let doc = new View([])
  doc.world = world
  // support a number
  if (typeof input === 'number') {
    input = String(input)
  }
  // return empty doc
  if (!input) {
    return doc
  }
  // parse a string
  if (typeof input === 'string') {
    let document = methods.one.tokenize.fromString(input, world)
    return new View(document)
  }
  // handle compromise View
  if (isObject(input) && input.isView) {
    return new View(input.document, input.ptrs)
  }
  // handle json input
  if (isArray(input)) {
    // pre-tokenized array-of-arrays 
    if (isArray(input[0])) {
      let document = preTokenized(input)
      return new View(document)
    }
    // handle json output
    let document = fromJson(input)
    return new View(document)
  }
  return doc
}
export default inputs