// 'Björk' to 'Bjork'.
const killUnicode = function (str, world) {
  const unicode = world.model.one.unicode || {}
  str = str || ''
  let chars = str.split('')
  chars.forEach((s, i) => {
    if (unicode[s]) {
      chars[i] = unicode[s]
    }
  })
  return chars.join('')
}
export default killUnicode
