import encoding from '../encoding.js'

const symbols = function (t) {
  //... process these lines
  const reSymbol = new RegExp('([0-9A-Z]+):([0-9A-Z]+)')
  for (let i = 0; i < t.nodes.length; i++) {
    const m = reSymbol.exec(t.nodes[i])
    if (!m) {
      t.symCount = i
      break
    }
    t.syms[encoding.fromAlphaCode(m[1])] = encoding.fromAlphaCode(m[2])
  }
  //remove from main node list
  t.nodes = t.nodes.slice(t.symCount, t.nodes.length)
}
export default symbols
