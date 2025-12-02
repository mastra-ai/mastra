const adverbAdj = `(dark|bright|flat|light|soft|pale|dead|dim|faux|little|wee|sheer|most|near|good|extra|all)`
const noLy = '(hard|fast|late|early|high|right|deep|close|direct)'

export default [
  // kinda sparkly
  { match: `#Adverb [#Adverb] (and|or|then)`, group: 0, tag: 'Adjective', reason: 'kinda-sparkly-and' },
  // dark green
  { match: `[${adverbAdj}] #Adjective`, group: 0, tag: 'Adverb', reason: 'dark-green' },
  // far too
  { match: `#Copula [far too] #Adjective`, group: 0, tag: 'Adverb', reason: 'far-too' },
  // was still in
  { match: `#Copula [still] (in|#Gerund|#Adjective)`, group: 0, tag: 'Adverb', reason: 'was-still-walking' },
  // studies hard
  { match: `#Plural ${noLy}`, tag: '#PresentTense #Adverb', reason: 'studies-hard' },
  // shops direct
  {
    match: `#Verb [${noLy}] !#Noun?`,
    group: 0,
    notIf: '(#Copula|get|got|getting|become|became|becoming|feel|feels|feeling|#Determiner|#Preposition)',
    tag: 'Adverb',
    reason: 'shops-direct',
  },
  // studies a lot
  { match: `[#Plural] a lot`, tag: 'PresentTense', reason: 'studies-a-lot' },
]
