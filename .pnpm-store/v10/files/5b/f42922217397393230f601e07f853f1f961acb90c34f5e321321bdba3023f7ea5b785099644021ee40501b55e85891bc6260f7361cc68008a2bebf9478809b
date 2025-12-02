const endS = /s$/
import parseText from '../numbers/parse/toNumber/index.js'

// just using .toNumber() again may risk an infinite-loop
const parseNumber = function (m) {
  let str = m.text('reduced')
  return parseText(str)
}

let mapping = {
  half: 2,
  halve: 2,
  quarter: 4,
}

const slashForm = function (m) {
  let str = m.text('reduced')
  let found = str.match(/^([-+]?[0-9]+)\/([-+]?[0-9]+)(st|nd|rd|th)?s?$/)
  if (found && found[1] && found[0]) {
    return {
      numerator: Number(found[1]),
      denominator: Number(found[2]),
    }
  }
  return null
}

// parse '4 out of 4'
const nOutOfN = function (m) {
  let found = m.match('[<num>#Value+] out of every? [<den>#Value+]')
  if (found.found !== true) {
    return null
  }
  let { num, den } = found.groups()
  if (!num || !den) {
    return null
  }
  num = parseNumber(num)
  den = parseNumber(den)
  if (!num || !den) {
    return null
  }
  if (typeof num === 'number' && typeof den === 'number') {
    return {
      numerator: num,
      denominator: den,
    }
  }
  return null
}

// parse 'five thirds'
const nOrinalth = function (m) {
  let found = m.match('[<num>(#Cardinal|a)+] [<den>#Fraction+]')
  if (found.found !== true) {
    return null
  }
  let { num, den } = found.groups()
  // -- parse numerator---
  // quick-support for 'a third'
  if (num.has('a')) {
    num = 1
  } else {
    // abuse the number-parser for 'thirty three'
    // let tmp = num.clone().unTag('Fraction')
    // num = tmp.numbers().get()[0]
    num = parseNumber(num)
  }
  // -- parse denominator --
  // turn 'thirds' into third
  let str = den.text('reduced')
  if (endS.test(str)) {
    str = str.replace(endS, '')
    den = den.replaceWith(str)
  }
  // support 'one half' as '1/2'
  if (mapping.hasOwnProperty(str)) {
    den = mapping[str]
  } else {
    // dem = dem.numbers().get()[0]
    den = parseNumber(den)
  }
  if (typeof num === 'number' && typeof den === 'number') {
    return {
      numerator: num,
      denominator: den,
    }
  }
  return null
}

// implied 1 in '100th of a', 'fifth of a'
const oneNth = function (m) {
  let found = m.match('^#Ordinal$')
  if (found.found !== true) {
    return null
  }
  // ensure it's '100th of a '
  if (m.lookAhead('^of .')) {
    // let num = found.numbers().get()[0]
    let num = parseNumber(found)
    return {
      numerator: 1,
      denominator: num,
    }
  }
  return null
}

// 'half'
const named = function (m) {
  let str = m.text('reduced')
  if (mapping.hasOwnProperty(str)) {
    return { numerator: 1, denominator: mapping[str] }
  }
  return null
}

const round = n => {
  let rounded = Math.round(n * 1000) / 1000
  // don't round 1 millionth down into 0
  if (rounded === 0 && n !== 0) {
    return n
  }
  return rounded
}

const parseFraction = function (m) {
  m = m.clone()
  let res = named(m) || slashForm(m) || nOutOfN(m) || nOrinalth(m) || oneNth(m) || null
  if (res !== null) {
    // do the math
    if (res.numerator && res.denominator) {
      res.decimal = res.numerator / res.denominator
      res.decimal = round(res.decimal)
    }
  }
  return res
}
export default parseFraction
