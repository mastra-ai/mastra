export default [
  // ==== Region ====
  // West Norforlk
  { match: '(west|north|south|east|western|northern|southern|eastern)+ #Place', tag: 'Region', reason: 'west-norfolk' },
  //some us-state acronyms (exlude: al, in, la, mo, hi, me, md, ok..)
  {
    match: '#City [(al|ak|az|ar|ca|ct|dc|fl|ga|id|il|nv|nh|nj|ny|oh|pa|sc|tn|tx|ut|vt|pr)]',
    group: 0,
    tag: 'Region',
    reason: 'us-state',
  },
  // portland oregon
  { match: 'portland [or]', group: 0, tag: 'Region', reason: 'portland-or' },
  //words removed from preTagger/placeWords
  {
    match: '#ProperNoun+ (cliff|place|range|pit|place|point|room|grounds|ruins)',
    tag: 'Place',
    reason: 'foo-point',
  },
  // in Foo California
  { match: 'in [#ProperNoun] #Place', group: 0, tag: 'Place', reason: 'propernoun-place' },
  // Address
  {
    match: '#Value #Noun (st|street|rd|road|crescent|cr|way|tr|terrace|avenue|ave)',
    tag: 'Address',
    reason: 'address-st',
  },
  // port dover
  { match: '(port|mount|mt) #ProperName', tag: 'Place', reason: 'port-name' },
  // generic 'oak ridge' names
  // { match: '(oak|maple|spruce|pine|cedar|willow|green|sunset|sunrise) #Place', tag: 'Place', reason: 'tree-name' },
  // generic 'sunset view' names
  // { match: '() #Place', tag: 'Place', reason: 'tree-name' },

  // Sports Arenas and Complexs
  // {
  //   match:
  //     '(#Place+|#Place|#ProperNoun) (memorial|athletic|community|financial)? (sportsplex|stadium|sports centre|sports field|soccer complex|soccer centre|sports complex|civic centre|centre|arena|gardens|complex|coliseum|auditorium|place|building)',
  //   tag: 'Place',
  //   reason: 'sport-complex',
  // },
]
