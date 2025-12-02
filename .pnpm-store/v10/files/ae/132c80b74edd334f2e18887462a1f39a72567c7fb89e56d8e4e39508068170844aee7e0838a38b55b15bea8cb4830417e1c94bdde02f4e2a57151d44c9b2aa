
//combine them with .topics() method
const find = function (n) {
  let r = this.clauses()
  // Find people, places, and organizations
  let m = r.people()
  m = m.concat(r.places())
  m = m.concat(r.organizations())
  m = m.not('(someone|man|woman|mother|brother|sister|father)')
  //return them to normal ordering
  m = m.sort('seq')
  // m = m.unique()
  m = m.getNth(n)
  return m
}

const api = function (View) {
  View.prototype.topics = find
}
export default api
