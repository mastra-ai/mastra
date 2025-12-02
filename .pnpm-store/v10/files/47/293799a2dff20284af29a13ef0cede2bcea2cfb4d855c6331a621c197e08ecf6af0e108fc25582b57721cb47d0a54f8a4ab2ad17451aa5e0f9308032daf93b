/*
  Important notice - 
  this method makes many assumptions about gender-identity, in-order to assign grammatical gender.
  it should not be used for any other purposes, other than resolving pronouns in english
*/
const m = 'male'
const f = 'female'

// known gendered honorifics
const honorifics = {
  mr: m,
  mrs: f,
  miss: f,
  madam: f,

  // british stuff
  king: m,
  queen: f,
  duke: m,
  duchess: f,
  baron: m,
  baroness: f,
  count: m,
  countess: f,
  prince: m,
  princess: f,
  sire: m,
  dame: f,
  lady: f,

  ayatullah: m, //i think?

  congressman: m,
  congresswoman: f,
  'first lady': f,

  // marked as non-binary
  mx: null,
}

const predictGender = function (parsed, person) {
  let { firstName, honorific } = parsed
  // use first-name as signal-signal
  if (firstName.has('#FemaleName')) {
    return f
  }
  if (firstName.has('#MaleName')) {
    return m
  }
  // use honorics as gender-signal
  if (honorific.found) {
    let hon = honorific.text('normal')
    hon = hon.replace(/\./g, '') //clean it up a bit
    if (honorifics.hasOwnProperty(hon)) {
      return honorifics[hon]
    }
    // her excelency
    if (/^her /.test(hon)) {
      return f
    }
    if (/^his /.test(hon)) {
      return m
    }
  }
  // offer used-pronouns as a signal
  let after = person.after()
  if (!after.has('#Person') && after.has('#Pronoun')) {
    let pro = after.match('#Pronoun')
    // manual use of gender-neutral
    if (pro.has('(they|their)')) {
      return null
    }
    let hasMasc = pro.has('(he|his)')
    let hasFem = pro.has('(she|her|hers)')
    if (hasMasc && !hasFem) {
      return m
    }
    if (hasFem && !hasMasc) {
      return f
    }
  }
  return null
}
export default predictGender
