import keyVal from './key-val.js'

const pack = function (obj) {
  let byVal = {}
  Object.keys(obj).forEach(k => {
    let val = obj[k]
    byVal[val] = byVal[val] || []
    byVal[val].push(k)
  })
  let out = []
  Object.keys(byVal).forEach(val => {
    out.push(`${val}:${byVal[val].join(',')}`)
  })
  return out.join('¦')
}

const packObj = function (obj = {}) {
  let tmp = {}
  Object.keys(obj).forEach(k => {
    let val = keyVal(k, obj[k])// compress any shared prefix
    tmp[k] = val
  })
  return pack(tmp)
}

const compress = function (model) {
  let out = {
    fwd: packObj(model.fwd),
    both: packObj(model.both),
    rev: packObj(model.rev),
    ex: packObj(model.ex),
  }
  return out
}
export default compress


// let model = {
//   fwd: {
//     foo: 'food',
//     bar: 'bard',
//     cool: 'nice'
//   }
// }
// console.log(compress(model))