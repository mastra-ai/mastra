const byComma = function (doc) {
  let commas = doc.match('@hasComma')
  // remove any non-clause uses
  commas = commas.filter(m => {
    // don't split the first word
    if (m.growLeft('.').wordCount() === 1) {
      return false
    }
    // don't split the last word
    if (m.growRight('. .').wordCount() === 1) {
      return false
    }
    let more = m.grow('.') // grow by 1 word in either direction
    more = more.ifNo('@hasComma @hasComma') //fun, cool...
    more = more.ifNo('@hasComma (and|or) .') //cool, and fun
    more = more.ifNo('(#City && @hasComma) #Country') //'toronto, canada'
    more = more.ifNo('(#WeekDay && @hasComma) #Date') //'tuesday, march 2nd'
    more = more.ifNo('(#Date+ && @hasComma) #Value') //'july 6, 1992'
    more = more.ifNo('(#Adjective && @hasComma) #Adjective') //nice, pretty
    // more = more.ifNo('@hasComma (too|also)$') //at end of sentence
    return more.found
  })
  return doc.splitAfter(commas)
}

// should we split-out a clause (in brackets)?
const splitParentheses = function (doc) {
  let matches = doc.parentheses()
  matches = matches.filter(m => {
    return m.wordCount() >= 3 && m.has('#Verb') && m.has('#Noun')
  })
  return doc.splitOn(matches)
}

// split-out a long quotion, but not 'inline quotes'.
const splitQuotes = function (doc) {
  let matches = doc.quotations()
  matches = matches.filter(m => {
    return m.wordCount() >= 3 && m.has('#Verb') && m.has('#Noun')
  })
  return doc.splitOn(matches)
}

const clauses = function (n) {
  let found = this

  found = splitParentheses(found)
  found = splitQuotes(found)

  found = byComma(found)

  found = found.splitAfter('(@hasEllipses|@hasSemicolon|@hasDash|@hasColon)')

  // i said
  found = found.splitAfter('^#Pronoun (said|says)')
  // ... said John.
  found = found.splitBefore('(said|says) #ProperNoun$')

  // ... if it was
  found = found.splitBefore('. . if .{4}')

  // various conjunctions
  found = found.splitBefore('and while')
  found = found.splitBefore('now that')
  found = found.splitBefore('ever since')
  found = found.splitBefore('(supposing|although)')
  found = found.splitBefore('even (while|if|though)')
  found = found.splitBefore('(whereas|whose)')
  // found = found.splitBefore('as (far|long|much|soon) as')
  found = found.splitBefore('as (though|if)')
  found = found.splitBefore('(til|until)')

  // it is cool but it is ..
  let m = found.match('#Verb .* [but] .* #Verb', 0)
  if (m.found) {
    found = found.splitBefore(m)
  }
  // it is cool and it is ..
  // let conjunctions = found.if('#Copula #Adjective #Conjunction (#Pronoun|#Determiner) #Verb').match('#Conjunction')
  // found = found.splitBefore(conjunctions)

  // if it is this then that
  let condition = found.if('if .{2,9} then .').match('then')
  found = found.splitBefore(condition)

  // // misc clause partitions
  // found = found.splitBefore('as well as .')
  // found = found.splitBefore('such as .')
  // found = found.splitBefore('in addition to .')

  // // semicolons, dashes
  // found = found.splitAfter('@hasSemicolon')
  // found = found.splitAfter('@hasDash')

  // //
  // found = found.splitBefore('which (were|are|will)')

  // // he said [...]
  // found = found.splitAfter('#Noun (said|say|says)')

  // passive voice verb - '.. which was robbed is empty'
  // let passive = found.match('#Noun (which|that) (was|is) #Adverb? #PastTense #Adverb?')
  // if (passive.found) {
  //   found = found.splitAfter(passive)
  // }
  // //which the boy robbed
  // passive = found.match('#Noun (which|that) the? #Noun+ #Adverb? #PastTense #Adverb?')
  // if (passive.found) {
  //   found = found.splitAfter(passive)
  // }
  // does there appear to have relative/subordinate clause still?
  // let tooLong = found.filter(d => d.wordCount() > 5 && d.match('#Verb+').length >= 2)
  // if (tooLong.found) {
  //   // and after the ..
  //   found = found.splitBefore('#Conjunction #Preposition')

  //   // let m = tooLong.splitAfter('#Noun .* #Verb .* #Noun+')
  //   // found = found.splitOn(m.eq(0))
  // }
  if (typeof n === 'number') {
    found = found.get(n)
  }
  return found
}

export default clauses
