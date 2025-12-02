export default [
  // #coolguy
  [/^#[\p{Number}_]*\p{Letter}/u, 'HashTag'], // can't be all numbers

  // @spencermountain
  [/^@\w{2,}$/, 'AtMention'],

  // period-ones acronyms - f.b.i.
  [/^([A-Z]\.){2}[A-Z]?/i, ['Acronym', 'Noun'], 'F.B.I'], //ascii-only

  // ending-apostrophes
  [/.{3}[lkmnp]in['‘’‛‵′`´]$/, 'Gerund', "chillin'"],
  [/.{4}s['‘’‛‵′`´]$/, 'Possessive', "flanders'"],

  //from https://www.regextester.com/106421
  // [/^([\u00a9\u00ae\u2319-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/, 'Emoji', 'emoji-range']
  // unicode character range
  [/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u, 'Emoji', 'emoji-class'],
]
