export default [
  { match: '#Money and #Money #Currency?', tag: 'Money', reason: 'money-and-money' },
  // 6 dollars and 5 cents
  { match: '#Value #Currency [and] #Value (cents|ore|centavos|sens)', group: 0, tag: 'money', reason: 'and-5-cents' },
  // maybe currencies
  { match: '#Value (mark|rand|won|rub|ore)', tag: '#Money #Currency', reason: '4-mark' },
  // 3 pounds
  { match: 'a pound', tag: '#Money #Unit', reason: 'a-pound' },
  { match: '#Value (pound|pounds)', tag: '#Money #Unit', reason: '4-pounds' },
]
