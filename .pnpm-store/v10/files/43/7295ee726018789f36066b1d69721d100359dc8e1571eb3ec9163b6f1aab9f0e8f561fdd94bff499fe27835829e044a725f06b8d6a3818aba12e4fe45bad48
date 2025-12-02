// import { toPast, toPresent, toGerund, toParticiple } from '../../../../model/models/index.js'
import { convert } from 'suffix-thumb'

// pull-apart phrasal verb 'fall over'
const parse = (inf) => {
  if (/ /.test(inf)) {
    return inf.split(/ /)
  }
  return [inf, '']
}

//we run this on every verb in the lexicon, so please keep it fast
//we assume the input word is a proper infinitive
const conjugate = function (inf, model) {
  const { toPast, toPresent, toGerund, toParticiple } = model.two.models
  // ad-hoc Copula response
  if (inf === 'be') {
    return {
      Infinitive: inf,
      Gerund: 'being',
      PastTense: 'was',
      PresentTense: 'is',
    }
  }
  let [str, particle] = parse(inf)
  let found = {
    Infinitive: str,
    PastTense: convert(str, toPast),
    PresentTense: convert(str, toPresent),
    Gerund: convert(str, toGerund),
    FutureTense: 'will ' + str
  }
  // add past-participle if it's interesting
  // drive -> driven (not drove)
  let pastPrt = convert(str, toParticiple)
  if (pastPrt !== inf && pastPrt !== found.PastTense) {
    // ensure it's a known participle
    let lex = model.one.lexicon || {}
    if (lex[pastPrt] === 'Participle' || lex[pastPrt] === 'Adjective') {
      // one exception
      if (inf === 'play') {
        pastPrt = 'played'
      }
      found.Participle = pastPrt
    }
  }
  // put phrasal-verbs back together again
  if (particle) {
    Object.keys(found).forEach(k => {
      found[k] += ' ' + particle
    })
  }
  return found
}


export default conjugate

// console.log(toPresent.rules.y)
// console.log(convert('buy', toPresent))

