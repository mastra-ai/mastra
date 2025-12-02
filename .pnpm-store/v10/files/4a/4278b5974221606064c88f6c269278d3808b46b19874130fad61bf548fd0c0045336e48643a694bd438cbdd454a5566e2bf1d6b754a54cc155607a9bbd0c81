// case logic
const isTitleCase = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str) || /^\p{Lu}$/u.test(str)
const toTitleCase = (str) => str.replace(/^\p{Ll}/u, x => x.toUpperCase())
const toLowerCase = (str) => str.replace(/^\p{Lu}/u, x => x.toLowerCase())

// splice an array into an array
const spliceArr = (parent, index, child) => {
  // tag them as dirty
  child.forEach(term => term.dirty = true)
  if (parent) {
    let args = [index, 0].concat(child)
    Array.prototype.splice.apply(parent, args)
  }
  return parent
}

// add a space at end, if required
const endSpace = function (terms) {
  const hasSpace = / $/
  const hasDash = /[-–—]/
  let lastTerm = terms[terms.length - 1]
  if (lastTerm && !hasSpace.test(lastTerm.post) && !hasDash.test(lastTerm.post)) {
    lastTerm.post += ' '
  }
}

// sentence-ending punctuation should move in append
const movePunct = (source, end, needle) => {
  const juicy = /[-.?!,;:)–—'"]/g
  let wasLast = source[end - 1]
  if (!wasLast) {
    return
  }
  let post = wasLast.post
  if (juicy.test(post)) {
    let punct = post.match(juicy).join('') //not perfect
    let last = needle[needle.length - 1]
    last.post = punct + last.post
    // remove it, from source
    wasLast.post = wasLast.post.replace(juicy, '')
  }
}


const moveTitleCase = function (home, start, needle) {
  let from = home[start]
  // should we bother?
  if (start !== 0 || !isTitleCase(from.text)) {
    return
  }
  // titlecase new first term
  needle[0].text = toTitleCase(needle[0].text)
  // should we un-titlecase the old word?
  let old = home[start]
  if (old.tags.has('ProperNoun') || old.tags.has('Acronym')) {
    return
  }
  if (isTitleCase(old.text) && old.text.length > 1) {
    old.text = toLowerCase(old.text)
  }
}

// put these words before the others
const cleanPrepend = function (home, ptr, needle, document) {
  let [n, start, end] = ptr
  // introduce spaces appropriately
  if (start === 0) {
    // at start - need space in insert
    endSpace(needle)
  } else if (end === document[n].length) {
    // at end - need space in home
    endSpace(needle)
  } else {
    // in middle - need space in home and insert
    endSpace(needle)
    endSpace([home[ptr[1]]])
  }
  moveTitleCase(home, start, needle)
  // movePunct(home, end, needle)
  spliceArr(home, start, needle)
}

const cleanAppend = function (home, ptr, needle, document) {
  let [n, , end] = ptr
  let total = (document[n] || []).length
  if (end < total) {
    // are we in the middle?
    // add trailing space on self
    movePunct(home, end, needle)
    endSpace(needle)
  } else if (total === end) {
    // are we at the end?
    // add a space to predecessor
    endSpace(home)
    // very end, move period
    movePunct(home, end, needle)
    // is there another sentence after?
    if (document[n + 1]) {
      needle[needle.length - 1].post += ' '
    }
  }
  spliceArr(home, ptr[2], needle)
  // set new endId
  ptr[4] = needle[needle.length - 1].id
}

export { cleanPrepend, cleanAppend, spliceArr }
