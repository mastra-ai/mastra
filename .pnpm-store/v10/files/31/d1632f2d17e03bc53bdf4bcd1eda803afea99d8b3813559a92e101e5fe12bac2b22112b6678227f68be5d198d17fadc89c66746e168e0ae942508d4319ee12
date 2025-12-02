// these are some of our heaviest-used matches
export default [
  // ==== Auxiliary ====
  // have been
  { match: `will (#Adverb|not)+? [have] (#Adverb|not)+? #Verb`, group: 0, tag: 'Auxiliary', reason: 'will-have-vb' },
  //was walking
  { match: `[#Copula] (#Adverb|not)+? (#Gerund|#PastTense)`, group: 0, tag: 'Auxiliary', reason: 'copula-walking' },
  //would walk
  { match: `[(#Modal|did)+] (#Adverb|not)+? #Verb`, group: 0, tag: 'Auxiliary', reason: 'modal-verb' },
  //would have had
  { match: `#Modal (#Adverb|not)+? [have] (#Adverb|not)+? [had] (#Adverb|not)+? #Verb`, group: 0, tag: 'Auxiliary', reason: 'would-have' },
  //support a splattering of auxillaries before a verb
  { match: `[(has|had)] (#Adverb|not)+? #PastTense`, group: 0, tag: 'Auxiliary', reason: 'had-walked' },
  // will walk
  { match: '[(do|does|did|will|have|had|has|got)] (not|#Adverb)+? #Verb', group: 0, tag: 'Auxiliary', reason: 'have-had' },
  // about to go
  { match: '[about to] #Adverb? #Verb', group: 0, tag: ['Auxiliary', 'Verb'], reason: 'about-to' },
  //would be walking
  { match: `#Modal (#Adverb|not)+? [be] (#Adverb|not)+? #Verb`, group: 0, tag: 'Auxiliary', reason: 'would-be' },
  //had been walking
  { match: `[(#Modal|had|has)] (#Adverb|not)+? [been] (#Adverb|not)+? #Verb`, group: 0, tag: 'Auxiliary', reason: 'had-been' },
  // was being driven
  { match: '[(be|being|been)] #Participle', group: 0, tag: 'Auxiliary', reason: 'being-driven' },
  // may want
  { match: '[may] #Adverb? #Infinitive', group: 0, tag: 'Auxiliary', reason: 'may-want' },
  // was being walked
  { match: '#Copula (#Adverb|not)+? [(be|being|been)] #Adverb+? #PastTense', group: 0, tag: 'Auxiliary', reason: 'being-walked' },
  // will be walked
  { match: 'will [be] #PastTense', group: 0, tag: 'Auxiliary', reason: 'will-be-x' },
  // been walking
  { match: '[(be|been)] (#Adverb|not)+? #Gerund', group: 0, tag: 'Auxiliary', reason: 'been-walking' },
  // used to walk
  { match: '[used to] #PresentTense', group: 0, tag: 'Auxiliary', reason: 'used-to-walk' },
  // was going to walk
  { match: '#Copula (#Adverb|not)+? [going to] #Adverb+? #PresentTense', group: 0, tag: 'Auxiliary', reason: 'going-to-walk' },
  // tell me
  { match: '#Imperative [(me|him|her)]', group: 0, tag: 'Reflexive', reason: 'tell-him' },
  // there is no x
  { match: '(is|was) #Adverb? [no]', group: 0, tag: 'Negative', reason: 'is-no' },
  // been told
  { match: '[(been|had|became|came)] #PastTense', group: 0, notIf: '#PhrasalVerb', tag: 'Auxiliary', reason: 'been-told' },
  // being born
  { match: '[(being|having|getting)] #Verb', group: 0, tag: 'Auxiliary', reason: 'being-born' },
  // be walking
  { match: '[be] #Gerund', group: 0, tag: 'Auxiliary', reason: 'be-walking' },
  // better go
  { match: '[better] #PresentTense', group: 0, tag: 'Modal', notIf: '(#Copula|#Gerund)', reason: 'better-go' },
  // even better
  { match: 'even better', tag: 'Adverb #Comparative', reason: 'even-better' },
]
