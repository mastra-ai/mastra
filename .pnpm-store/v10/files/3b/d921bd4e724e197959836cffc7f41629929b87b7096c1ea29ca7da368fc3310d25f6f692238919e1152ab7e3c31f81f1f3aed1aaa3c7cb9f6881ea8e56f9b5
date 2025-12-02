//sweep-through all suffixes
const suffixLoop = function (str = '', suffixes = []) {
  const len = str.length
  let max = len <= 6 ? len - 1 : 6
  for (let i = max; i >= 1; i -= 1) {
    let suffix = str.substring(len - i, str.length)
    if (suffixes[suffix.length].hasOwnProperty(suffix) === true) {
      let pre = str.slice(0, len - i)
      let post = suffixes[suffix.length][suffix]
      return pre + post
    }
  }
  return null
}
export default suffixLoop