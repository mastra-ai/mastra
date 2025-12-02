const MAX_LEN = 250// ¯\_(ツ)_/¯

// support unicode variants?
// https://stackoverflow.com/questions/13535172/list-of-all-unicodes-open-close-brackets
const hasOpen = /\(/g
const hasClosed = /\)/g
const mergeParens = function (splits) {
  let arr = []
  for (let i = 0; i < splits.length; i += 1) {
    let split = splits[i]
    let m = split.match(hasOpen)
    if (m !== null && m.length === 1) {
      // look at next sentence, for closing parenthesis
      if (splits[i + 1] && splits[i + 1].length < MAX_LEN) {
        let m2 = splits[i + 1].match(hasClosed)
        if (m2 !== null && m.length === 1 && !hasOpen.test(splits[i + 1])) {
          // merge in 2nd sentence
          splits[i] += splits[i + 1]
          arr.push(splits[i])
          splits[i + 1] = ''
          i += 1
          continue
        }
      }
    }
    arr.push(splits[i])
  }
  return arr
}
export default mergeParens