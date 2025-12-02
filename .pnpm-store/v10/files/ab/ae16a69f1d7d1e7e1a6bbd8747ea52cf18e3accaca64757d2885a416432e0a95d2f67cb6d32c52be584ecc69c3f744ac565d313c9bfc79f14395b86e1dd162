// ==== Passive voice ===
export default [
  // got walked, was walked, were walked
  { match: '(got|were|was|is|are|am) (#PastTense|#Participle)', tag: 'Passive', reason: 'got-walked' },
  // was being walked
  { match: '(was|were|is|are|am) being (#PastTense|#Participle)', tag: 'Passive', reason: 'was-being' },
  // had been walked, have been eaten
  { match: '(had|have|has) been (#PastTense|#Participle)', tag: 'Passive', reason: 'had-been' },
  // will be cleaned
  { match: 'will be being? (#PastTense|#Participle)', tag: 'Passive', reason: 'will-be-cleaned' },
  // suffered by the country
  { match: '#Noun [(#PastTense|#Participle)] by (the|a) #Noun', group: 0, tag: 'Passive', reason: 'suffered-by' },

]