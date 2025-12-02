import parseText from './toNumber/index.js'
import parseFraction from '../../fractions/parse.js'

const parseNumeric = function (str, m) {
  str = str.replace(/,/g, '')
  //parse a numeric-number
  let arr = str.split(/([0-9.,]*)/)
  let [prefix, num] = arr
  let suffix = arr.slice(2).join('')
  if (num !== '' && m.length < 2) {
    num = Number(num || str)
    //ensure that num is an actual number
    if (typeof num !== 'number') {
      num = null
    }
    // strip an ordinal off the suffix
    suffix = suffix || ''
    if (suffix === 'st' || suffix === 'nd' || suffix === 'rd' || suffix === 'th') {
      suffix = ''
    }
    // support M for million, k for thousand
    // if (suffix === 'm' || suffix === 'M') {
    //   num *= 1000000
    //   suffix = ''
    // }
    // if (suffix === 'k' || suffix === 'k') {
    //   num *= 1000
    //   suffix = ''
    // }
    return {
      prefix: prefix || '',
      num: num,
      suffix: suffix,
    }
  }
  return null
}

// get a numeric value from this phrase
const parseNumber = function (m) {
  if (typeof m === 'string') {
    return { num: parseText(m) }
  }
  let str = m.text('reduced')
  // reach for '12 litres'
  let unit = m.growRight('#Unit').match('#Unit$').text('machine')
  // is it in '3,123' format?
  let hasComma = /[0-9],[0-9]/.test(m.text('text'))
  // parse a numeric-number like '$4.00'
  if (m.terms().length === 1 && !m.has('#Multiple')) {
    let res = parseNumeric(str, m)
    if (res !== null) {
      res.hasComma = hasComma
      res.unit = unit
      return res
    }
  }
  // -- parse text-formats --
  // Fractions: remove 'and a half' etc. from the end
  let frPart = m.match('#Fraction{2,}$')
  frPart = frPart.found === false ? m.match('^#Fraction$') : frPart
  let fraction = null
  if (frPart.found) {
    if (frPart.has('#Value and #Value #Fraction')) {
      frPart = frPart.match('and #Value #Fraction')
    }
    fraction = parseFraction(frPart)
    // remove it from our string
    m = m.not(frPart)
    m = m.not('and$')
    str = m.text('reduced')
  }
  let num = 0
  if (str) {
    num = parseText(str) || 0
  }
  // apply numeric fraction
  if (fraction && fraction.decimal) {
    num += fraction.decimal
  }


  return {
    hasComma,
    prefix: '',
    num,
    suffix: '',
    isOrdinal: m.has('#Ordinal'),
    isText: m.has('#TextValue'),
    isFraction: m.has('#Fraction'),
    isMoney: m.has('#Money'),
    unit
  }
}
export default parseNumber
