const hasContraction = /'/

const hadWords = new Set([
  'better', //had better
  'done', //had done
  'before', // he'd _ before
  'it', // he'd _ it
  'had', //she'd had -> she would have..
])

const wouldWords = new Set([
  'have', // 'i'd have' -> i would have..
  'be', //' she'd be'
])

//look for a past-tense verb
// You'd mentioned -> you had mentioned
// You'd mention -> you would mention
const hadOrWould = (terms, i) => {
  // scan ahead
  for (let o = i + 1; o < terms.length; o += 1) {
    let t = terms[o]
    // you'd better go
    if (hadWords.has(t.normal)) {
      return 'had'
    }
    // we'd have
    if (wouldWords.has(t.normal)) {
      return 'would'
    }
    // You'd mentioned -> you had mentioned
    if (t.tags.has('PastTense') || t.switch === 'Adj|Past') {
      return 'had'
    }
    // You'd mention -> you would mention
    if (t.tags.has('PresentTense') || t.tags.has('Infinitive')) {
      return 'would'
    }
    // i'd an issue
    if (t.tags.has('#Determiner')) {
      return 'had'
    }
    if (t.tags.has('Adjective')) {
      return 'would'
    }
  }
  return false
}

// he'd walked -> had
// how'd -> did
// he'd go -> would
const _apostropheD = function (terms, i) {
  let before = terms[i].normal.split(hasContraction)[0]
  // what'd, how'd
  if (before === 'how' || before === 'what') {
    return [before, 'did']
  }
  if (hadOrWould(terms, i) === 'had') {
    return [before, 'had']
  }
  // had/would/did
  return [before, 'would']
}
export default _apostropheD
