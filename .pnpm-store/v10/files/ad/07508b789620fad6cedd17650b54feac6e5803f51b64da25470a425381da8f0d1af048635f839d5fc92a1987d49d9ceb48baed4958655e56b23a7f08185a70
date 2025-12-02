import traverse from './traverse.js'

const unpack = function (str) {
  if (!str) {
    return {}
  }
  //turn the weird string into a key-value object again
  const obj = str.split('|').reduce((h, s) => {
    const arr = s.split('¦')
    h[arr[0]] = arr[1]
    return h
  }, {})
  const all = {}
  Object.keys(obj).forEach(function (cat) {
    const arr = traverse(obj[cat])
    //special case, for botched-boolean
    if (cat === 'true') {
      cat = true
    }
    for (let i = 0; i < arr.length; i++) {
      const k = arr[i]
      if (all.hasOwnProperty(k) === true) {
        if (Array.isArray(all[k]) === false) {
          all[k] = [all[k], cat]
        } else {
          all[k].push(cat)
        }
      } else {
        all[k] = cat
      }
    }
  })
  return all
}

export default unpack
