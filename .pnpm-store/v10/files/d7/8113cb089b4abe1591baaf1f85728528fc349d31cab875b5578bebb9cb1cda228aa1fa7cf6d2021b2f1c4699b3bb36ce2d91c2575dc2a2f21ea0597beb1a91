export default [
  // half a penny
  { match: '[(half|quarter)] of? (a|an)', group: 0, tag: 'Fraction', reason: 'millionth' },
  // nearly half
  { match: '#Adverb [half]', group: 0, tag: 'Fraction', reason: 'nearly-half' },
  // half the
  { match: '[half] the', group: 0, tag: 'Fraction', reason: 'half-the' },
  // and a half
  { match: '#Cardinal and a half', tag: 'Fraction', reason: 'and-a-half' },
  // two-halves
  { match: '#Value (halves|halfs|quarters)', tag: 'Fraction', reason: 'two-halves' },

  // ---ordinals as fractions---
  // a fifth
  { match: 'a #Ordinal', tag: 'Fraction', reason: 'a-quarter' },
  // seven fifths
  { match: '[#Cardinal+] (#Fraction && /s$/)', tag: 'Fraction', reason: 'seven-fifths' },
  // doc.match('(#Fraction && /s$/)').lookBefore('#Cardinal+$').tag('Fraction')
  // one third of ..
  { match: '[#Cardinal+ #Ordinal] of .', group: 0, tag: 'Fraction', reason: 'ordinal-of' },
  // 100th of
  { match: '[(#NumericValue && #Ordinal)] of .', group: 0, tag: 'Fraction', reason: 'num-ordinal-of' },
  // a twenty fifth
  { match: '(a|one) #Cardinal?+ #Ordinal', tag: 'Fraction', reason: 'a-ordinal' },

  // //  '3 out of 5'
  { match: '#Cardinal+ out? of every? #Cardinal', tag: 'Fraction', reason: 'out-of' },
]

// {match:'', tag:'',reason:''},
