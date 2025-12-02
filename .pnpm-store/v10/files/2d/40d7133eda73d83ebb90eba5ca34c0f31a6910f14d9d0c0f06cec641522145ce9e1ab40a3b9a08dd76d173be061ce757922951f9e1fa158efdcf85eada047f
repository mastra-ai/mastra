// check a rule
const convert = function (str, rule) {
  if (rule.from.length >= str.length) {
    return null
  }
  if (str.endsWith(rule.from)) {
    let len = str.length - rule.from.length
    let pre = str.slice(0, len)
    // if (str === 'agenouiller') {
    //   console.log(str, rule, pre + rule.to)
    // }
    return pre + rule.to
  }
  return null
}
export default convert
// console.log(convert('asdfoo', { from: 'foo', to: 'dog' }))