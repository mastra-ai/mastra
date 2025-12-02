const entity = ['Person', 'Place', 'Organization']

export default {
  Noun: {
    not: ['Verb', 'Adjective', 'Adverb', 'Value', 'Determiner'],
  },
  Singular: {
    is: 'Noun',
    not: ['Plural', 'Uncountable'],
  },
  // 'Canada'
  ProperNoun: {
    is: 'Noun',
  },
  Person: {
    is: 'Singular',
    also: ['ProperNoun'],
    not: ['Place', 'Organization', 'Date'],
  },
  FirstName: {
    is: 'Person',
  },
  MaleName: {
    is: 'FirstName',
    not: ['FemaleName', 'LastName'],
  },
  FemaleName: {
    is: 'FirstName',
    not: ['MaleName', 'LastName'],
  },
  LastName: {
    is: 'Person',
    not: ['FirstName'],
  },
  // 'dr.'
  Honorific: {
    is: 'Person',
    not: ['FirstName', 'LastName', 'Value'],
  },
  Place: {
    is: 'Singular',
    not: ['Person', 'Organization'],
  },
  Country: {
    is: 'Place',
    also: ['ProperNoun'],
    not: ['City'],
  },
  City: {
    is: 'Place',
    also: ['ProperNoun'],
    not: ['Country'],
  },
  // 'california'
  Region: {
    is: 'Place',
    also: ['ProperNoun'],
  },
  Address: {
    // is: 'Place',
  },
  Organization: {
    is: 'ProperNoun',
    not: ['Person', 'Place'],
  },
  SportsTeam: {
    is: 'Organization',
  },
  School: {
    is: 'Organization',
  },
  Company: {
    is: 'Organization',
  },
  Plural: {
    is: 'Noun',
    not: ['Singular', 'Uncountable'],
  },
  // 'gravity'
  Uncountable: {
    is: 'Noun',
  },
  // 'it'
  Pronoun: {
    is: 'Noun',
    not: entity,
  },
  // 'swimmer'
  Actor: {
    is: 'Noun',
    not: ['Place', 'Organization'],
  },
  // walking
  Activity: {
    is: 'Noun',
    not: ['Person', 'Place'],
  },
  // kilometres
  Unit: {
    is: 'Noun',
    not: entity,
  },
  // canadian
  Demonym: {
    is: 'Noun',
    also: ['ProperNoun'],
    not: entity,
  },
  // [spencer's] hat
  Possessive: {
    is: 'Noun',
  },
  // 'yourself'
  Reflexive: {
    is: 'Pronoun',
  },
}
