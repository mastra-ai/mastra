import toInfinitive from './toInfinitive/index.js'
import conjugate from './conjugate/index.js'

const all = function (str, model) {
  let res = conjugate(str, model)
  delete res.FutureTense
  return Object.values(res).filter(s => s)
}
export default {
  toInfinitive, conjugate, all
}
