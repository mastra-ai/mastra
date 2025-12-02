import { findChained } from './lib.js'

// only filter if we know a gender
// ambiguous names like 'jamie smith' will refer to either he or she
const byGender = function (ppl, gender) {
  if (gender === 'm') {
    return ppl.filter(m => !m.presumedFemale().found)
  } else if (gender === 'f') {
    return ppl.filter(m => !m.presumedMale().found)
  }
  return ppl
}


const getPerson = function (s, gender) {
  // look at current sentence
  let people = s.people()
  people = byGender(people, gender)
  if (people.found) {
    return people.last()
  }
  // non-named people, like 'the cowboy'
  people = s.nouns('#Actor')
  if (people.found) {
    return people.last()
  }
  // existing pronouns
  if (gender === 'f') {
    return findChained('(she|her|hers)', s)
  }
  if (gender === 'm') {
    return findChained('(he|him|his)', s)
  }
  return s.none()
}

export default getPerson
