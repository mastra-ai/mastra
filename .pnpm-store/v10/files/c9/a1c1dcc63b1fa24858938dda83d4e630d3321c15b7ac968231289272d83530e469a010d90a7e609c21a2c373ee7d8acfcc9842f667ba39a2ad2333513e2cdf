// these methods are called with '@hasComma' in the match syntax
// various unicode quotation-mark formats
const startQuote =
  /([\u0022\uFF02\u0027\u201C\u2018\u201F\u201B\u201E\u2E42\u201A\u00AB\u2039\u2035\u2036\u2037\u301D\u0060\u301F])/

const endQuote = /([\u0022\uFF02\u0027\u201D\u2019\u00BB\u203A\u2032\u2033\u2034\u301E\u00B4])/

const hasHyphen = /^[-–—]$/
const hasDash = / [-–—]{1,3} /

/** search the term's 'post' punctuation  */
const hasPost = (term, punct) => term.post.indexOf(punct) !== -1
/** search the term's 'pre' punctuation  */
// const hasPre = (term, punct) => term.pre.indexOf(punct) !== -1

const methods = {
  /** does it have a quotation symbol?  */
  hasQuote: term => startQuote.test(term.pre) || endQuote.test(term.post),
  /** does it have a comma?  */
  hasComma: term => hasPost(term, ','),
  /** does it end in a period? */
  hasPeriod: term => hasPost(term, '.') === true && hasPost(term, '...') === false,
  /** does it end in an exclamation */
  hasExclamation: term => hasPost(term, '!'),
  /** does it end with a question mark? */
  hasQuestionMark: term => hasPost(term, '?') || hasPost(term, '¿'),
  /** is there a ... at the end? */
  hasEllipses: term => hasPost(term, '..') || hasPost(term, '…'),
  /** is there a semicolon after term word? */
  hasSemicolon: term => hasPost(term, ';'),
  /** is there a colon after term word? */
  hasColon: term => hasPost(term, ':'),
  /** is there a slash '/' in term word? */
  hasSlash: term => /\//.test(term.text),
  /** a hyphen connects two words like-term */
  hasHyphen: term => hasHyphen.test(term.post) || hasHyphen.test(term.pre),
  /** a dash separates words - like that */
  hasDash: term => hasDash.test(term.post) || hasDash.test(term.pre),
  /** is it multiple words combinded */
  hasContraction: term => Boolean(term.implicit),
  /** is it an acronym */
  isAcronym: term => term.tags.has('Acronym'),
  /** does it have any tags */
  isKnown: term => term.tags.size > 0,
  /** uppercase first letter, then a lowercase */
  isTitleCase: term => /^\p{Lu}[a-z'\u00C0-\u00FF]/u.test(term.text),
  /** uppercase all letters */
  isUpperCase: term => /^\p{Lu}+$/u.test(term.text),
}
// aliases
methods.hasQuotation = methods.hasQuote

export default methods
