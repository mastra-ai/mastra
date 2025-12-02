import splitAll from './split.js'

const subtract = function (refs, not) {
  let res = []
  let found = splitAll(refs, not)
  found.forEach(o => {
    if (o.passthrough) {
      res.push(o.passthrough)
    }
    if (o.before) {
      res.push(o.before)
    }
    if (o.after) {
      res.push(o.after)
    }
  })
  return res
}
export default subtract

// console.log(subtract([[0, 0, 2]], [[0, 0, 1]]))
// console.log(subtract([[0, 0, 2]], [[0, 1, 2]]))
