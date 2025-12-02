import toText from '../../numbers/format/toText/index.js'
import textOrdinal from '../../numbers/format/toOrdinal/textOrdinal.js'

const toOrdinal = function (obj) {
  // don't divide by zero!
  if (!obj.numerator || !obj.denominator) {
    return ''
  }
  // create [two] [fifths]
  let start = toText({ num: obj.numerator })
  let end = textOrdinal({ num: obj.denominator })
  // 'one secondth' -> 'one half'
  if (obj.denominator === 2) {
    end = 'half'
  }
  if (start && end) {
    if (obj.numerator !== 1) {
      end += 's'
    }
    return `${start} ${end}`
  }
  return ''
}
export default toOrdinal
