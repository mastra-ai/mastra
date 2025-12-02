import numOrdinal from './toOrdinal/numOrdinal.js'
import textOrdinal from './toOrdinal/textOrdinal.js'
import textCardinal from './toText/index.js'
import makeSuffix from './suffix.js'

const format = function (obj, fmt) {
  if (fmt === 'TextOrdinal') {
    let { prefix, suffix } = makeSuffix(obj)
    return prefix + textOrdinal(obj) + suffix
  }
  if (fmt === 'Ordinal') {
    return obj.prefix + numOrdinal(obj) + obj.suffix
  }
  if (fmt === 'TextCardinal') {
    let { prefix, suffix } = makeSuffix(obj)
    return prefix + textCardinal(obj) + suffix
  }
  // assume Cardinal
  let num = obj.num
  if (obj.hasComma) {
    num = num.toLocaleString()
  }
  return obj.prefix + String(num) + obj.suffix
}
export default format