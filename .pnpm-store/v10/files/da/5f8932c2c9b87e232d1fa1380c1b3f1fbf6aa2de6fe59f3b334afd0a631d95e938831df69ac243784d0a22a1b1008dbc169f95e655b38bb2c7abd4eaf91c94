export default [
  // ==== Ambiguous numbers ====
  // 'second'
  { match: `#Cardinal [second]`, tag: 'Unit', reason: 'one-second' },
  //'a/an' can mean 1 - "a hour"
  {
    match: '!once? [(a|an)] (#Duration|hundred|thousand|million|billion|trillion)',
    group: 0,
    tag: 'Value',
    reason: 'a-is-one',
  },
  // ==== PhoneNumber ====
  //1 800 ...
  { match: '1 #Value #PhoneNumber', tag: 'PhoneNumber', reason: '1-800-Value' },
  //(454) 232-9873
  { match: '#NumericValue #PhoneNumber', tag: 'PhoneNumber', reason: '(800) PhoneNumber' },

  // ==== Currency ====
  // chinese yuan
  { match: '#Demonym #Currency', tag: 'Currency', reason: 'demonym-currency' },
  // ten bucks
  { match: '#Value [(buck|bucks|grand)]', group: 0, tag: 'Currency', reason: 'value-bucks' },
  // ==== Money ====
  { match: '[#Value+] #Currency', group: 0, tag: 'Money', reason: '15 usd' },

  // ==== Ordinal ====
  { match: '[second] #Noun', group: 0, tag: 'Ordinal', reason: 'second-noun' },

  // ==== Units ====
  //5 yan
  { match: '#Value+ [#Currency]', group: 0, tag: 'Unit', reason: '5-yan' },
  { match: '#Value [(foot|feet)]', group: 0, tag: 'Unit', reason: 'foot-unit' },
  //5 kg.
  { match: '#Value [#Abbreviation]', group: 0, tag: 'Unit', reason: 'value-abbr' },
  { match: '#Value [k]', group: 0, tag: 'Unit', reason: 'value-k' },
  { match: '#Unit an hour', tag: 'Unit', reason: 'unit-an-hour' },

  // ==== Magnitudes ====
  //minus 7
  { match: '(minus|negative) #Value', tag: 'Value', reason: 'minus-value' },
  //seven point five
  { match: '#Value (point|decimal) #Value', tag: 'Value', reason: 'value-point-value' },
  //quarter million
  { match: '#Determiner [(half|quarter)] #Ordinal', group: 0, tag: 'Value', reason: 'half-ordinal' },
  // thousand and two
  { match: `#Multiple+ and #Value`, tag: 'Value', reason: 'magnitude-and-value' },
  // ambiguous units like 'gb'
  // { match: '#Value square? [(kb|mb|gb|tb|ml|pt|qt|tbl|tbsp|km|cm|mm|mi|ft|yd|kg|hg|mg|oz|lb|mph|pa|miles|yard|yards|pound|pounds)]', group: 0, tag: 'Unit', reason: '12-gb' },
  // 5 miles per hour
  { match: '#Value #Unit [(per|an) (hr|hour|sec|second|min|minute)]', group: 0, tag: 'Unit', reason: '12-miles-per-second' },
  // 5 square miles
  { match: '#Value [(square|cubic)] #Unit', group: 0, tag: 'Unit', reason: 'square-miles' },
  // 5) The expenses
  // { match: '^[#Value] (#Determiner|#Gerund)', group: 0, tag: 'Expression', unTag: 'Value', reason: 'numbered-list' },
]
