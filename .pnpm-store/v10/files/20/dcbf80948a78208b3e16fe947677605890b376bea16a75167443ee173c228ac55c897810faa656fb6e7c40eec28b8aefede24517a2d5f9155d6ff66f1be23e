// do acronyms need to be ASCII?  ... kind of?
const periodAcronym = /([A-Z]\.)+[A-Z]?,?$/
const oneLetterAcronym = /^[A-Z]\.,?$/
const noPeriodAcronym = /[A-Z]{2,}('s|,)?$/
const lowerCaseAcronym = /([a-z]\.)+[a-z]\.?$/

const isAcronym = function (str) {
  //like N.D.A
  if (periodAcronym.test(str) === true) {
    return true
  }
  //like c.e.o
  if (lowerCaseAcronym.test(str) === true) {
    return true
  }
  //like 'F.'
  if (oneLetterAcronym.test(str) === true) {
    return true
  }
  //like NDA
  if (noPeriodAcronym.test(str) === true) {
    return true
  }
  return false
}

const doAcronym = function (str) {
  if (isAcronym(str)) {
    str = str.replace(/\./g, '')
  }
  return str
}
export default doAcronym
