import textValue from '../toText/index.js'

const irregulars = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
  twenty: 'twentieth',
  thirty: 'thirtieth',
  forty: 'fortieth',
  fourty: 'fourtieth',
  fifty: 'fiftieth',
  sixty: 'sixtieth',
  seventy: 'seventieth',
  eighty: 'eightieth',
  ninety: 'ninetieth',
}

/**
 * convert a javascript number to 'twentieth' format
 * */
const textOrdinal = obj => {
  let words = textValue(obj).split(' ')
  //convert the last number to an ordinal
  let last = words[words.length - 1]
  if (irregulars.hasOwnProperty(last)) {
    words[words.length - 1] = irregulars[last]
  } else {
    words[words.length - 1] = last.replace(/y$/, 'i') + 'th'
  }
  return words.join(' ')
}

export default textOrdinal
