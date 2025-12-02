//regex suffix patterns and their most common parts of speech,
//built using wordnet, by spencer kelly.
//this mapping shrinks-down the uglified build
const Adj = 'Adjective'
const Inf = 'Infinitive'
const Pres = 'PresentTense'
const Sing = 'Singular'
const Past = 'PastTense'
const Adverb = 'Adverb'
const Exp = 'Expression'
const Actor = 'Actor'
const Verb = 'Verb'
const Noun = 'Noun'
const Last = 'LastName'

export default {
  a: [
    [/.[aeiou]na$/, Noun, 'tuna'],
    [/.[oau][wvl]ska$/, Last],
    [/.[^aeiou]ica$/, Sing, 'harmonica'],
    [/^([hyj]a+)+$/, Exp, 'haha'], //hahah
  ],
  c: [[/.[^aeiou]ic$/, Adj]],
  d: [
    //==-ed==
    //double-consonant
    [/[aeiou](pp|ll|ss|ff|gg|tt|rr|bb|nn|mm)ed$/, Past, 'popped'],
    //double-vowel
    [/.[aeo]{2}[bdgmnprvz]ed$/, Past, 'rammed'],
    //-hed
    [/.[aeiou][sg]hed$/, Past, 'gushed'],
    //-rd
    [/.[aeiou]red$/, Past, 'hired'],
    [/.[aeiou]r?ried$/, Past, 'hurried'],
    // ard
    [/[^aeiou]ard$/, Sing, 'steward'],
    // id
    [/[aeiou][^aeiou]id$/, Adj, ''],
    [/.[vrl]id$/, Adj, 'livid'],

    // ===== -ed ======
    //-led
    [/..led$/, Past, 'hurled'],
    //-sed
    [/.[iao]sed$/, Past, ''],
    [/[aeiou]n?[cs]ed$/, Past, ''],
    //-med
    [/[aeiou][rl]?[mnf]ed$/, Past, ''],
    //-ked
    [/[aeiou][ns]?c?ked$/, Past, 'bunked'],
    //-gned
    [/[aeiou]gned$/, Past],
    //-ged
    [/[aeiou][nl]?ged$/, Past],
    //-ted
    [/.[tdbwxyz]ed$/, Past],
    [/[^aeiou][aeiou][tvx]ed$/, Past],
    //-ied
    [/.[cdflmnprstv]ied$/, Past, 'emptied'],
  ],
  e: [
    [/.[lnr]ize$/, Inf, 'antagonize'],
    [/.[^aeiou]ise$/, Inf, 'antagonise'],
    [/.[aeiou]te$/, Inf, 'bite'],
    [/.[^aeiou][ai]ble$/, Adj, 'fixable'],
    [/.[^aeiou]eable$/, Adj, 'maleable'],
    [/.[ts]ive$/, Adj, 'festive'],
    [/[a-z]-like$/, Adj, 'woman-like'],
  ],
  h: [
    [/.[^aeiouf]ish$/, Adj, 'cornish'],
    [/.v[iy]ch$/, Last, '..ovich'],
    [/^ug?h+$/, Exp, 'ughh'],
    [/^uh[ -]?oh$/, Exp, 'uhoh'],
    [/[a-z]-ish$/, Adj, 'cartoon-ish'],
  ],
  i: [[/.[oau][wvl]ski$/, Last, 'polish-male']],
  k: [
    [/^(k){2}$/, Exp, 'kkkk'], //kkkk
  ],
  l: [
    [/.[gl]ial$/, Adj, 'familial'],
    [/.[^aeiou]ful$/, Adj, 'fitful'],
    [/.[nrtumcd]al$/, Adj, 'natal'],
    [/.[^aeiou][ei]al$/, Adj, 'familial'],
  ],
  m: [
    [/.[^aeiou]ium$/, Sing, 'magnesium'],
    [/[^aeiou]ism$/, Sing, 'schism'],
    [/^[hu]m+$/, Exp, 'hmm'],
    [/^\d+ ?[ap]m$/, 'Date', '3am'],
  ],
  n: [
    [/.[lsrnpb]ian$/, Adj, 'republican'],
    [/[^aeiou]ician$/, Actor, 'musician'],
    [/[aeiou][ktrp]in'$/, 'Gerund', "cookin'"], // 'cookin', 'hootin'
  ],
  o: [
    [/^no+$/, Exp, 'noooo'],
    [/^(yo)+$/, Exp, 'yoo'],
    [/^wo{2,}[pt]?$/, Exp, 'woop'], //woo
  ],
  r: [
    [/.[bdfklmst]ler$/, 'Noun'],
    [/[aeiou][pns]er$/, Sing],
    [/[^i]fer$/, Inf],
    [/.[^aeiou][ao]pher$/, Actor],
    [/.[lk]er$/, 'Noun'],
    [/.ier$/, 'Comparative'],
  ],
  t: [
    [/.[di]est$/, 'Superlative'],
    [/.[icldtgrv]ent$/, Adj],
    [/[aeiou].*ist$/, Adj],
    [/^[a-z]et$/, Verb],
  ],
  s: [
    [/.[^aeiou]ises$/, Pres],
    [/.[rln]ates$/, Pres],
    [/.[^z]ens$/, Verb],
    [/.[lstrn]us$/, Sing],
    [/.[aeiou]sks$/, Pres],
    [/.[aeiou]kes$/, Pres],
    [/[aeiou][^aeiou]is$/, Sing],
    [/[a-z]'s$/, Noun],
    [/^yes+$/, Exp], //yessss
  ],
  v: [
    [/.[^aeiou][ai][kln]ov$/, Last], //east-europe
  ],
  y: [
    [/.[cts]hy$/, Adj],
    [/.[st]ty$/, Adj],
    [/.[tnl]ary$/, Adj],
    [/.[oe]ry$/, Sing],
    [/[rdntkbhs]ly$/, Adverb],
    [/.(gg|bb|zz)ly$/, Adj],
    [/...lly$/, Adverb],
    [/.[gk]y$/, Adj],
    [/[bszmp]{2}y$/, Adj],
    [/.[ai]my$/, Adj],
    [/[ea]{2}zy$/, Adj],
    [/.[^aeiou]ity$/, Sing],
  ],
}
