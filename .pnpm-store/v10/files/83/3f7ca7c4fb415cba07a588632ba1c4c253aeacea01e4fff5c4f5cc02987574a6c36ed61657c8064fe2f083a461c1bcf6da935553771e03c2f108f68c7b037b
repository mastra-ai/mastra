import maybeMatch from './maybeMatch.js'

// tokenize first, then only tag sentences required
const lazyParse = function (input, reg) {
  let net = reg
  if (typeof reg === 'string') {
    net = this.buildNet([{ match: reg }])
  }
  let doc = this.tokenize(input)
  let m = maybeMatch(doc, net)
  if (m.found) {
    m.compute(['index', 'tagger'])
    return m.match(reg)
  }
  return doc.none()
}
export default lazyParse