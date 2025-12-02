const isMulti = / /

const addChunk = function (term, tag) {
  if (tag === 'Noun') {
    term.chunk = tag
  }
  if (tag === 'Verb') {
    term.chunk = tag
  }
}

const tagTerm = function (term, tag, tagSet, isSafe) {
  // does it already have this tag?
  if (term.tags.has(tag) === true) {
    return null
  }
  // allow this shorthand in multiple-tag strings
  if (tag === '.') {
    return null
  }
  // don't overwrite any tags, if term is frozen
  if (term.frozen === true) {
    isSafe = true
  }
  // for known tags, do logical dependencies first
  let known = tagSet[tag]
  if (known) {
    // first, we remove any conflicting tags
    if (known.not && known.not.length > 0) {
      for (let o = 0; o < known.not.length; o += 1) {
        // if we're in tagSafe, skip this term.
        if (isSafe === true && term.tags.has(known.not[o])) {
          return null
        }
        term.tags.delete(known.not[o])
      }
    }
    // add parent tags
    if (known.parents && known.parents.length > 0) {
      for (let o = 0; o < known.parents.length; o += 1) {
        term.tags.add(known.parents[o])
        addChunk(term, known.parents[o])
      }
    }
  }
  // finally, add our tag
  term.tags.add(tag)
  // now it's dirty?
  term.dirty = true
  // add a chunk too, if it's easy
  addChunk(term, tag)
  return true
}

// support '#Noun . #Adjective' syntax
const multiTag = function (terms, tagString, tagSet, isSafe) {
  let tags = tagString.split(isMulti)
  terms.forEach((term, i) => {
    let tag = tags[i]
    if (tag) {
      tag = tag.replace(/^#/, '')
      tagTerm(term, tag, tagSet, isSafe)
    }
  })
}

const isArray = function (arr) {
  return Object.prototype.toString.call(arr) === '[object Array]'
}

// verbose-mode tagger debuging
const log = (terms, tag, reason = '') => {
  const yellow = str => '\x1b[33m\x1b[3m' + str + '\x1b[0m'
  const i = str => '\x1b[3m' + str + '\x1b[0m'
  let word = terms
    .map(t => {
      return t.text || '[' + t.implicit + ']'
    })
    .join(' ')
  if (typeof tag !== 'string' && tag.length > 2) {
    tag = tag.slice(0, 2).join(', #') + ' +' //truncate the list of tags
  }
  tag = typeof tag !== 'string' ? tag.join(', #') : tag
  console.log(` ${yellow(word).padEnd(24)} \x1b[32m→\x1b[0m #${tag.padEnd(22)}  ${i(reason)}`) // eslint-disable-line
}

// add a tag to all these terms
const setTag = function (terms, tag, world = {}, isSafe, reason) {
  const tagSet = world.model.one.tagSet || {}
  if (!tag) {
    return
  }
  // some logging for debugging
  const env = typeof process === 'undefined' || !process.env ? self.env || {} : process.env
  if (env && env.DEBUG_TAGS) {
    log(terms, tag, reason)
  }
  if (isArray(tag) === true) {
    tag.forEach(tg => setTag(terms, tg, world, isSafe))
    return
  }
  if (typeof tag !== 'string') {
    console.warn(`compromise: Invalid tag '${tag}'`) // eslint-disable-line
    return
  }
  tag = tag.trim()
  // support '#Noun . #Adjective' syntax
  if (isMulti.test(tag)) {
    multiTag(terms, tag, tagSet, isSafe)
    return
  }
  tag = tag.replace(/^#/, '')
  // let set = false
  for (let i = 0; i < terms.length; i += 1) {
    tagTerm(terms[i], tag, tagSet, isSafe)
  }
}
export default setTag
