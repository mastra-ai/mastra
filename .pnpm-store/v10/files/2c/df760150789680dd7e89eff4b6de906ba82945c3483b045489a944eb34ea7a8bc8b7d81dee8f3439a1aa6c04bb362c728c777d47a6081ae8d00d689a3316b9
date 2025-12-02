import consider from './find/01-consider.js'

// some rules are also good in reverse
const shareBackward = function (fwd, rev, opts) {
  let both = {}
  let pending = rev.slice(0)
  let finished = []
  let rules = Object.entries(fwd).reverse()
  rules.forEach(a => {
    let rule = { from: a[1], to: a[0] }
    if (!rule.to) {
      return
    }
    let result = consider(rule, rev, opts)
    // did it do okay?
    if (result.percent > opts.threshold) {
      // move it to 'both' rules
      both[rule.to] = rule.from
      delete fwd[rule.to]
      // update finished/pending lists
      pending = pending.filter(a => {
        if (result.clear.has(a[0])) {
          finished.push(a)
          return false
        }
        return true
      })
    }
  })
  return {
    fwd,
    both,
    revPairs: {
      pending,
      finished
    }
  }
}
export default shareBackward