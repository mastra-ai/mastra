import fastTag from '../_fastTag.js'
const min = 1400
const max = 2100

const dateWords = new Set([
  'in',
  'on',
  'by',
  'until',
  'for',
  'to',
  'during',
  'throughout',
  'through',
  'within',
  'before',
  'after',
  'of',
  'this',
  'next',
  'last',
  'circa',
  'around',
  'post',
  'pre',
  'budget',
  'classic',
  'plan',
  'may',
])

const seemsGood = function (term) {
  if (!term) {
    return false
  }
  let str = term.normal || term.implicit
  if (dateWords.has(str)) {
    return true
  }
  if (term.tags.has('Date') || term.tags.has('Month') || term.tags.has('WeekDay') || term.tags.has('Year')) {
    return true
  }
  // 1999 Film Festival
  if (term.tags.has('ProperNoun')) {
    return true
  }
  return false
}

const seemsOkay = function (term) {
  if (!term) {
    return false
  }
  if (term.tags.has('Ordinal')) {
    return true
  }
  // untagged 'june 13 2007'
  if (term.tags.has('Cardinal') && term.normal.length < 3) {
    return true
  }
  // 2020 was ..
  if (term.normal === 'is' || term.normal === 'was') {
    return true
  }
  return false
}

const seemsFine = function (term) {
  return term && (term.tags.has('Date') || term.tags.has('Month') || term.tags.has('WeekDay') || term.tags.has('Year'))
}

// recognize '1993' as a year
const tagYear = function (terms, i) {
  const term = terms[i]
  if (term.tags.has('NumericValue') && term.tags.has('Cardinal') && term.normal.length === 4) {
    let num = Number(term.normal)
    // number between 1400 and 2100
    if (num && !isNaN(num)) {
      if (num > min && num < max) {
        let lastTerm = terms[i - 1]
        let nextTerm = terms[i + 1]
        if (seemsGood(lastTerm) || seemsGood(nextTerm)) {
          return fastTag(term, 'Year', '2-tagYear')
        }
        // or is it really-close to a year?
        if (num >= 1920 && num < 2025) {
          // look at neighbours
          if (seemsOkay(lastTerm) || seemsOkay(nextTerm)) {
            return fastTag(term, 'Year', '2-tagYear-close')
          }
          // look at far-neighbours
          if (seemsFine(terms[i - 2]) || seemsFine(terms[i + 2])) {
            return fastTag(term, 'Year', '2-tagYear-far')
          }
          // 'the 2002 hit', 'my 1950 convertable'
          if (lastTerm && (lastTerm.tags.has('Determiner') || lastTerm.tags.has('Possessive'))) {
            if (nextTerm && nextTerm.tags.has('Noun') && !nextTerm.tags.has('Plural')) {
              return fastTag(term, 'Year', '2-tagYear-noun')
            }
          }
        }
      }
    }
  }
  return null
}

export default tagYear
