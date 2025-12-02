import data from './_data.js'
import { reverse, uncompress } from 'suffix-thumb'
// import { reverse, uncompress } from '/Users/spencer/mountain/suffix-thumb'
// const uncompress = function () { }
// const reverse = function () { }
const fromPast = uncompress(data.PastTense)
const fromPresent = uncompress(data.PresentTense)
const fromGerund = uncompress(data.Gerund)
const fromParticiple = uncompress(data.Participle)

const toPast = reverse(fromPast)
const toPresent = reverse(fromPresent)
const toGerund = reverse(fromGerund)
const toParticiple = reverse(fromParticiple)

const toComparative = uncompress(data.Comparative)
const toSuperlative = uncompress(data.Superlative)
const fromComparative = reverse(toComparative)
const fromSuperlative = reverse(toSuperlative)

const adjToNoun = uncompress(data.AdjToNoun)

export default {
  fromPast,
  fromPresent,
  fromGerund,
  fromParticiple,
  toPast,
  toPresent,
  toGerund,
  toParticiple,
  // adjectives
  toComparative,
  toSuperlative,
  fromComparative,
  fromSuperlative,
  adjToNoun
}
// console.log(convert('collide', toPast))