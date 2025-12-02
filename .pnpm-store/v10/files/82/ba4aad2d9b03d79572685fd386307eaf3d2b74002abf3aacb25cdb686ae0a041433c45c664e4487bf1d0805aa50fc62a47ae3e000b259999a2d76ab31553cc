// const personAdj = '(misty|rusty|dusty|rich|randy|sandy|young|earnest|frank|brown)'

export default [
  // ebenezer scrooge
  {
    match: '#FirstName #Noun$',
    tag: '. #LastName',
    notIf: '(#Possessive|#Organization|#Place|#Pronoun|@hasTitleCase)',
    reason: 'firstname-noun',
  },

  // ===person-date===
  { match: '%Person|Date% #Acronym? #ProperNoun', tag: 'Person', reason: 'jan-thierson' },
  // ===person-noun===
  //Cliff Clavin
  { match: '%Person|Noun% #Acronym? #ProperNoun', tag: 'Person', reason: 'switch-person', safe: true },
  // olive garden
  { match: '%Person|Noun% #Organization', tag: 'Organization', reason: 'olive-garden' },
  // ===person-verb===
  // ollie faroo
  { match: '%Person|Verb% #Acronym? #ProperNoun', tag: 'Person', reason: 'verb-propernoun', ifNo: '#Actor' },
  // chuck will ...
  {
    match: `[%Person|Verb%] (will|had|has|said|says|told|did|learned|wants|wanted)`,
    group: 0,
    tag: 'Person',
    reason: 'person-said',
  },

  // ===person-place===
  //sydney harbour
  {
    match: `[%Person|Place%] (harbor|harbour|pier|town|city|place|dump|landfill)`,
    group: 0,
    tag: 'Place',
    reason: 'sydney-harbour',
  },
  // east sydney
  { match: `(west|east|north|south) [%Person|Place%]`, group: 0, tag: 'Place', reason: 'east-sydney' },

  // ===person-adjective===
  // rusty smith
  // { match: `${personAdj} #Person`, tag: 'Person', reason: 'randy-smith' },
  // rusty a. smith
  // { match: `${personAdj} #Acronym? #ProperNoun`, tag: 'Person', reason: 'rusty-smith' },
  // very rusty
  // { match: `#Adverb [${personAdj}]`, group: 0, tag: 'Adjective', reason: 'really-rich' },

  // ===person-verb===
  // would wade
  { match: `#Modal [%Person|Verb%]`, group: 0, tag: 'Verb', reason: 'would-mark' },
  // really wade
  { match: `#Adverb [%Person|Verb%]`, group: 0, tag: 'Verb', reason: 'really-mark' },
  // drew closer
  { match: `[%Person|Verb%] (#Adverb|#Comparative)`, group: 0, tag: 'Verb', reason: 'drew-closer' },
  // wade smith
  { match: `%Person|Verb% #Person`, tag: 'Person', reason: 'rob-smith' },
  // wade m. Cooper
  { match: `%Person|Verb% #Acronym #ProperNoun`, tag: 'Person', reason: 'rob-a-smith' },
  // will go
  { match: '[will] #Verb', group: 0, tag: 'Modal', reason: 'will-verb' },
  // will Pharell
  { match: '(will && @isTitleCase) #ProperNoun', tag: 'Person', reason: 'will-name' },
  // jack layton won
  {
    match: '(#FirstName && !#Possessive) [#Singular] #Verb',
    group: 0,
    safe: true,
    tag: 'LastName',
    reason: 'jack-layton',
  },
  // sherwood anderson told
  { match: '^[#Singular] #Person #Verb', group: 0, safe: true, tag: 'Person', reason: 'sherwood-anderson' },
  // bought a warhol
  { match: '(a|an) [#Person]$', group: 0, unTag: 'Person', reason: 'a-warhol' },
]
