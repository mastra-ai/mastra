export default [

  //swear-words as non-expression POS
  { match: 'holy (shit|fuck|hell)', tag: 'Expression', reason: 'swears-expression' },
  // well..
  { match: '^[(well|so|okay|now)] !#Adjective?', group: 0, tag: 'Expression', reason: 'well-' },
  // well..
  { match: '^come on', tag: 'Expression', reason: 'come-on' },
  // sorry
  { match: '(say|says|said) [sorry]', group: 0, tag: 'Expression', reason: 'say-sorry' },
  // ok,
  { match: '^(ok|alright|shoot|hell|anyways)', tag: 'Expression', reason: 'ok-' },
  // c'mon marge..
  // { match: '^[come on] #Noun', group: 0, tag: 'Expression', reason: 'come-on' },
  // say,
  { match: '^(say && @hasComma)', tag: 'Expression', reason: 'say-' },
  { match: '^(like && @hasComma)', tag: 'Expression', reason: 'like-' },
  // dude we should
  { match: '^[(dude|man|girl)] #Pronoun', group: 0, tag: 'Expression', reason: 'dude-i' },
]