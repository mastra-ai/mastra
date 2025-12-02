/* eslint-disable regexp/no-dupe-characters-character-class */

// merge embedded quotes into 1 sentence
// like - 'he said "no!" and left.'
const MAX_QUOTE = 280// ¯\_(ツ)_/¯

// don't support single-quotes for multi-sentences
const pairs = {
  '\u0022': '\u0022', // 'StraightDoubleQuotes'
  '\uFF02': '\uFF02', // 'StraightDoubleQuotesWide'
  // '\u0027': '\u0027', // 'StraightSingleQuotes'
  '\u201C': '\u201D', // 'CommaDoubleQuotes'
  // '\u2018': '\u2019', // 'CommaSingleQuotes'
  '\u201F': '\u201D', // 'CurlyDoubleQuotesReversed'
  // '\u201B': '\u2019', // 'CurlySingleQuotesReversed'
  '\u201E': '\u201D', // 'LowCurlyDoubleQuotes'
  '\u2E42': '\u201D', // 'LowCurlyDoubleQuotesReversed'
  '\u201A': '\u2019', // 'LowCurlySingleQuotes'
  '\u00AB': '\u00BB', // 'AngleDoubleQuotes'
  '\u2039': '\u203A', // 'AngleSingleQuotes'
  '\u2035': '\u2032', // 'PrimeSingleQuotes'
  '\u2036': '\u2033', // 'PrimeDoubleQuotes'
  '\u2037': '\u2034', // 'PrimeTripleQuotes'
  '\u301D': '\u301E', // 'PrimeDoubleQuotes'
  // '\u0060': '\u00B4', // 'PrimeSingleQuotes'
  '\u301F': '\u301E', // 'LowPrimeDoubleQuotesReversed'
}
const openQuote = RegExp('[' + Object.keys(pairs).join('') + ']', 'g')
const closeQuote = RegExp('[' + Object.values(pairs).join('') + ']', 'g')

const closesQuote = function (str) {
  if (!str) {
    return false
  }
  let m = str.match(closeQuote)
  if (m !== null && m.length === 1) {
    return true
  }
  return false
}

// allow micro-sentences when inside a quotation, like:
// the doc said "no sir. i will not beg" and walked away.
const quoteMerge = function (splits) {
  let arr = []
  for (let i = 0; i < splits.length; i += 1) {
    let split = splits[i]
    // do we have an open-quote and not a closed one?
    let m = split.match(openQuote)
    if (m !== null && m.length === 1) {

      // look at the next sentence for a closing quote,
      if (closesQuote(splits[i + 1]) && splits[i + 1].length < MAX_QUOTE) {
        splits[i] += splits[i + 1]// merge them
        arr.push(splits[i])
        splits[i + 1] = ''
        i += 1
        continue
      }
      // look at n+2 for a closing quote,
      if (closesQuote(splits[i + 2])) {
        let toAdd = splits[i + 1] + splits[i + 2]// merge them all
        //make sure it's not too-long
        if (toAdd.length < MAX_QUOTE) {
          splits[i] += toAdd
          arr.push(splits[i])
          splits[i + 1] = ''
          splits[i + 2] = ''
          i += 2
          continue
        }
      }
    }
    arr.push(splits[i])
  }
  return arr
}
export default quoteMerge
