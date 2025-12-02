// split by periods, question marks, unicode ⁇, etc
const initSplit = /([.!?\u203D\u2E18\u203C\u2047-\u2049\u3002]+\s)/g
// merge these back into prev sentence
const splitsOnly = /^[.!?\u203D\u2E18\u203C\u2047-\u2049\u3002]+\s$/
const newLine = /((?:\r?\n|\r)+)/ // Match different new-line formats

// Start with a regex:
const basicSplit = function (text) {
  let all = []
  //first, split by newline
  let lines = text.split(newLine)
  for (let i = 0; i < lines.length; i++) {
    //split by period, question-mark, and exclamation-mark
    let arr = lines[i].split(initSplit)
    for (let o = 0; o < arr.length; o++) {
      // merge 'foo' + '.'
      if (arr[o + 1] && splitsOnly.test(arr[o + 1]) === true) {
        arr[o] += arr[o + 1]
        arr[o + 1] = ''
      }
      if (arr[o] !== '') {
        all.push(arr[o])
      }
    }
  }
  return all
}
export default basicSplit
