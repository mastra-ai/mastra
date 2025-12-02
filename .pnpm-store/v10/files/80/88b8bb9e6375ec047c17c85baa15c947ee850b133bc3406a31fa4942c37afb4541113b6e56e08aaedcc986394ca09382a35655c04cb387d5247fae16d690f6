import toPlural from './toPlural/index.js'
import toSingular from './toSingular/index.js'

const all = function (str, model) {
  let arr = [str]
  let p = toPlural(str, model)
  if (p !== str) {
    arr.push(p)
  }
  let s = toSingular(str, model)
  if (s !== str) {
    arr.push(s)
  }
  return arr
}

export default { toPlural, toSingular, all }
