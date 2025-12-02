import parseVerb from '../verb.js'
import parseNoun from '../noun.js'

/*


*/

const factType = function (vb) {
  if (vb.has('#Imperative')) {
    return 'Instruction'
  }
  if (vb.has('#Copula')) {
    return 'Fact'
  }
  return 'Action'
}


const getFacts = function (s) {
  let facts = []
  let fact = { type: null }
  let prop = null
  let chunks = s.chunks()
  chunks.forEach(chunk => {
    if (chunk.isNoun().found) {
      let nounObj = parseNoun(chunk)
      // before our action, we are the subject
      if (!fact.action) {
        fact.subject = nounObj
      } else if (prop) {
        // walk [to] [the store]
        fact.modifiers = fact.modifiers || {}
        fact.modifiers[prop] = nounObj
      } else {
        // after our action, no property
        fact.obj = nounObj
      }
    } else if (chunk.isVerb().found) {
      // our second verb?
      if (fact.action) {
        facts.push(fact)
        fact = { type: null }
      }
      fact.type = factType(chunk)
      // if (fact.type === 'Action' || fact.type === 'Instruction') {
      fact.action = parseVerb(chunk)
      // }
    } else {
      //glue chunk
      prop = chunk.text('machine')
    }
  })
  if (fact.action) {
    facts.push(fact)
  }
  return facts
}
export default getFacts