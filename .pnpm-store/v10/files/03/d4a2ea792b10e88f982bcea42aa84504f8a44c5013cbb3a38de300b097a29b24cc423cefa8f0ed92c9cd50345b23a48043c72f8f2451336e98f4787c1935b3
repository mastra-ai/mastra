/** return anything tagged as a phone number */
const phoneNumbers = function (n) {
  let m = this.splitAfter('@hasComma')
  m = m.match('#PhoneNumber+')
  m = m.getNth(n)
  return m
}

// setup easy helper methods
const selections = [
  ['hyphenated', '@hasHyphen .'],
  ['hashTags', '#HashTag'],
  ['emails', '#Email'],
  ['emoji', '#Emoji'],
  ['emoticons', '#Emoticon'],
  ['atMentions', '#AtMention'],
  ['urls', '#Url'],
  // ['pronouns', '#Pronoun'],
  ['conjunctions', '#Conjunction'],
  ['prepositions', '#Preposition'],
  ['abbreviations', '#Abbreviation'],
  ['honorifics', '#Honorific'],
]

// aliases
let aliases = [
  ['emojis', 'emoji'],
  ['atmentions', 'atMentions'],
]

const addMethods = function (View) {
  // add a list of new helper methods
  selections.forEach(a => {
    View.prototype[a[0]] = function (n) {
      let m = this.match(a[1])
      return typeof n === 'number' ? m.get(n) : m
    }
  })
  View.prototype.phoneNumbers = phoneNumbers
  // add aliases
  aliases.forEach(a => {
    View.prototype[a[0]] = View.prototype[a[1]]
  })
}

export default addMethods
