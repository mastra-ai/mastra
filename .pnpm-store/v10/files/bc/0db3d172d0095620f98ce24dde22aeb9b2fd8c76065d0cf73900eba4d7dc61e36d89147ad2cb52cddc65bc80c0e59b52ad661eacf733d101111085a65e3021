export default [
  // do the dance
  { match: '#Infinitive (this|that|the) [#Infinitive]', group: 0, tag: 'Noun', reason: 'do-this-dance' },
  //running-a-show
  { match: '#Gerund #Determiner [#Infinitive]', group: 0, tag: 'Noun', reason: 'running-a-show' },
  //the-only-reason
  { match: '#Determiner (only|further|just|more|backward) [#Infinitive]', group: 0, tag: 'Noun', reason: 'the-only-reason' },
  // a stream runs
  { match: '(the|this|a|an) [#Infinitive] #Adverb? #Verb', group: 0, tag: 'Noun', reason: 'determiner5' },
  //a nice deal
  { match: '#Determiner #Adjective #Adjective? [#Infinitive]', group: 0, tag: 'Noun', reason: 'a-nice-inf' },
  // the mexican train
  { match: '#Determiner #Demonym [#PresentTense]', group: 0, tag: 'Noun', reason: 'mexican-train' },
  //next career move
  { match: '#Adjective #Noun+ [#Infinitive] #Copula', group: 0, tag: 'Noun', reason: 'career-move' },
  // at some point
  { match: 'at some [#Infinitive]', group: 0, tag: 'Noun', reason: 'at-some-inf' },
  // goes to sleep
  { match: '(go|goes|went) to [#Infinitive]', group: 0, tag: 'Noun', reason: 'goes-to-verb' },
  //a close watch on
  { match: '(a|an) #Adjective? #Noun [#Infinitive] (#Preposition|#Noun)', group: 0, notIf: 'from', tag: 'Noun', reason: 'a-noun-inf' },
  //a tv show
  { match: '(a|an) #Noun [#Infinitive]$', group: 0, tag: 'Noun', reason: 'a-noun-inf2' },
  //is mark hughes
  // { match: '#Copula [#Infinitive] #Noun', group: 0, tag: 'Noun', reason: 'is-pres-noun' },
  // good wait staff
  // { match: '#Adjective [#Infinitive] #Noun', group: 0, tag: 'Noun', reason: 'good-wait-staff' },
  // running for congress
  { match: '#Gerund #Adjective? for [#Infinitive]', group: 0, tag: 'Noun', reason: 'running-for' },
  // running to work
  // { match: '#Gerund #Adjective to [#Infinitive]', group: 0, tag: 'Noun', reason: 'running-to' },
  // about love
  { match: 'about [#Infinitive]', group: 0, tag: 'Singular', reason: 'about-love' },
  // singers on stage
  { match: '#Plural on [#Infinitive]', group: 0, tag: 'Noun', reason: 'on-stage' },
  // any charge
  { match: 'any [#Infinitive]', group: 0, tag: 'Noun', reason: 'any-charge' },
  // no doubt
  { match: 'no [#Infinitive]', group: 0, tag: 'Noun', reason: 'no-doubt' },
  // number of seats
  { match: 'number of [#PresentTense]', group: 0, tag: 'Noun', reason: 'number-of-x' },
  // teaches/taught
  { match: '(taught|teaches|learns|learned) [#PresentTense]', group: 0, tag: 'Noun', reason: 'teaches-x' },
  // use reverse
  { match: '(try|use|attempt|build|make) [#Verb #Particle?]', notIf: '(#Copula|#Noun|sure|fun|up)', group: 0, tag: 'Noun', reason: 'do-verb' },//make sure of
  // checkmate is
  { match: '^[#Infinitive] (is|was)', group: 0, tag: 'Noun', reason: 'checkmate-is' },
  // get much sleep
  { match: '#Infinitive much [#Infinitive]', group: 0, tag: 'Noun', reason: 'get-much' },
  // cause i gotta
  { match: '[cause] #Pronoun #Verb', group: 0, tag: 'Conjunction', reason: 'cause-cuz' },
  // the cardio dance party
  { match: 'the #Singular [#Infinitive] #Noun', group: 0, tag: 'Noun', notIf: '#Pronoun', reason: 'cardio-dance' },

  // that should smoke
  { match: '#Determiner #Modal [#Noun]', group: 0, tag: 'PresentTense', reason: 'should-smoke' },
  //this rocks
  { match: 'this [#Plural]', group: 0, tag: 'PresentTense', notIf: '(#Preposition|#Date)', reason: 'this-verbs' },
  //voice that rocks
  { match: '#Noun that [#Plural]', group: 0, tag: 'PresentTense', notIf: '(#Preposition|#Pronoun|way)', reason: 'voice-that-rocks' },
  //that leads to
  { match: 'that [#Plural] to', group: 0, tag: 'PresentTense', notIf: '#Preposition', reason: 'that-leads-to' },
  //let him glue
  {
    match: '(let|make|made) (him|her|it|#Person|#Place|#Organization)+ [#Singular] (a|an|the|it)',
    group: 0,
    tag: 'Infinitive',
    reason: 'let-him-glue',
  },

  // assign all tasks
  { match: '#Verb (all|every|each|most|some|no) [#PresentTense]', notIf: '#Modal', group: 0, tag: 'Noun', reason: 'all-presentTense' },  // PresentTense/Noun ambiguities
  // big dreams, critical thinking
  // have big dreams
  { match: '(had|have|#PastTense) #Adjective [#PresentTense]', group: 0, tag: 'Noun', notIf: 'better', reason: 'adj-presentTense' },
  // excellent answer spencer
  // { match: '^#Adjective [#PresentTense]', group: 0, tag: 'Noun', reason: 'start adj-presentTense' },
  // one big reason
  { match: '#Value #Adjective [#PresentTense]', group: 0, tag: 'Noun', notIf: '#Copula', reason: 'one-big-reason' },
  // won widespread support
  { match: '#PastTense #Adjective+ [#PresentTense]', group: 0, tag: 'Noun', notIf: '(#Copula|better)', reason: 'won-wide-support' },
  // many poses
  { match: '(many|few|several|couple) [#PresentTense]', group: 0, tag: 'Noun', notIf: '#Copula', reason: 'many-poses' },
  // very big dreams
  { match: '#Determiner #Adverb #Adjective [%Noun|Verb%]', group: 0, tag: 'Noun', notIf: '#Copula', reason: 'very-big-dream' },
  // from start to finish
  { match: 'from #Noun to [%Noun|Verb%]', group: 0, tag: 'Noun', reason: 'start-to-finish' },
  // for comparison or contrast
  { match: '(for|with|of) #Noun (and|or|not) [%Noun|Verb%]', group: 0, tag: 'Noun', notIf: '#Pronoun', reason: 'for-food-and-gas' },
  // adorable little store
  { match: '#Adjective #Adjective [#PresentTense]', group: 0, tag: 'Noun', notIf: '#Copula', reason: 'adorable-little-store' },
  // of basic training
  // { match: '#Preposition #Adjective [#PresentTense]', group: 0, tag: 'Noun', reason: 'of-basic-training' },
  // justifiying higher costs
  { match: '#Gerund #Adverb? #Comparative [#PresentTense]', group: 0, tag: 'Noun', notIf: '#Copula', reason: 'higher-costs' },

  { match: '(#Noun && @hasComma) #Noun (and|or) [#PresentTense]', group: 0, tag: 'Noun', notIf: '#Copula', reason: 'noun-list' },

  // any questions for
  { match: '(many|any|some|several) [#PresentTense] for', group: 0, tag: 'Noun', reason: 'any-verbs-for' },
  // to facilitate gas exchange with
  { match: `to #PresentTense #Noun [#PresentTense] #Preposition`, group: 0, tag: 'Noun', reason: 'gas-exchange' },
  // waited until release
  { match: `#PastTense (until|as|through|without) [#PresentTense]`, group: 0, tag: 'Noun', reason: 'waited-until-release' },
  // selling like hot cakes
  { match: `#Gerund like #Adjective? [#PresentTense]`, group: 0, tag: 'Plural', reason: 'like-hot-cakes' },
  // some valid reason
  { match: `some #Adjective [#PresentTense]`, group: 0, tag: 'Noun', reason: 'some-reason' },
  // for some reason
  { match: `for some [#PresentTense]`, group: 0, tag: 'Noun', reason: 'for-some-reason' },
  // same kind of shouts
  { match: `(same|some|the|that|a) kind of [#PresentTense]`, group: 0, tag: 'Noun', reason: 'some-kind-of' },
  // a type of shout
  { match: `(same|some|the|that|a) type of [#PresentTense]`, group: 0, tag: 'Noun', reason: 'some-type-of' },
  // doing better for fights
  { match: `#Gerund #Adjective #Preposition [#PresentTense]`, group: 0, tag: 'Noun', reason: 'doing-better-for-x' },
  // get better aim
  { match: `(get|got|have) #Comparative [#PresentTense]`, group: 0, tag: 'Noun', reason: 'got-better-aim' },
  // whose name was
  { match: 'whose [#PresentTense] #Copula', group: 0, tag: 'Noun', reason: 'whos-name-was' },
  // give up on reason
  { match: `#PhrasalVerb #Particle #Preposition [#PresentTense]`, group: 0, tag: 'Noun', reason: 'given-up-on-x' },
  //there are reasons
  { match: 'there (are|were) #Adjective? [#PresentTense]', group: 0, tag: 'Plural', reason: 'there-are' },
  // 30 trains
  { match: '#Value [#PresentTense] of', group: 0, notIf: '(one|1|#Copula|#Infinitive)', tag: 'Plural', reason: '2-trains' },
  // compromises are possible
  { match: '[#PresentTense] (are|were) #Adjective', group: 0, tag: 'Plural', reason: 'compromises-are-possible' },
  // hope i helped
  { match: '^[(hope|guess|thought|think)] #Pronoun #Verb', group: 0, tag: 'Infinitive', reason: 'suppose-i' },
  //pursue its dreams
  // { match: '#PresentTense #Possessive [#PresentTense]', notIf: '#Gerund', group: 0, tag: 'Plural', reason: 'pursue-its-dreams' },
  // our unyielding support
  { match: '#Possessive #Adjective [#Verb]', group: 0, tag: 'Noun', notIf: '#Copula', reason: 'our-full-support' },
  // tastes good
  { match: '[(tastes|smells)] #Adverb? #Adjective', group: 0, tag: 'PresentTense', reason: 'tastes-good' },
  // are you playing golf
  // { match: '^are #Pronoun [#Noun]', group: 0, notIf: '(here|there)', tag: 'Verb', reason: 'are-you-x' },
  // ignoring commute
  { match: '#Copula #Gerund [#PresentTense] !by?', group: 0, tag: 'Noun', notIf: 'going', reason: 'ignoring-commute' },
  // noun-pastTense variables
  { match: '#Determiner #Adjective? [(shed|thought|rose|bid|saw|spelt)]', group: 0, tag: 'Noun', reason: 'noun-past' },

  // 'verb-to'
  // how to watch
  { match: 'how to [%Noun|Verb%]', group: 0, tag: 'Infinitive', reason: 'how-to-noun' },
  // which boost it
  { match: 'which [%Noun|Verb%] #Noun', group: 0, tag: 'Infinitive', reason: 'which-boost-it' },
  // asking questions
  { match: '#Gerund [%Plural|Verb%]', group: 0, tag: 'Plural', reason: 'asking-questions' },
  // ready to stream
  { match: '(ready|available|difficult|hard|easy|made|attempt|try) to [%Noun|Verb%]', group: 0, tag: 'Infinitive', reason: 'ready-to-noun' },
  // bring to market
  { match: '(bring|went|go|drive|run|bike) to [%Noun|Verb%]', group: 0, tag: 'Noun', reason: 'bring-to-noun' },
  // can i sleep, would you look
  { match: '#Modal #Noun [%Noun|Verb%]', group: 0, tag: 'Infinitive', reason: 'would-you-look' },
  // is just spam
  { match: '#Copula just [#Infinitive]', group: 0, tag: 'Noun', reason: 'is-just-spam' },
  // request copies
  { match: '^%Noun|Verb% %Plural|Verb%', tag: 'Imperative #Plural', reason: 'request-copies' },
  // homemade pickles and drinks
  { match: '#Adjective #Plural and [%Plural|Verb%]', group: 0, tag: '#Plural', reason: 'pickles-and-drinks' },
  // the 1968 film
  { match: '#Determiner #Year [#Verb]', group: 0, tag: 'Noun', reason: 'the-1968-film' },
  // the break up
  { match: '#Determiner [#PhrasalVerb #Particle]', group: 0, tag: 'Noun', reason: 'the-break-up' },
  // the individual goals
  { match: '#Determiner [%Adj|Noun%] #Noun', group: 0, tag: 'Adjective', notIf: '(#Pronoun|#Possessive|#ProperNoun)', reason: 'the-individual-goals' },
  // work or prepare
  { match: '[%Noun|Verb%] or #Infinitive', group: 0, tag: 'Infinitive', reason: 'work-or-prepare' },
  // to give thanks
  { match: 'to #Infinitive [#PresentTense]', group: 0, tag: 'Noun', notIf: '(#Gerund|#Copula|help)', reason: 'to-give-thanks' },
  // kills me
  { match: '[#Noun] me', group: 0, tag: 'Verb', reason: 'kills-me' },
  // removes wrinkles
  { match: '%Plural|Verb% %Plural|Verb%', tag: '#PresentTense #Plural', reason: 'removes-wrinkles' },
]
