// transformations to make on our lexicon
export default {
  // add plural forms of singular nouns
  Singular: (word, lex, methods, model) => {
    let already = model.one.lexicon
    let plural = methods.two.transform.noun.toPlural(word, model)
    if (!already[plural]) {
      lex[plural] = lex[plural] || 'Plural'
    }
  },
  // 'lawyer', 'manager' plural forms
  Actor: (word, lex, methods, model) => {
    let already = model.one.lexicon
    let plural = methods.two.transform.noun.toPlural(word, model)
    if (!already[plural]) {
      lex[plural] = lex[plural] || ['Plural', 'Actor']
    }
  },

  // superlative/ comparative forms for adjectives
  Comparable: (word, lex, methods, model) => {
    let already = model.one.lexicon
    let { toSuperlative, toComparative } = methods.two.transform.adjective
    // fast -> fastest
    let sup = toSuperlative(word, model)
    if (!already[sup]) {
      lex[sup] = lex[sup] || 'Superlative'
    }
    // fast -> faster
    let comp = toComparative(word, model)
    if (!already[comp]) {
      lex[comp] = lex[comp] || 'Comparative'
    }
    // overwrite
    lex[word] = 'Adjective'
  },

  // 'german' -> 'germans'
  Demonym: (word, lex, methods, model) => {
    let plural = methods.two.transform.noun.toPlural(word, model)
    lex[plural] = lex[plural] || ['Demonym', 'Plural']
  },

  // conjugate all forms of these verbs
  Infinitive: (word, lex, methods, model) => {
    let already = model.one.lexicon
    let all = methods.two.transform.verb.conjugate(word, model)
    Object.entries(all).forEach(a => {
      if (!already[a[1]] && !lex[a[1]] && a[0] !== 'FutureTense') {
        lex[a[1]] = a[0]
      }
    })
  },

  // 'walk up' should conjugate, too
  PhrasalVerb: (word, lex, methods, model) => {
    let already = model.one.lexicon
    lex[word] = ['PhrasalVerb', 'Infinitive']
    let _multi = model.one._multiCache
    let [inf, rest] = word.split(' ')
    // add root verb
    if (!already[inf]) {
      lex[inf] = lex[inf] || 'Infinitive'
    }
    // conjugate it
    let all = methods.two.transform.verb.conjugate(inf, model)
    delete all.FutureTense
    Object.entries(all).forEach(a => {
      // not 'walker up', or 'had taken up'
      if (a[0] === 'Actor' || a[1] === '') {
        return
      }
      // add the root verb, alone
      if (!lex[a[1]] && !already[a[1]]) {
        lex[a[1]] = a[0]
      }
      _multi[a[1]] = 2
      let str = a[1] + ' ' + rest
      lex[str] = lex[str] || [a[0], 'PhrasalVerb']
    })
  },

  // expand 'million'
  Multiple: (word, lex) => {
    lex[word] = ['Multiple', 'Cardinal']
    // 'millionth'
    lex[word + 'th'] = ['Multiple', 'Ordinal']
    // 'millionths'
    lex[word + 'ths'] = ['Multiple', 'Fraction']
  },
  // expand number-words
  Cardinal: (word, lex) => {
    lex[word] = ['TextValue', 'Cardinal']
  },

  // 'millionth'
  Ordinal: (word, lex) => {
    lex[word] = ['TextValue', 'Ordinal']
    lex[word + 's'] = ['TextValue', 'Fraction']
  },
  // 'thames'
  Place: (word, lex) => {
    lex[word] = ['Place', 'ProperNoun']
  },
  // 'ontario'
  Region: (word, lex) => {
    lex[word] = ['Region', 'ProperNoun']
  },
}
