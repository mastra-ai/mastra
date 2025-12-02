import toString from '../../_toString.js'

/**
 * turn a number like 5 into an ordinal like 5th
 */
const numOrdinal = function (obj) {
  let num = obj.num
  if (!num && num !== 0) {
    return null
  }
  //the teens are all 'th'
  let tens = num % 100
  if (tens > 10 && tens < 20) {
    return String(num) + 'th'
  }
  //the rest of 'em
  const mapping = {
    0: 'th',
    1: 'st',
    2: 'nd',
    3: 'rd',
  }
  let str = toString(num)
  let last = str.slice(str.length - 1, str.length)
  if (mapping[last]) {
    str += mapping[last]
  } else {
    str += 'th'
  }
  return str
}

export default numOrdinal
