import findModifiers from './findModifiers.js'
import words from './data.js'
import isValid from './validate.js'
import parseDecimals from './parseDecimals.js'
import parseNumeric from './parseNumeric.js'
const improperFraction = /^([0-9,. ]+)\/([0-9,. ]+)$/

//some numbers we know
const casualForms = {
  'a few': 3,
  'a couple': 2,
  'a dozen': 12,
  'two dozen': 24,
  zero: 0,
}

// a 'section' is something like 'fifty-nine thousand'
// turn a section into something we can add to - like 59000
const section_sum = obj => {
  return Object.keys(obj).reduce((sum, k) => {
    sum += obj[k]
    return sum
  }, 0)
}

//turn a string into a number
const parse = function (str) {
  //convert some known-numbers
  if (casualForms.hasOwnProperty(str) === true) {
    return casualForms[str]
  }
  //'a/an' is 1
  if (str === 'a' || str === 'an') {
    return 1
  }
  const modifier = findModifiers(str)
  str = modifier.str
  let last_mult = null
  let has = {}
  let sum = 0
  let isNegative = false
  const terms = str.split(/[ -]/)
  // const isFraction = findFraction(terms)
  for (let i = 0; i < terms.length; i++) {
    let w = terms[i]
    w = parseNumeric(w)

    if (!w || w === 'and') {
      continue
    }
    if (w === '-' || w === 'negative') {
      isNegative = true
      continue
    }
    if (w.charAt(0) === '-') {
      isNegative = true
      w = w.substring(1)
    }

    //decimal mode
    if (w === 'point') {
      sum += section_sum(has)
      sum += parseDecimals(terms.slice(i + 1, terms.length))
      sum *= modifier.amount
      return sum
    }

    //improper fraction
    const fm = w.match(improperFraction)
    if (fm) {
      const num = parseFloat(fm[1].replace(/[, ]/g, ''))
      const denom = parseFloat(fm[2].replace(/[, ]/g, ''))
      if (denom) {
        sum += num / denom || 0
      }
      continue
    }
    // try to support 'two fifty'
    if (words.tens.hasOwnProperty(w)) {
      if (has.ones && Object.keys(has).length === 1) {
        sum = has.ones * 100
        has = {}
      }
    }

    //prevent mismatched units, like 'seven eleven' if not a fraction
    if (isValid(w, has) === false) {
      return null
    }

    //buildOut section, collect 'has' values
    if (/^[0-9.]+$/.test(w)) {
      has.ones = parseFloat(w) //not technically right
    } else if (words.ones.hasOwnProperty(w) === true) {
      has.ones = words.ones[w]
    } else if (words.teens.hasOwnProperty(w) === true) {
      has.teens = words.teens[w]
    } else if (words.tens.hasOwnProperty(w) === true) {
      has.tens = words.tens[w]
    } else if (words.multiples.hasOwnProperty(w) === true) {
      let mult = words.multiples[w]

      //something has gone wrong : 'two hundred five hundred'
      //possibly because it's a fraction
      if (mult === last_mult) {
        return null
      }
      //support 'hundred thousand'
      //this one is tricky..
      if (mult === 100 && terms[i + 1] !== undefined) {
        const w2 = terms[i + 1]
        if (words.multiples[w2]) {
          mult *= words.multiples[w2] //hundredThousand/hundredMillion
          i += 1
        }
      }
      //natural order of things
      //five thousand, one hundred..
      if (last_mult === null || mult < last_mult) {
        sum += (section_sum(has) || 1) * mult
        last_mult = mult
        has = {}
      } else {
        //maybe hundred .. thousand
        sum += section_sum(has)
        last_mult = mult
        sum = (sum || 1) * mult
        has = {}
      }
    }
  }
  //dump the remaining has values
  sum += section_sum(has)
  //post-process add modifier
  sum *= modifier.amount
  sum *= isNegative ? -1 : 1
  //dont return 0, if it went straight-through
  if (sum === 0 && Object.keys(has).length === 0) {
    return null
  }
  return sum
}

export default parse
