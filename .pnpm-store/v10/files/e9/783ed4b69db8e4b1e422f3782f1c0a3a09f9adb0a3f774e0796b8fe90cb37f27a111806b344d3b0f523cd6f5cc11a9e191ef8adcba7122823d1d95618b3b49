export default [
  // ==== Phrasal ====
  //'foo-up'
  { match: '(#Verb && @hasHyphen) up', tag: 'PhrasalVerb', reason: 'foo-up' },
  { match: '(#Verb && @hasHyphen) off', tag: 'PhrasalVerb', reason: 'foo-off' },
  { match: '(#Verb && @hasHyphen) over', tag: 'PhrasalVerb', reason: 'foo-over' },
  { match: '(#Verb && @hasHyphen) out', tag: 'PhrasalVerb', reason: 'foo-out' },
  // walk in on
  {
    match: '[#Verb (in|out|up|down|off|back)] (on|in)',
    notIf: '#Copula',
    tag: 'PhrasalVerb Particle',
    reason: 'walk-in-on',
  },
  // went on for
  { match: '(lived|went|crept|go) [on] for', group: 0, tag: 'PhrasalVerb', reason: 'went-on' },
  // the curtains come down
  { match: '#Verb (up|down|in|on|for)$', tag: 'PhrasalVerb #Particle', notIf: '#PhrasalVerb', reason: 'come-down$' },
  // got me thinking
  // { match: '(got|had) me [#Noun]', group: 0, tag: 'Verb', reason: 'got-me-gerund' },
  // help stop
  { match: 'help [(stop|end|make|start)]', group: 0, tag: 'Infinitive', reason: 'help-stop' },
  // work in the office
  { match: '#PhrasalVerb (in && #Particle) #Determiner', tag: '#Verb #Preposition #Determiner', unTag: 'PhrasalVerb', reason: 'work-in-the' },
  // start listening
  { match: '[(stop|start|finish|help)] #Gerund', group: 0, tag: 'Infinitive', reason: 'start-listening' },
  // mis-fired
  // { match: '[(mis)] #Verb', group: 0, tag: 'Verb', reason: 'mis-firedsa' },
  //back it up
  {
    match: '#Verb (him|her|it|us|himself|herself|itself|everything|something) [(up|down)]',
    group: 0,
    tag: 'Adverb',
    reason: 'phrasal-pronoun-advb',
  },
]
