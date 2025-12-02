const prefix = /^([0-9]+)/

const toObject = function (txt) {
  let obj = {}
  txt.split('¦').forEach(str => {
    let [key, vals] = str.split(':')
    vals = (vals || '').split(',')
    vals.forEach(val => {
      obj[val] = key
    })
  })
  return obj
}

const growObject = function (key = '', val = '') {
  val = String(val)
  let m = val.match(prefix)
  if (m === null) {
    return val
  }
  let num = Number(m[1]) || 0
  let pre = key.substring(0, num)
  let full = pre + val.replace(prefix, '')
  return full
}

const unpackOne = function (str) {
  let obj = toObject(str)
  return Object.keys(obj).reduce((h, k) => {
    h[k] = growObject(k, obj[k])
    return h
  }, {})
}

const uncompress = function (model = {}) {
  if (typeof model === 'string') {
    model = JSON.parse(model)
  }
  model.fwd = unpackOne(model.fwd || '')
  model.both = unpackOne(model.both || '')
  model.rev = unpackOne(model.rev || '')
  model.ex = unpackOne(model.ex || '')
  return model
}
export default uncompress
