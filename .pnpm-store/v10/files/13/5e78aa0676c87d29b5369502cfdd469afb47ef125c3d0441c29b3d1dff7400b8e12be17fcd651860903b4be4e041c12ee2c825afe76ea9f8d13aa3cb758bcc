const infNouns =
  '(feel|sense|process|rush|side|bomb|bully|challenge|cover|crush|dump|exchange|flow|function|issue|lecture|limit|march|process)'
export default [
  //'more' is not always an adverb
  // any more
  { match: '(the|any) [more]', group: 0, tag: 'Singular', reason: 'more-noun' },
  // more players
  { match: '[more] #Noun', group: 0, tag: 'Adjective', reason: 'more-noun' },
  // rights of man
  { match: '(right|rights) of .', tag: 'Noun', reason: 'right-of' },
  // a bit
  { match: 'a [bit]', group: 0, tag: 'Singular', reason: 'bit-2' },
  // a must
  { match: 'a [must]', group: 0, tag: 'Singular', reason: 'must-2' },
  // we all
  { match: '(we|us) [all]', group: 0, tag: 'Noun', reason: 'we all' },
  // due to weather
  { match: 'due to [#Verb]', group: 0, tag: 'Noun', reason: 'due-to' },

  //some pressing issues
  { match: 'some [#Verb] #Plural', group: 0, tag: 'Noun', reason: 'determiner6' },
  // my first thought
  { match: '#Possessive #Ordinal [#PastTense]', group: 0, tag: 'Noun', reason: 'first-thought' },
  //the nice swim
  {
    match: '(the|this|those|these) #Adjective [%Verb|Noun%]',
    group: 0,
    tag: 'Noun',
    notIf: '#Copula',
    reason: 'the-adj-verb',
  },
  // the truly nice swim
  { match: '(the|this|those|these) #Adverb #Adjective [#Verb]', group: 0, tag: 'Noun', reason: 'determiner4' },
  //the wait to vote
  { match: 'the [#Verb] #Preposition .', group: 0, tag: 'Noun', reason: 'determiner1' },
  //a sense of
  { match: '(a|an|the) [#Verb] of', group: 0, tag: 'Noun', reason: 'the-verb-of' },
  //the threat of force
  { match: '#Determiner #Noun of [#Verb]', group: 0, tag: 'Noun', notIf: '#Gerund', reason: 'noun-of-noun' },
  // ended in ruins
  {
    match: '#PastTense #Preposition [#PresentTense]',
    group: 0,
    notIf: '#Gerund',
    tag: 'Noun',
    reason: 'ended-in-ruins',
  },
  //'u' as pronoun
  { match: '#Conjunction [u]', group: 0, tag: 'Pronoun', reason: 'u-pronoun-2' },
  { match: '[u] #Verb', group: 0, tag: 'Pronoun', reason: 'u-pronoun-1' },
  //the western line
  {
    match: '#Determiner [(western|eastern|northern|southern|central)] #Noun',
    group: 0,
    tag: 'Noun',
    reason: 'western-line',
  },
  //air-flow
  { match: '(#Singular && @hasHyphen) #PresentTense', tag: 'Noun', reason: 'hyphen-verb' },
  //is no walk
  { match: 'is no [#Verb]', group: 0, tag: 'Noun', reason: 'is-no-verb' },
  //do so
  { match: 'do [so]', group: 0, tag: 'Noun', reason: 'so-noun' },
  // what the hell
  { match: '#Determiner [(shit|damn|hell)]', group: 0, tag: 'Noun', reason: 'swears-noun' },
  // go to shit
  { match: 'to [(shit|hell)]', group: 0, tag: 'Noun', reason: 'to-swears' },
  // the staff were
  { match: '(the|these) [#Singular] (were|are)', group: 0, tag: 'Plural', reason: 'singular-were' },
  // a comdominium, or simply condo
  { match: `a #Noun+ or #Adverb+? [#Verb]`, group: 0, tag: 'Noun', reason: 'noun-or-noun' },
  // walk the walk
  {
    match: '(the|those|these|a|an) #Adjective? [#PresentTense #Particle?]',
    group: 0,
    tag: 'Noun',
    notIf: '(seem|appear|include|#Gerund|#Copula)',
    reason: 'det-inf',
  },
  // { match: '(the|those|these|a|an) #Adjective? [#PresentTense #Particle?]', group: 0, tag: 'Noun', notIf: '(#Gerund|#Copula)', reason: 'det-pres' },

  // ==== Actor ====
  //Aircraft designer
  { match: '#Noun #Actor', tag: 'Actor', notIf: '(#Person|#Pronoun)', reason: 'thing-doer' },
  //lighting designer
  { match: '#Gerund #Actor', tag: 'Actor', reason: 'gerund-doer' },
  // captain sanders
  // { match: '[#Actor+] #ProperNoun', group: 0, tag: 'Honorific', reason: 'sgt-kelly' },
  // co-founder
  { match: `co #Singular`, tag: 'Actor', reason: 'co-noun' },
  // co-founder
  {
    match: `[#Noun+] #Actor`,
    group: 0,
    tag: 'Actor',
    notIf: '(#Honorific|#Pronoun|#Possessive)',
    reason: 'air-traffic-controller',
  },
  // fine-artist
  {
    match: `(urban|cardiac|cardiovascular|respiratory|medical|clinical|visual|graphic|creative|dental|exotic|fine|certified|registered|technical|virtual|professional|amateur|junior|senior|special|pharmaceutical|theoretical)+ #Noun? #Actor`,
    tag: 'Actor',
    reason: 'fine-artist',
  },
  // dance coach
  {
    match: `#Noun+ (coach|chef|king|engineer|fellow|personality|boy|girl|man|woman|master)`,
    tag: 'Actor',
    reason: 'dance-coach',
  },
  // chief design officer
  { match: `chief . officer`, tag: 'Actor', reason: 'chief-x-officer' },
  // chief of police
  { match: `chief of #Noun+`, tag: 'Actor', reason: 'chief-of-police' },
  // president of marketing
  { match: `senior? vice? president of #Noun+`, tag: 'Actor', reason: 'president-of' },

  // ==== Singular ====
  //the sun
  { match: '#Determiner [sun]', group: 0, tag: 'Singular', reason: 'the-sun' },
  //did a 900, paid a 20
  { match: '#Verb (a|an) [#Value]$', group: 0, tag: 'Singular', reason: 'did-a-value' },
  //'the can'
  { match: 'the [(can|will|may)]', group: 0, tag: 'Singular', reason: 'the can' },

  // ==== Possessive ====
  //spencer kelly's
  { match: '#FirstName #Acronym? (#Possessive && #LastName)', tag: 'Possessive', reason: 'name-poss' },
  //Super Corp's fundraiser
  { match: '#Organization+ #Possessive', tag: 'Possessive', reason: 'org-possessive' },
  //Los Angeles's fundraiser
  { match: '#Place+ #Possessive', tag: 'Possessive', reason: 'place-possessive' },
  // Ptolemy's experiments
  { match: '#Possessive #PresentTense #Particle?', notIf: '(#Gerund|her)', tag: 'Noun', reason: 'possessive-verb' }, // anna's eating vs anna's eating lunch
  // my presidents house
  { match: '(my|our|their|her|his|its) [(#Plural && #Actor)] #Noun', tag: 'Possessive', reason: 'my-dads' },

  // 10th of a second
  { match: '#Value of a [second]', group: 0, unTag: 'Value', tag: 'Singular', reason: '10th-of-a-second' },
  // 10 seconds
  { match: '#Value [seconds]', group: 0, unTag: 'Value', tag: 'Plural', reason: '10-seconds' },
  // in time
  { match: 'in [#Infinitive]', group: 0, tag: 'Singular', reason: 'in-age' },
  // a minor in
  { match: 'a [#Adjective] #Preposition', group: 0, tag: 'Noun', reason: 'a-minor-in' },
  //the repairer said
  { match: '#Determiner [#Singular] said', group: 0, tag: 'Actor', reason: 'the-actor-said' },
  //the euro sense
  {
    match: `#Determiner #Noun [${infNouns}] !(#Preposition|to|#Adverb)?`,
    group: 0,
    tag: 'Noun',
    reason: 'the-noun-sense',
  },
  // photographs of a computer are
  { match: '[#PresentTense] (of|by|for) (a|an|the) #Noun #Copula', group: 0, tag: 'Plural', reason: 'photographs-of' },
  // fight and win
  { match: '#Infinitive and [%Noun|Verb%]', group: 0, tag: 'Infinitive', reason: 'fight and win' },
  // peace and flowers and love
  { match: '#Noun and [#Verb] and #Noun', group: 0, tag: 'Noun', reason: 'peace-and-flowers' },
  // the 1992 classic
  { match: 'the #Cardinal [%Adj|Noun%]', group: 0, tag: 'Noun', reason: 'the-1992-classic' },
  // the premier university
  { match: '#Copula the [%Adj|Noun%] #Noun', group: 0, tag: 'Adjective', reason: 'the-premier-university' },

  // scottish - i ate me sandwich
  { match: 'i #Verb [me] #Noun', group: 0, tag: 'Possessive', reason: 'scottish-me' },
  // dance music
  {
    match: '[#PresentTense] (music|class|lesson|night|party|festival|league|ceremony)',
    group: 0,
    tag: 'Noun',
    reason: 'dance-music',
  },
  // wit it
  { match: '[wit] (me|it)', group: 0, tag: 'Presposition', reason: 'wit-me' },
  //left-her-boots, shoved her hand
  { match: '#PastTense #Possessive [#Verb]', group: 0, tag: 'Noun', notIf: '(saw|made)', reason: 'left-her-boots' },
  //35 signs
  { match: '#Value [%Plural|Verb%]', group: 0, tag: 'Plural', notIf: '(one|1|a|an)', reason: '35-signs' },
  //had time
  { match: 'had [#PresentTense]', group: 0, tag: 'Noun', notIf: '(#Gerund|come|become)', reason: 'had-time' },
  //instant access
  { match: '%Adj|Noun% %Noun|Verb%', tag: '#Adjective #Noun', notIf: '#ProperNoun #Noun', reason: 'instant-access' },
  // a representative to
  { match: '#Determiner [%Adj|Noun%] #Conjunction', group: 0, tag: 'Noun', reason: 'a-rep-to' },
  // near death experiences, ambitious sales targets
  {
    match: '#Adjective #Noun [%Plural|Verb%]$',
    group: 0,
    tag: 'Plural',
    notIf: '#Pronoun',
    reason: 'near-death-experiences',
  },
  // your guild colors
  { match: '#Possessive #Noun [%Plural|Verb%]$', group: 0, tag: 'Plural', reason: 'your-guild-colors' },
]
