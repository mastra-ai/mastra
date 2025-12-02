// import orgWords from './_orgWords.js'
// let orgMap = `(${orgWords.join('|')})`

/*
const multi = [
  'building society',
  'central bank',
  'department store',
  'institute of technology',
  'liberation army',
  'people party',
  'social club',
  'state police',
  'state university',
]
*/

export default [
  // Foo University
  // { match: `#Noun ${orgMap}`, tag: 'Organization', safe: true, reason: 'foo-university' },
  // // University of Toronto
  // { match: `${orgMap} of #Place`, tag: 'Organization', safe: true, reason: 'university-of-foo' },

  // // foo regional health authority
  // { match: `${orgMap} (health|local|regional)+ authority`, tag: 'Organization', reason: 'regional-health' },
  // // foo stock exchange
  // { match: `${orgMap} (stock|mergantile)+ exchange`, tag: 'Organization', reason: 'stock-exchange' },
  // // foo news service
  // { match: `${orgMap} (daily|evening|local)+ news service?`, tag: 'Organization', reason: 'foo-news' },
  //University of Foo
  { match: 'university of #Place', tag: 'Organization', reason: 'university-of-Foo' },
  //John & Joe's
  { match: '#Noun (&|n) #Noun', tag: 'Organization', reason: 'Noun-&-Noun' },
  // teachers union of Ontario
  { match: '#Organization of the? #ProperNoun', tag: 'Organization', reason: 'org-of-place', safe: true },
  //walmart USA
  { match: '#Organization #Country', tag: 'Organization', reason: 'org-country' },
  //organization
  { match: '#ProperNoun #Organization', tag: 'Organization', notIf: '#FirstName', reason: 'titlecase-org' },
  //FitBit Inc
  { match: '#ProperNoun (ltd|co|inc|dept|assn|bros)', tag: 'Organization', reason: 'org-abbrv' },
  // the OCED
  { match: 'the [#Acronym]', group: 0, tag: 'Organization', reason: 'the-acronym', safe: true },
  // government of india
  { match: 'government of the? [#Place+]', tag: 'Organization', reason: 'government-of-x' },
  // school board
  { match: '(health|school|commerce) board', tag: 'Organization', reason: 'school-board' },
  // special comittee
  {
    match: '(nominating|special|conference|executive|steering|central|congressional) committee',
    tag: 'Organization',
    reason: 'special-comittee',
  },
  // global trade union
  {
    match: '(world|global|international|national|#Demonym) #Organization',
    tag: 'Organization',
    reason: 'global-org',
  },
  // schools
  { match: '#Noun+ (public|private) school', tag: 'School', reason: 'noun-public-school' },
  // new york yankees
  { match: '#Place+ #SportsTeam', tag: 'SportsTeam', reason: 'place-sportsteam' },
  // 'manchester united'
  {
    match: '(dc|atlanta|minnesota|manchester|newcastle|sheffield) united',
    tag: 'SportsTeam',
    reason: 'united-sportsteam',
  },
  // 'toronto fc'
  { match: '#Place+ fc', tag: 'SportsTeam', reason: 'fc-sportsteam' },

  // baltimore quilting club
  {
    match: '#Place+ #Noun{0,2} (club|society|group|team|committee|commission|association|guild|crew)',
    tag: 'Organization',
    reason: 'place-noun-society',
  },
]
