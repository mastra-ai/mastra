const flipObj = function (obj) {
  return Object.entries(obj).reduce((h, a) => {
    h[a[1]] = a[0]
    return h
  }, {})
}

const reverse = function (model = {}) {
  return {
    reversed: true,
    // keep these two
    both: flipObj(model.both),
    ex: flipObj(model.ex),
    // swap this one in
    fwd: model.rev || {}
  }
}
export default reverse