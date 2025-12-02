import words from './data.js'

//prevent things like 'fifteen ten', and 'five sixty'
const isValid = (w, has) => {
  if (words.ones.hasOwnProperty(w)) {
    if (has.ones || has.teens) {
      return false
    }
  } else if (words.teens.hasOwnProperty(w)) {
    if (has.ones || has.teens || has.tens) {
      return false
    }
  } else if (words.tens.hasOwnProperty(w)) {
    if (has.ones || has.teens || has.tens) {
      return false
    }
  }
  return true
}
export default isValid
