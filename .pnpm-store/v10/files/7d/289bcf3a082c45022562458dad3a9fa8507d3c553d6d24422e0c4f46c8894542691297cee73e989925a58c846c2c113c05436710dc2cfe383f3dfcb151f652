import forms from './forms.js'

const cleanUp = function (vb, res) {
  vb = vb.clone()
  // remove adverbs
  if (res.adverbs.post && res.adverbs.post.found) {
    vb.remove(res.adverbs.post)
  }
  if (res.adverbs.pre && res.adverbs.pre.found) {
    vb.remove(res.adverbs.pre)
  }
  // remove negatives
  if (vb.has('#Negative')) {
    vb = vb.remove('#Negative')
  }
  // remove prefixes like 'anti'
  if (vb.has('#Prefix')) {
    vb = vb.remove('#Prefix')
  }
  // cut-off phrasal-verb
  if (res.root.has('#PhrasalVerb #Particle')) {
    vb.remove('#Particle$')
  }
  // did we miss any of these?
  // vb = vb.remove('#Adverb')
  vb = vb.not('#Adverb')
  return vb
}

// 'learned [to code]'
const isInfinitive = function (vb) {
  if (vb.has('#Infinitive')) {
    let m = vb.growLeft('to')
    if (m.has('^to #Infinitive')) {
      return true
    }
  }
  return false
}

const getGrammar = function (vb, res) {
  let grammar = {}
  // make it easy to classify, first
  vb = cleanUp(vb, res)
  for (let i = 0; i < forms.length; i += 1) {
    let todo = forms[i]
    if (vb.has(todo.match) === true) {
      grammar.form = todo.name
      Object.assign(grammar, todo.data)
      break //only match one
    }
  }
  // did we find nothing?
  if (!grammar.form) {
    if (vb.has('^#Verb$')) {
      grammar.form = 'infinitive'
    }
  }
  // fallback to 'naiive' tense detection
  if (!grammar.tense) {
    grammar.tense = res.root.has('#PastTense') ? 'PastTense' : 'PresentTense'
  }
  grammar.copula = res.root.has('#Copula')
  // 'learn to code'
  grammar.isInfinitive = isInfinitive(vb)
  return grammar
}

export default getGrammar
