import prepare from './00-prep.js'
import findRules from './01-findRules.js'
import shareBackward from './02-share-back.js'

const defaults = {
  threshold: 80,
  min: 0
}
const swap = (a) => [a[1], a[0]]

const learn = function (pairs, opts = {}) {
  opts = Object.assign({}, defaults, opts)
  let ex = {}
  let rev = {}
  pairs = prepare(pairs, ex)
  // get forward-dir rules
  let { rules, pending, finished } = findRules(pairs, [], opts)
  // move some to both
  let { fwd, both, revPairs } = shareBackward(rules, pairs.map(swap), opts)
  // generate remaining reverse-dir rules
  let pendingBkwd = []
  if (opts.reverse !== false) {
    // console.log(revPairs.pending)
    let bkwd = findRules(revPairs.pending, revPairs.finished, opts)
    pendingBkwd = bkwd.pending
    rev = bkwd.rules
  }
  // console.log(pending.length, 'pending fwd')
  // console.log(pendingBkwd.length, 'pending Bkwd')
  // add anything remaining as an exception
  if (opts.min <= 1) {
    pending.forEach(arr => {
      ex[arr[0]] = arr[1]
    })
    pendingBkwd.forEach(arr => {
      ex[arr[1]] = arr[0]
    })
  }
  return {
    fwd,
    both,
    rev,
    ex,
  }
}
export default learn