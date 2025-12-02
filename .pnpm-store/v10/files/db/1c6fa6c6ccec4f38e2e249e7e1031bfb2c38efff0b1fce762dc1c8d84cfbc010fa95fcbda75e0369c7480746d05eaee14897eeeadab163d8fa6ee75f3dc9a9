// if a clause starts with these, it's not a main clause
const subordinate = `(after|although|as|because|before|if|since|than|that|though|when|whenever|where|whereas|wherever|whether|while|why|unless|until|once)`
const relative = `(that|which|whichever|who|whoever|whom|whose|whomever)`

//try to remove secondary clauses
const mainClause = function (s) {
  let m = s
  if (m.length === 1) {
    return m
  }
  // if there's no verb, it's dependent
  m = m.if('#Verb')
  if (m.length === 1) {
    return m
  }
  // this is a signal for subordinate-clauses
  m = m.ifNo(subordinate)
  m = m.ifNo('^even (if|though)')
  m = m.ifNo('^so that')
  m = m.ifNo('^rather than')
  m = m.ifNo('^provided that')
  if (m.length === 1) {
    return m
  }
  // relative clauses
  m = m.ifNo(relative)
  if (m.length === 1) {
    return m
  }

  // check for subordinating conjunctions -- must be at the beginning of the clause
  m = m.ifNo('(^despite|^during|^before|^through|^throughout)')
  if (m.length === 1) {
    return m
  }

  // check for clauses beginning with Gerund ("Taking ..., ...")
  m = m.ifNo('^#Gerund')
  if (m.length === 1) {
    return m
  }

  // did we go too far?
  if (m.length === 0) {
    m = s
  }
  // choose the first one?
  return m.eq(0)
}
export default mainClause
