// verbose-mode tagger debuging
const log = (term, tag, reason = '') => {
  const yellow = str => '\x1b[33m\x1b[3m' + str + '\x1b[0m'
  const i = str => '\x1b[3m' + str + '\x1b[0m'
  let word = term.text || '[' + term.implicit + ']'
  if (typeof tag !== 'string' && tag.length > 2) {
    tag = tag.slice(0, 2).join(', #') + ' +' //truncate the list of tags
  }
  tag = typeof tag !== 'string' ? tag.join(', #') : tag
  console.log(` ${yellow(word).padEnd(24)} \x1b[32m→\x1b[0m #${tag.padEnd(22)}  ${i(reason)}`) // eslint-disable-line
}

// a faster version than the user-facing one in ./methods
const fastTag = function (term, tag, reason) {
  if (!tag || tag.length === 0) {
    return
  }
  if (term.frozen === true) {
    return
  }
  // some logging for debugging
  const env = typeof process === 'undefined' || !process.env ? self.env || {} : process.env
  if (env && env.DEBUG_TAGS) {
    log(term, tag, reason)
  }
  term.tags = term.tags || new Set()
  if (typeof tag === 'string') {
    term.tags.add(tag)
  } else {
    tag.forEach(tg => term.tags.add(tg))
  }
}

export default fastTag
