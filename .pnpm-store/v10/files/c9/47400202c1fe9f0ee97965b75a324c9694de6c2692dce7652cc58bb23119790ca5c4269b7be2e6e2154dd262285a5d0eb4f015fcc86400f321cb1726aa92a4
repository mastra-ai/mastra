import words from './data.js'

//concatenate into a string with leading '0.'
const parseDecimals = function (arr) {
  let str = '0.'
  for (let i = 0; i < arr.length; i++) {
    let w = arr[i]
    if (words.ones.hasOwnProperty(w) === true) {
      str += words.ones[w]
    } else if (words.teens.hasOwnProperty(w) === true) {
      str += words.teens[w]
    } else if (words.tens.hasOwnProperty(w) === true) {
      str += words.tens[w]
    } else if (/^[0-9]$/.test(w) === true) {
      str += w
    } else {
      return 0
    }
  }
  return parseFloat(str)
}

export default parseDecimals
