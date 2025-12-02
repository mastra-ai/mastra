const banList = {
  that: true,
  there: true,
  let: true,
  here: true,
  everywhere: true,
}

const beforePossessive = {
  in: true, //in sunday's
  by: true, //by sunday's
  for: true, //for sunday's
}
let adjLike = new Set(['too', 'also', 'enough', 'about'])
let nounLike = new Set(['is', 'are', 'did', 'were', 'could', 'should', 'must', 'had', 'have'])

const isPossessive = (terms, i) => {
  let term = terms[i]
  // these can't be possessive
  if (banList.hasOwnProperty(term.machine || term.normal)) {
    return false
  }
  // if we already know it
  if (term.tags.has('Possessive')) {
    return true
  }
  // who's
  if (term.tags.has('QuestionWord')) {
    return false
  }
  // some pronouns are never possessive
  if (term.normal === `he's` || term.normal === `she's`) {
    return false
  }
  //if end of sentence, it is possessive - "was spencer's"
  let nextTerm = terms[i + 1]
  if (!nextTerm) {
    return true
  }
  // "it's a life" vs "run it's business"
  if (term.normal === `it's`) {
    if (nextTerm.tags.has('#Noun')) {
      return true
    }
    return false
  }
  // the sun's setting vs the artist's painting
  // gerund = is,  noun = possessive
  // (we are doing some dupe-work of the switch classifier here)
  if (nextTerm.switch == 'Noun|Gerund') {
    let next2 = terms[i + 2]
    // the artist's painting.
    if (!next2) {
      if (term.tags.has('Actor') || term.tags.has('ProperNoun')) {
        return true
      }
      return false
    }
    // the artist's painting is..
    if (next2.tags.has('Copula')) {
      return true
    }
    // the cat's sleeping on ..
    if (next2.normal === 'on' || next2.normal === 'in') {
      return false
    }
    return false
  }
  //a gerund suggests 'is walking'
  if (nextTerm.tags.has('Verb')) {
    //fix 'jamie's bite'
    if (nextTerm.tags.has('Infinitive')) {
      return true
    }
    //'jamaica's growing'
    if (nextTerm.tags.has('Gerund')) {
      return false
    }
    //fix 'spencer's runs'
    if (nextTerm.tags.has('PresentTense')) {
      return true
    }
    return false
  }

  // john's nuts
  if (nextTerm.switch === 'Adj|Noun') {
    let twoTerm = terms[i + 2]
    if (!twoTerm) {
      return false //adj
    }
    // john's nuts were..
    if (nounLike.has(twoTerm.normal)) {
      return true
    }
    // john's nuts about..
    if (adjLike.has(twoTerm.normal)) {
      return false //adj
    }
  }
  //spencer's house
  if (nextTerm.tags.has('Noun')) {
    let nextStr = nextTerm.machine || nextTerm.normal
    // 'spencer's here'
    if (nextStr === 'here' || nextStr === 'there' || nextStr === 'everywhere') {
      return false
    }
    // the chair's his
    if (nextTerm.tags.has('Possessive')) {
      return false
    }
    // the captain's John
    if (nextTerm.tags.has('ProperNoun') && !term.tags.has('ProperNoun')) {
      return false
    }
    return true
  }

  // by sunday's final
  if (terms[i - 1] && beforePossessive[terms[i - 1].normal] === true) {
    return true
  }

  // spencer's tired
  if (nextTerm.tags.has('Adjective')) {
    let twoTerm = terms[i + 2]
    //the rocket's red
    if (!twoTerm) {
      return false
    }
    // rocket's red nozzle
    if (twoTerm.tags.has('Noun') && !twoTerm.tags.has('Pronoun')) {
      //project's behind schedule
      let str = nextTerm.normal
      if (str === 'above' || str === 'below' || str === 'behind') {
        return false
      }
      return true
    }
    // rocket's red glare
    if (twoTerm.switch === 'Noun|Verb') {
      return true
    }
    //othwerwise, an adjective suggests 'is good'
    return false
  }
  // baby's first steps
  if (nextTerm.tags.has('Value')) {
    return true
  }
  // otherwise not possessive
  return false
}
export default isPossessive
