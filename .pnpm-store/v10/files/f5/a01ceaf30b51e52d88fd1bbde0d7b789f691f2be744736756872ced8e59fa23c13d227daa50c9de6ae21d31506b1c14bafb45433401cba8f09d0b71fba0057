//parse a string like "4,200.1" into Number 4200.1
const parseNumeric = str => {
  //remove ordinal - 'th/rd'
  str = str.replace(/1st$/, '1')
  str = str.replace(/2nd$/, '2')
  str = str.replace(/3rd$/, '3')
  str = str.replace(/([4567890])r?th$/, '$1')
  //remove prefixes
  str = str.replace(/^[$€¥£¢]/, '')
  //remove suffixes
  str = str.replace(/[%$€¥£¢]$/, '')
  //remove commas
  str = str.replace(/,/g, '')
  //split '5kg' from '5'
  str = str.replace(/([0-9])([a-z\u00C0-\u00FF]{1,2})$/, '$1')
  return str
}

export default parseNumeric
