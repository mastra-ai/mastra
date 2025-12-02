/** some basic operations on a string to reduce noise */
const clean = function (str) {
  str = str || ''
  str = str.toLowerCase()
  str = str.trim()
  let original = str
  //punctuation
  str = str.replace(/[,;.!?]+$/, '')
  //coerce Unicode ellipses
  str = str.replace(/\u2026/g, '...')
  //en-dash
  str = str.replace(/\u2013/g, '-')
  //strip leading & trailing grammatical punctuation
  if (/^[:;]/.test(str) === false) {
    str = str.replace(/\.{3,}$/g, '')
    str = str.replace(/[",.!:;?)]+$/g, '')
    str = str.replace(/^['"(]+/g, '')
  }
  // remove zero-width characters
  str = str.replace(/[\u200B-\u200D\uFEFF]/g, '')
  //do this again..
  str = str.trim()
  //oh shucks,
  if (str === '') {
    str = original
  }
  //no-commas in numbers
  str = str.replace(/([0-9]),([0-9])/g, '$1$2')
  return str
}
export default clean
