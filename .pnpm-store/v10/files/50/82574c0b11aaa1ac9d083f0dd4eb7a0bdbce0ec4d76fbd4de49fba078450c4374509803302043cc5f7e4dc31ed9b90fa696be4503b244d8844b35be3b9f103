const isTitleCase = /^[A-Z][a-z]/

const isCapital = (terms, i) => {
  if (terms[i].tags.has('ProperNoun') && isTitleCase.test(terms[i].text)) {// 'Comfort Inn'
    return 'Noun'
  }
  return null
}

const isAlone = (terms, i, tag) => {
  if (i === 0 && !terms[1]) {// 'Help'
    return tag
  }
  return null
}

// 'a rental'
const isEndNoun = function (terms, i) {
  if (!terms[i + 1] && terms[i - 1] && terms[i - 1].tags.has('Determiner')) {
    return 'Noun'
  }
  return null
}

// the first word in the sentence
const isStart = function (terms, i, tag) {
  if (i === 0 && terms.length > 3) {
    return tag
  }
  return null
}

const adhoc = {
  'Adj|Gerund': (terms, i) => {
    return isCapital(terms, i)
  },
  'Adj|Noun': (terms, i) => {
    return isCapital(terms, i) || isEndNoun(terms, i)
  },
  'Actor|Verb': (terms, i) => {
    return isCapital(terms, i)
  },
  'Adj|Past': (terms, i) => {
    return isCapital(terms, i)
  },
  'Adj|Present': (terms, i) => {
    return isCapital(terms, i)
  },
  'Noun|Gerund': (terms, i) => {
    return isCapital(terms, i)
  },
  'Noun|Verb': (terms, i) => {
    return (i > 0 && isCapital(terms, i)) || isAlone(terms, i, 'Infinitive')
  },
  'Plural|Verb': (terms, i) => {
    return isCapital(terms, i) || isAlone(terms, i, 'PresentTense') || isStart(terms, i, 'Plural')
  },
  'Person|Noun': (terms, i) => {
    return isCapital(terms, i)
  },
  'Person|Verb': (terms, i) => {
    if (i !== 0) {
      return isCapital(terms, i)
    }
    return null
  },
  'Person|Adj': (terms, i) => {
    if (i === 0 && terms.length > 1) {
      return 'Person'
    }
    return isCapital(terms, i) ? 'Person' : null
  },
}
export default adhoc