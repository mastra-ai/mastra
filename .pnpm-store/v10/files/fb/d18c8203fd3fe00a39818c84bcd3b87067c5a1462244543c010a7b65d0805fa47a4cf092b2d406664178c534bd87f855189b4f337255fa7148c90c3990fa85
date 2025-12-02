import toString from '../../_toString.js'
import { sequence, ones_mapping, tens_mapping } from './data.js'
/**
 * turns an integer/float into.ber, like 'fifty-five'
 */

//turn number into an array of magnitudes, like [[5, million], [2, hundred]]
const breakdown_magnitudes = function (num) {
  let working = num
  let have = []
  sequence.forEach(a => {
    if (num >= a[0]) {
      let howmany = Math.floor(working / a[0])
      working -= howmany * a[0]
      if (howmany) {
        have.push({
          unit: a[1],
          count: howmany,
        })
      }
    }
  })
  return have
}

//turn numbers from 100-0 into their text
const breakdown_hundred = function (num) {
  let arr = []
  if (num > 100) {
    return arr //something bad happened..
  }
  for (let i = 0; i < tens_mapping.length; i++) {
    if (num >= tens_mapping[i][1]) {
      num -= tens_mapping[i][1]
      arr.push(tens_mapping[i][0])
    }
  }
  //(hopefully) we should only have 20-0 now
  if (ones_mapping[num]) {
    arr.push(ones_mapping[num])
  }
  return arr
}

/** print-out 'point eight nine'*/
const handle_decimal = num => {
  const names = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
  let arr = []
  //parse it out like a string, because js math is such shit
  let str = toString(num)
  let decimal = str.match(/\.([0-9]+)/)
  if (!decimal || !decimal[0]) {
    return arr
  }
  arr.push('point')
  let decimals = decimal[0].split('')
  for (let i = 0; i < decimals.length; i++) {
    arr.push(names[decimals[i]])
  }
  return arr
}

/** turns an integer into a textual number */
const toText = function (obj) {
  let num = obj.num
  // handle zero, quickly
  if (num === 0 || num === '0') {
    return 'zero' // no?
  }
  //big numbers, north of sextillion, aren't gonna work well..
  //keep them small..
  if (num > 1e21) {
    num = toString(num)
  }
  let arr = []
  //handle negative numbers
  if (num < 0) {
    arr.push('minus')
    num = Math.abs(num)
  }
  //break-down into units, counts
  let units = breakdown_magnitudes(num)
  //build-up the string from its components
  for (let i = 0; i < units.length; i++) {
    let unit_name = units[i].unit
    if (unit_name === 'one') {
      unit_name = ''
      //put an 'and' in here
      if (arr.length > 1) {
        arr.push('and')
      }
    }
    arr = arr.concat(breakdown_hundred(units[i].count))
    arr.push(unit_name)
  }
  //also support decimals - 'point eight'
  arr = arr.concat(handle_decimal(num))
  //remove empties
  arr = arr.filter(s => s)
  if (arr.length === 0) {
    arr[0] = ''
  }
  return arr.join(' ')
}

export default toText

// console.log(to_text(-1000.8));
