//all punctuation marks, from https://en.wikipedia.org/wiki/Punctuation

//we have slightly different rules for start/end - like #hashtags.
const isLetter = /\p{Letter}/u
const isNumber = /[\p{Number}\p{Currency_Symbol}]/u
const hasAcronym = /^[a-z]\.([a-z]\.)+/i
const chillin = /[sn]['’]$/

const normalizePunctuation = function (str, model) {
  // quick lookup for allowed pre/post punctuation
  let { prePunctuation, postPunctuation, emoticons } = model.one
  let original = str
  let pre = ''
  let post = ''
  let chars = Array.from(str)

  // punctuation-only words, like '<3'
  if (emoticons.hasOwnProperty(str.trim())) {
    return { str: str.trim(), pre, post: ' ' } //not great
  }

  // pop any punctuation off of the start
  let len = chars.length
  for (let i = 0; i < len; i += 1) {
    let c = chars[0]
    // keep any declared chars
    if (prePunctuation[c] === true) {
      continue//keep it
    }
    // keep '+' or '-' only before a number
    if ((c === '+' || c === '-') && isNumber.test(chars[1])) {
      break//done
    }
    // '97 - year short-form
    if (c === "'" && c.length === 3 && isNumber.test(chars[1])) {
      break//done
    }
    // start of word
    if (isLetter.test(c) || isNumber.test(c)) {
      break //done
    }
    // punctuation
    pre += chars.shift()//keep going
  }

  // pop any punctuation off of the end
  len = chars.length
  for (let i = 0; i < len; i += 1) {
    let c = chars[chars.length - 1]
    // keep any declared chars
    if (postPunctuation[c] === true) {
      continue//keep it
    }
    // start of word
    if (isLetter.test(c) || isNumber.test(c)) {
      break //done
    }
    // F.B.I.
    if (c === '.' && hasAcronym.test(original) === true) {
      continue//keep it
    }
    //  keep s-apostrophe - "flanders'" or "chillin'"
    if (c === "'" && chillin.test(original) === true) {
      continue//keep it
    }
    // punctuation
    post = chars.pop() + post//keep going
  }
  str = chars.join('')
  //we went too far..
  if (str === '') {
    // do a very mild parse, and hope for the best.
    original = original.replace(/ *$/, after => {
      post = after || ''
      return ''
    })
    str = original
    pre = ''
  }
  return { str, pre, post }
}
export default normalizePunctuation
