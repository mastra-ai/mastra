const prefix = /^(under|over|mis|re|un|dis|semi)-?/

const tagSwitch = function (terms, i, model) {
  const switches = model.two.switches
  let term = terms[i]
  if (switches.hasOwnProperty(term.normal)) {
    term.switch = switches[term.normal]
    return
  }
  // support 'restrike' -> 'strike'
  if (prefix.test(term.normal)) {
    let stem = term.normal.replace(prefix, '')
    if (stem.length > 3 && switches.hasOwnProperty(stem)) {
      term.switch = switches[stem]
    }
  }
}
export default tagSwitch