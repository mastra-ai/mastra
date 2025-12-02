const isSlash = /\p{L} ?\/ ?\p{L}+$/u

// 'he / she' should be one word
const combineSlashes = function (arr) {
  for (let i = 1; i < arr.length - 1; i++) {
    if (isSlash.test(arr[i])) {
      arr[i - 1] += arr[i] + arr[i + 1]
      arr[i] = null
      arr[i + 1] = null
    }
  }
  return arr
}
export default combineSlashes
