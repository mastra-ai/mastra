import rules from './_rules.js'
const invertObj = function (obj) {
  return Object.keys(obj).reduce((h, k) => {
    h[obj[k]] = k
    return h
  }, {})
}

const toSingular = function (str, model) {
  const { irregularPlurals } = model.two
  let invert = invertObj(irregularPlurals) //(not very efficient)
  // check irregulars list
  if (invert.hasOwnProperty(str)) {
    return invert[str]
  }
  // go through our regexes
  for (let i = 0; i < rules.length; i++) {
    if (rules[i][0].test(str) === true) {
      // console.log(rules[i])
      str = str.replace(rules[i][0], rules[i][1])
      return str
    }
  }
  return str
}
export default toSingular
