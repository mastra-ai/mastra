/**
 * turn big numbers, like 2.3e+22, into a string with a ton of trailing 0's
 * */
const numToString = function (n) {
  if (n < 1000000) {
    return String(n)
  }
  let str
  if (typeof n === 'number') {
    str = n.toFixed(0)
  } else {
    str = n
  }
  if (str.indexOf('e+') === -1) {
    return str
  }
  return str
    .replace('.', '')
    .split('e+')
    .reduce(function (p, b) {
      return p + Array(b - p.length + 2).join(0)
    })
}
export default numToString
// console.log(numToString(2.5e+22));
