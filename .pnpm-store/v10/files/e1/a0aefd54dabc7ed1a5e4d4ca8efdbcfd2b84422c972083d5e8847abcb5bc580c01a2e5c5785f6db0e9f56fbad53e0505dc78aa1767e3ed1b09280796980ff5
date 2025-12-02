/* eslint-disable no-console */
import fillTags from './_fillTags.js'
const env = typeof process === 'undefined' || !process.env ? self.env || {} : process.env
import adhoc from './_adhoc.js'
const prefix = /^(under|over|mis|re|un|dis|semi)-?/

const checkWord = (term, obj) => {
  if (!term || !obj) {
    return null
  }
  let str = term.normal || term.implicit
  let found = null
  if (obj.hasOwnProperty(str)) {
    found = obj[str]
  }
  if (found && env.DEBUG_TAGS) {
    console.log(`\n  \x1b[2m\x1b[3m     ↓ - '${str}' \x1b[0m`)
  }
  return found
}

const checkTag = (term, obj = {}, tagSet) => {
  if (!term || !obj) {
    return null
  }
  // rough sort, so 'Noun' is after ProperNoun, etc
  let tags = Array.from(term.tags).sort((a, b) => {
    let numA = tagSet[a] ? tagSet[a].parents.length : 0
    let numB = tagSet[b] ? tagSet[b].parents.length : 0
    return numA > numB ? -1 : 1
  })
  let found = tags.find(tag => obj[tag])
  if (found && env.DEBUG_TAGS) {
    console.log(`  \x1b[2m\x1b[3m      ↓ - '${term.normal || term.implicit}' (#${found})  \x1b[0m`)
  }
  found = obj[found]
  return found
}

const pickTag = function (terms, i, clues, model) {
  if (!clues) {
    return null
  }
  const beforeIndex = terms[i - 1]?.text !== 'also' ? i - 1 : Math.max(0, i - 2)
  const tagSet = model.one.tagSet
  // look -> right word, first
  let tag = checkWord(terms[i + 1], clues.afterWords)
  // look <- left word, second
  tag = tag || checkWord(terms[beforeIndex], clues.beforeWords)
  // look <- left tag
  tag = tag || checkTag(terms[beforeIndex], clues.beforeTags, tagSet)
  // look -> right tag
  tag = tag || checkTag(terms[i + 1], clues.afterTags, tagSet)
  // console.log(clues)
  return tag
}

// words like 'bob' that can change between two tags
const doSwitches = function (terms, i, world) {
  const model = world.model
  const setTag = world.methods.one.setTag
  const { switches, clues } = model.two
  const term = terms[i]
  let str = term.normal || term.implicit || ''
  // support prefixes for switching words
  if (prefix.test(str) && !switches[str]) {
    str = str.replace(prefix, '') // could use some guards, here
  }
  if (term.switch) {
    let form = term.switch
    // skip propernouns, acronyms, etc
    if (term.tags.has('Acronym') || term.tags.has('PhrasalVerb')) {
      return
    }
    let tag = pickTag(terms, i, clues[form], model)
    // lean-harder on some variable forms
    if (adhoc[form]) {
      tag = adhoc[form](terms, i) || tag
    }
    // did we find anything?
    if (tag) {
      // tag it
      setTag([term], tag, world, null, `3-[switch] (${form})`)
      // add plural/singular etc.
      fillTags(terms, i, model)
    } else if (env.DEBUG_TAGS) {
      console.log(`\n -> X  - '${str}'  : (${form})  `)
    }
  }
}
export default doSwitches
