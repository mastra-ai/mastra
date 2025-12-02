import { noop, getTense, wasWere, noWill } from '../lib.js'
const keep = { tags: true }

const fns = {

  noAux: (vb, parsed) => {
    if (parsed.auxiliary.found) {
      vb = vb.remove(parsed.auxiliary)
    }
    return vb
  },

  // walk->walked
  simple: (vb, parsed) => {
    const { conjugate, toInfinitive } = vb.methods.two.transform.verb
    const root = parsed.root
    // 'i may'
    if (root.has('#Modal')) {
      return vb
    }
    let str = root.text({ keepPunct: false })
    str = toInfinitive(str, vb.model, getTense(root))
    let all = conjugate(str, vb.model)
    // 'driven' || 'drove'
    str = all.PastTense
    // all.Participle || all.PastTense
    // but skip the 'is' participle..
    str = str === 'been' ? 'was' : str
    if (str === 'was') {
      str = wasWere(vb, parsed)
    }
    if (str) {
      vb.replace(root, str, keep)
    }
    return vb
  },

  both: function (vb, parsed) {
    // 'he did not walk'
    if (parsed.negative.found) {
      vb.replace('will', 'did')
      return vb
    }
    // 'he walked'
    vb = fns.simple(vb, parsed)
    vb = fns.noAux(vb, parsed)
    return vb
  },

  hasHad: vb => {
    vb.replace('has', 'had', keep)
    return vb
  },

  // some verbs have this weird past-tense form
  // drive -> driven, (!drove)
  hasParticiple: (vb, parsed) => {
    const { conjugate, toInfinitive } = vb.methods.two.transform.verb
    const root = parsed.root
    let str = root.text('normal')
    str = toInfinitive(str, vb.model, getTense(root))
    return conjugate(str, vb.model).Participle
  },



}


const forms = {
  // walk -> walked
  'infinitive': fns.simple,
  // he walks -> he walked
  'simple-present': fns.simple,
  // he walked
  'simple-past': noop,
  // he will walk -> he walked
  'simple-future': fns.both,

  // he is walking
  'present-progressive': vb => {
    vb.replace('are', 'were', keep)
    vb.replace('(is|are|am)', 'was', keep)
    return vb
  },
  // he was walking
  'past-progressive': noop,
  // he will be walking
  'future-progressive': (vb, parsed) => {
    vb.match(parsed.root).insertBefore('was')
    vb.remove('(will|be)')
    return vb
  },

  // has walked -> had walked (?)
  'present-perfect': fns.hasHad,
  // had walked
  'past-perfect': noop,
  // will have walked -> had walked
  'future-perfect': (vb, parsed) => {
    vb.match(parsed.root).insertBefore('had')
    if (vb.has('will')) {
      vb = noWill(vb)
    }
    vb.remove('have')
    return vb
  },

  // has been walking -> had been
  'present-perfect-progressive': fns.hasHad,
  // had been walking
  'past-perfect-progressive': noop,
  // will have been -> had
  'future-perfect-progressive': vb => {
    vb.remove('will')
    vb.replace('have', 'had', keep)
    return vb
  },

  // got walked
  'passive-past': vb => {
    // 'have been walked' -> 'had been walked'
    vb.replace('have', 'had', keep)
    return vb
  },
  // is being walked  -> 'was being walked'
  'passive-present': vb => {
    vb.replace('(is|are)', 'was', keep)
    return vb
  },
  // will be walked -> had been walked
  'passive-future': (vb, parsed) => {
    if (parsed.auxiliary.has('will be')) {
      vb.match(parsed.root).insertBefore('had been')
      vb.remove('(will|be)')
    }
    // will have been walked -> had been walked
    if (parsed.auxiliary.has('will have been')) {
      vb.replace('have', 'had', keep)
      vb.remove('will')
    }
    return vb
  },

  // would be walked -> 'would have been walked'
  'present-conditional': vb => {
    vb.replace('be', 'have been')
    return vb
  },
  // would have been walked
  'past-conditional': noop,

  // is going to drink -> was going to drink
  'auxiliary-future': vb => {
    vb.replace('(is|are|am)', 'was', keep)
    return vb
  },
  // used to walk
  'auxiliary-past': noop,
  // we do walk -> we did walk
  'auxiliary-present': vb => {
    vb.replace('(do|does)', 'did', keep)
    return vb
  },

  // must walk -> 'must have walked'
  'modal-infinitive': (vb, parsed) => {
    // this modal has a clear tense
    if (vb.has('can')) {
      // can drive -> could drive
      vb.replace('can', 'could', keep)
    } else {
      // otherwise, 
      //  walk -> have walked
      //  drive -> have driven
      fns.simple(vb, parsed)
      vb.match('#Modal').insertAfter('have').tag('Auxiliary')
    }
    return vb
  },
  // must have walked
  'modal-past': noop,
  // wanted to walk
  'want-infinitive': vb => {
    vb.replace('(want|wants)', 'wanted', keep)
    vb.remove('will')
    return vb
  },
  // started looking
  'gerund-phrase': (vb, parsed) => {
    parsed.root = parsed.root.not('#Gerund$')
    fns.simple(vb, parsed)
    noWill(vb)
    return vb
  },
}

const toPast = function (vb, parsed, form) {
  // console.log(form)
  if (forms.hasOwnProperty(form)) {
    vb = forms[form](vb, parsed)
    vb.fullSentence().compute(['tagger', 'chunks'])
    return vb
  }
  // do nothing i guess?
  return vb
}
export default toPast
