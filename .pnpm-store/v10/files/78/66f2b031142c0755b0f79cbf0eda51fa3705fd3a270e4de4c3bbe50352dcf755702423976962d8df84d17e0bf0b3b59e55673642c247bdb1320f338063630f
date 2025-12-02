const hasContraction = /'/

const hasWords = new Set([
  'been', //the meeting's been ..
  'become', //my son's become
])
const isWords = new Set([
  'what', //it's what
  'how', //it's how
  'when',
  'if', //it's if
  'too',
])
let adjLike = new Set(['too', 'also', 'enough'])

// the big clue is the tense of the following verb
const isOrHas = (terms, i) => {
  // scan ahead for the next verb or adjective
  for (let o = i + 1; o < terms.length; o += 1) {
    let t = terms[o]
    if (hasWords.has(t.normal)) {
      return 'has'
    }
    if (isWords.has(t.normal)) {
      return 'is'
    }
    // the cat's sleeping
    if (t.tags.has('Gerund')) {
      return 'is'
    }
    // she's the one
    if (t.tags.has('Determiner')) {
      return 'is'
    }
    // the food's ready
    if (t.tags.has('Adjective')) {
      return 'is'
    }
    // the car's parked
    if (t.switch === 'Adj|Past') {
      if (terms[o + 1]) {
        // car's parked too ..
        if (adjLike.has(terms[o + 1].normal)) {
          return 'is'
        }
        // car's parked on ..
        if (terms[o + 1].tags.has('Preposition')) {
          return 'is'
        }
      }
      // return 'is'
    }
    // The meeting's scheduled vs The plane's landed
    if (t.tags.has('PastTense')) {
      // meeting's scheduled for
      if (terms[o + 1] && terms[o + 1].normal === 'for') {
        return 'is'
      }
      return 'has'
    }
  }
  return 'is'
}

// 's -> [possessive, 'has', 'is', 'are', 'us']
const apostropheS = function (terms, i) {
  // possessive, is/has
  let before = terms[i].normal.split(hasContraction)[0]
  // let's - >[let, us]
  if (before === 'let') {
    return [before, 'us']
  }
  // allow slang "there's cookies" -> there are
  if (before === 'there') {
    let t = terms[i + 1]
    if (t && t.tags.has('Plural')) {
      return [before, 'are']
    }
  }
  // spencer's got -> spencer has got
  if (isOrHas(terms, i) === 'has') {
    return [before, 'has']
  }
  return [before, 'is']
}
export default apostropheS
