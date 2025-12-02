import Trie from './trie.js'

const isArray = function (input) {
  return Object.prototype.toString.call(input) === '[object Array]'
}

const handleFormats = function (input) {
  //null
  if (input === null || input === undefined) {
    return {}
  }
  //string
  if (typeof input === 'string') {
    return input.split(/ +/g).reduce(function (h, str) {
      h[str] = true
      return h
    }, {})
  }
  //array
  if (isArray(input)) {
    return input.reduce(function (h, str) {
      h[str] = true
      return h
    }, {})
  }
  //object
  return input
}

//turn an array into a compressed string
const pack = function (obj) {
  obj = handleFormats(obj)
  //pivot into categories:
  const flat = Object.keys(obj).reduce(function (h, k) {
    const val = obj[k]
    //array version-
    //put it in several buckets
    if (isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        h[val[i]] = h[val[i]] || []
        h[val[i]].push(k)
      }
      return h
    }
    //normal string/boolean version
    if (h.hasOwnProperty(val) === false) {
      //basically h[val]=[]  - support reserved words
      Object.defineProperty(h, val, {
        writable: true,
        enumerable: true,
        configurable: true,
        value: []
      })
    }
    h[val].push(k)
    return h
  }, {})
  //pack each into a compressed string
  Object.keys(flat).forEach(function (k) {
    const t = new Trie(flat[k])
    flat[k] = t.pack()
  })
  return Object.keys(flat)
    .map((k) => {
      return k + '¦' + flat[k]
    })
    .join('|')
}
export default pack
