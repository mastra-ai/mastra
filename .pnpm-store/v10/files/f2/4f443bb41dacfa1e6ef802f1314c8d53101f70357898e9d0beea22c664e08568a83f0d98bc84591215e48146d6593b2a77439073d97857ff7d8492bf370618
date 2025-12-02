/* eslint-disable regexp/no-dupe-characters-character-class */

const pairs = {
  '\u0022': '\u0022', // 'StraightDoubleQuotes'
  '\uFF02': '\uFF02', // 'StraightDoubleQuotesWide'
  '\u0027': '\u0027', // 'StraightSingleQuotes'
  '\u201C': '\u201D', // 'CommaDoubleQuotes'
  '\u2018': '\u2019', // 'CommaSingleQuotes'
  '\u201F': '\u201D', // 'CurlyDoubleQuotesReversed'
  '\u201B': '\u2019', // 'CurlySingleQuotesReversed'
  '\u201E': '\u201D', // 'LowCurlyDoubleQuotes'
  '\u2E42': '\u201D', // 'LowCurlyDoubleQuotesReversed'
  '\u201A': '\u2019', // 'LowCurlySingleQuotes'
  '\u00AB': '\u00BB', // 'AngleDoubleQuotes' «, »
  '\u2039': '\u203A', // 'AngleSingleQuotes'
  // Prime 'non quotation'
  '\u2035': '\u2032', // 'PrimeSingleQuotes'
  '\u2036': '\u2033', // 'PrimeDoubleQuotes'
  '\u2037': '\u2034', // 'PrimeTripleQuotes'
  // Prime 'quotation' variation
  '\u301D': '\u301E', // 'PrimeDoubleQuotes'
  '\u0060': '\u00B4', // 'PrimeSingleQuotes'
  '\u301F': '\u301E', // 'LowPrimeDoubleQuotesReversed'
}

const hasOpen = RegExp('[' + Object.keys(pairs).join('') + ']')
const hasClosed = RegExp('[' + Object.values(pairs).join('') + ']')

const findEnd = function (terms, i) {
  const have = terms[i].pre.match(hasOpen)[0] || ''
  if (!have || !pairs[have]) {
    return null
  }
  const want = pairs[have]
  for (; i < terms.length; i += 1) {
    if (terms[i].post && terms[i].post.match(want)) {
      return i
    }
  }
  return null
}

const find = function (doc) {
  let ptrs = []
  doc.docs.forEach(terms => {
    let isOpen = false
    for (let i = 0; i < terms.length; i += 1) {
      let term = terms[i]
      if (!isOpen && term.pre && hasOpen.test(term.pre)) {
        let end = findEnd(terms, i)
        if (end !== null) {
          let [n, start] = terms[i].index
          ptrs.push([n, start, end + 1, terms[i].id])
          i = end
        }
      }
    }
  })
  return doc.update(ptrs)
}

const strip = function (m) {
  m.docs.forEach(terms => {
    terms[0].pre = terms[0].pre.replace(hasOpen, '')
    let lastTerm = terms[terms.length - 1]
    lastTerm.post = lastTerm.post.replace(hasClosed, '')
  })
}
export { find, strip }
