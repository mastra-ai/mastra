// combine '2 - 5' like '2-5' is
// 2-4: 2, 4
const combineRanges = function (arr) {
  const startRange = /^[0-9]{1,4}(:[0-9][0-9])?([a-z]{1,2})? ?[-–—] ?$/
  const endRange = /^[0-9]{1,4}([a-z]{1,2})? ?$/
  for (let i = 0; i < arr.length - 1; i += 1) {
    if (arr[i + 1] && startRange.test(arr[i]) && endRange.test(arr[i + 1])) {
      arr[i] = arr[i] + arr[i + 1]
      arr[i + 1] = null
    }
  }
  return arr
}
export default combineRanges
