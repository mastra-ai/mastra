const trimEnd = /[,:;)\]*.?~!\u0022\uFF02\u201D\u2019\u00BB\u203A\u2032\u2033\u2034\u301E\u00B4—-]+$/
const trimStart =
  /^[(['"*~\uFF02\u201C\u2018\u201F\u201B\u201E\u2E42\u201A\u00AB\u2039\u2035\u2036\u2037\u301D\u0060\u301F]+/

const punctToKill = /[,:;)('"\u201D\]]/
const isHyphen = /^[-–—]$/
const hasSpace = / /

const textFromTerms = function (terms, opts, keepSpace = true) {
  let txt = ''
  terms.forEach(t => {
    let pre = t.pre || ''
    let post = t.post || ''
    if (opts.punctuation === 'some') {
      pre = pre.replace(trimStart, '')
      // replace a hyphen with a space
      if (isHyphen.test(post)) {
        post = ' '
      }
      post = post.replace(punctToKill, '')
      // cleanup exclamations
      post = post.replace(/\?!+/, '?')
      post = post.replace(/!+/, '!')
      post = post.replace(/\?+/, '?')
      // kill elipses
      post = post.replace(/\.{2,}/, '')
      // kill abbreviation periods
      if (t.tags.has('Abbreviation')) {
        post = post.replace(/\./, '')
      }
    }
    if (opts.whitespace === 'some') {
      pre = pre.replace(/\s/, '') //remove pre-whitespace
      post = post.replace(/\s+/, ' ') //replace post-whitespace with a space
    }
    if (!opts.keepPunct) {
      pre = pre.replace(trimStart, '')
      if (post === '-') {
        post = ' '
      } else {
        post = post.replace(trimEnd, '')
      }
    }
    // grab the correct word format
    let word = t[opts.form || 'text'] || t.normal || ''
    if (opts.form === 'implicit') {
      word = t.implicit || t.text
    }
    if (opts.form === 'root' && t.implicit) {
      word = t.root || t.implicit || t.normal
    }
    // add an implicit space, for contractions
    if ((opts.form === 'machine' || opts.form === 'implicit' || opts.form === 'root') && t.implicit) {
      if (!post || !hasSpace.test(post)) {
        post += ' '
      }
    }
    txt += pre + word + post
  })
  if (keepSpace === false) {
    txt = txt.trim()
  }
  if (opts.lowerCase === true) {
    txt = txt.toLowerCase()
  }
  return txt
}

const textFromDoc = function (docs, opts) {
  let text = ''
  if (!docs || !docs[0] || !docs[0][0]) {
    return text
  }
  for (let i = 0; i < docs.length; i += 1) {
    // middle
    text += textFromTerms(docs[i], opts, true)
  }
  if (!opts.keepSpace) {
    text = text.trim()
  }
  if (opts.keepEndPunct === false) {
    // don't remove ':)' etc
    if (!docs[0][0].tags.has('Emoticon')) {
      text = text.replace(trimStart, '')
    }
    // remove ending periods
    let last = docs[docs.length - 1]
    if (!last[last.length - 1].tags.has('Emoticon')) {
      text = text.replace(trimEnd, '')
    }
    // kill end quotations
    if (text.endsWith(`'`) && !text.endsWith(`s'`)) {
      text = text.replace(/'/, '')
    }
  }
  if (opts.cleanWhitespace === true) {
    text = text.trim()
  }
  return text
}
export { textFromDoc, textFromTerms }
