import doRules from './lib.js'

const s = 'ically'
const ical = new Set([
  'analyt' + s, //analytical
  'chem' + s,// chemical
  'class' + s, //classical
  'clin' + s, // clinical
  'crit' + s,// critical
  'ecolog' + s,// ecological
  'electr' + s,// electrical
  'empir' + s, // empirical
  'frant' + s, // frantical
  'grammat' + s,// grammatical
  'ident' + s, // identical
  'ideolog' + s, // ideological
  'log' + s, // logical
  'mag' + s, //magical
  'mathemat' + s,// mathematical
  'mechan' + s,// mechanical
  'med' + s,// medical
  'method' + s, // methodical
  'method' + s,// methodical
  'mus' + s, // musical
  'phys' + s, // physical
  'phys' + s,// physical
  'polit' + s,// political
  'pract' + s,// practical
  'rad' + s, //radical
  'satir' + s, // satirical
  'statist' + s, // statistical
  'techn' + s,// technical
  'technolog' + s, // technological
  'theoret' + s,// theoretical
  'typ' + s,// typical
  'vert' + s,// vertical
  'whims' + s,// whimsical
])

const suffixes = [
  null,
  {},
  { 'ly': '' },
  {
    'ily': 'y',
    'bly': 'ble',
    'ply': 'ple',
  },
  {
    'ally': 'al',
    'rply': 'rp',
  },
  {
    'ually': 'ual',
    'ially': 'ial',
    'cally': 'cal',
    'eally': 'eal',
    'rally': 'ral',
    'nally': 'nal',
    'mally': 'mal',
    'eeply': 'eep',
    'eaply': 'eap',
  },
  {
    ically: 'ic',
  }
]

const noAdj = new Set([
  'early',
  'only',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'mostly',
  'duly',
  'unduly',
  'especially',
  'undoubtedly',
  'conversely',
  'namely',
  'exceedingly',
  'presumably',
  'accordingly',
  'overly',
  'best',
  'latter',
  'little',
  'long',
  'low'
])

// exceptions to rules
const exceptions = {
  wholly: 'whole',
  fully: 'full',
  truly: 'true',
  gently: 'gentle',
  singly: 'single',
  customarily: 'customary',
  idly: 'idle',
  publically: 'public',
  quickly: 'quick',
  superbly: 'superb',
  cynically: 'cynical',
  well: 'good',// -?
}


const toAdjective = function (str) {
  if (!str.endsWith('ly')) {
    return null
  }
  // 'electronic' vs 'electronical'
  if (ical.has(str)) {
    return str.replace(/ically/, 'ical')
  }
  if (noAdj.has(str)) {
    return null
  }
  if (exceptions.hasOwnProperty(str)) {
    return exceptions[str]
  }
  return doRules(str, suffixes) || str
}
export default toAdjective

// console.log(toAdjective('emphatically'))
// console.log(toAdjective('usually'))
// console.log(toAdjective('mechanically'))
// console.log(toAdjective('vertically'))