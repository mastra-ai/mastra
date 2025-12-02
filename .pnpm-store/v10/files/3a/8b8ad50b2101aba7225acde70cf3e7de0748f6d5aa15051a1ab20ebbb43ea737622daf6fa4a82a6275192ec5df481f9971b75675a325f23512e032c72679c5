import { noop, isPlural, isAreAm, doDoes, getSubject, toInf, getTense } from '../lib.js'
const keep = { tags: true }

// walk->walked
const simple = (vb, parsed) => {
  const { conjugate, toInfinitive } = vb.methods.two.transform.verb
  const root = parsed.root
  let str = root.text('normal')
  str = toInfinitive(str, vb.model, getTense(root))
  // 'i walk' vs 'he walks'
  if (isPlural(vb, parsed) === false) {
    str = conjugate(str, vb.model).PresentTense
  }
  // handle copula
  if (root.has('#Copula')) {
    str = isAreAm(vb, parsed)
  }
  if (str) {
    vb = vb.replace(root, str, keep)
    vb.not('#Particle').tag('PresentTense')
  }
  // vb.replace('not ' + str, str + ' not')
  return vb
}

const toGerund = (vb, parsed) => {
  const { conjugate, toInfinitive } = vb.methods.two.transform.verb
  const root = parsed.root
  let str = root.text('normal')
  str = toInfinitive(str, vb.model, getTense(root))
  // 'i walk' vs 'he walks'
  if (isPlural(vb, parsed) === false) {
    str = conjugate(str, vb.model).Gerund
  }
  if (str) {
    vb = vb.replace(root, str, keep)
    vb.not('#Particle').tag('Gerund')
  }
  return vb
}

const vbToInf = (vb, parsed) => {
  const { toInfinitive } = vb.methods.two.transform.verb
  const root = parsed.root
  let str = parsed.root.text('normal')
  str = toInfinitive(str, vb.model, getTense(root))
  if (str) {
    vb = vb.replace(parsed.root, str, keep)
  }
  return vb
}



const forms = {
  // walk
  'infinitive': simple,
  // he walks -> he walked
  'simple-present': (vb, parsed) => {
    const { conjugate } = vb.methods.two.transform.verb
    let { root } = parsed
    // is it *only* a infinitive? - 'we buy' etc
    if (root.has('#Infinitive')) {
      let subj = getSubject(vb, parsed)
      let m = subj.subject
      if (isPlural(vb, parsed) || m.has('i')) {
        // keep it infinitive
        return vb
      }
      let str = root.text('normal')
      let pres = conjugate(str, vb.model).PresentTense
      if (str !== pres) {
        vb.replace(root, pres, keep)
      }
    } else {
      return simple(vb, parsed)
    }
    return vb
  },
  // he walked
  'simple-past': simple,
  // he will walk -> he walked
  'simple-future': (vb, parsed) => {
    const { root, auxiliary } = parsed
    // handle 'will be'
    if (auxiliary.has('will') && root.has('be')) {
      let str = isAreAm(vb, parsed)
      vb.replace(root, str)
      vb = vb.remove('will')
      vb.replace('not ' + str, str + ' not')
    } else {
      simple(vb, parsed)
      vb = vb.remove('will')
    }
    return vb
  },

  // is walking ->
  'present-progressive': noop,
  // was walking -> is walking
  'past-progressive': (vb, parsed) => {
    let str = isAreAm(vb, parsed)
    return vb.replace('(were|was)', str, keep)
  },
  // will be walking -> is walking
  'future-progressive': vb => {
    vb.match('will').insertBefore('is')
    vb.remove('be')
    return vb.remove('will')
  },

  // has walked ->  (?)
  'present-perfect': (vb, parsed) => {
    simple(vb, parsed)
    vb = vb.remove('(have|had|has)')
    return vb
  },

  // had walked -> has walked
  'past-perfect': (vb, parsed) => {
    // not 'we has walked'
    let subj = getSubject(vb, parsed)
    let m = subj.subject
    if (isPlural(vb, parsed) || m.has('i')) {
      vb = toInf(vb, parsed)// we walk
      vb.remove('had')
      return vb
    }
    vb.replace('had', 'has', keep)
    return vb
  },
  // will have walked -> has walked
  'future-perfect': vb => {
    vb.match('will').insertBefore('has')
    return vb.remove('have').remove('will')
  },

  // has been walking
  'present-perfect-progressive': noop,
  // had been walking
  'past-perfect-progressive': vb => vb.replace('had', 'has', keep),
  // will have been -> has been
  'future-perfect-progressive': vb => {
    vb.match('will').insertBefore('has')
    return vb.remove('have').remove('will')
  },

  // got walked -> is walked
  // was walked -> is walked
  // had been walked -> is walked
  'passive-past': (vb, parsed) => {
    let str = isAreAm(vb, parsed)
    if (vb.has('(had|have|has)') && vb.has('been')) {
      vb.replace('(had|have|has)', str, keep)
      vb.replace('been', 'being')
      return vb
    }
    return vb.replace('(got|was|were)', str)
  },
  // is being walked  ->
  'passive-present': noop,
  // will be walked -> is being walked
  'passive-future': vb => {
    vb.replace('will', 'is')
    return vb.replace('be', 'being')
  },

  // would be walked ->
  'present-conditional': noop,
  // would have been walked ->
  'past-conditional': vb => {
    vb.replace('been', 'be')
    return vb.remove('have')
  },

  // is going to drink -> is drinking
  'auxiliary-future': (vb, parsed) => {
    toGerund(vb, parsed)
    vb.remove('(going|to)')
    return vb
  },
  // used to walk -> is walking
  // did walk -> is walking
  'auxiliary-past': (vb, parsed) => {
    // 'did provide' -> 'does provide'
    if (parsed.auxiliary.has('did')) {
      let str = doDoes(vb, parsed)
      vb.replace(parsed.auxiliary, str)
      return vb
    }
    toGerund(vb, parsed)
    vb.replace(parsed.auxiliary, 'is')
    return vb
  },
  // we do walk ->
  'auxiliary-present': noop,

  // must walk -> 'must have walked'
  'modal-infinitive': noop,
  // must have walked
  'modal-past': (vb, parsed) => {
    vbToInf(vb, parsed)
    return vb.remove('have')
  },
  // started looking
  'gerund-phrase': (vb, parsed) => {
    parsed.root = parsed.root.not('#Gerund$')
    simple(vb, parsed)
    return vb.remove('(will|have)')
  },
  // wanted to walk
  'want-infinitive': (vb, parsed) => {
    let str = 'wants'
    if (isPlural(vb, parsed)) {
      str = 'want'//we want
    }
    vb.replace('(want|wanted|wants)', str, keep)
    vb.remove('will')
    return vb
  },
}

const toPresent = function (vb, parsed, form) {
  // console.log(form)
  if (forms.hasOwnProperty(form)) {
    vb = forms[form](vb, parsed)
    vb.fullSentence().compute(['tagger', 'chunks'])
    return vb
  }
  return vb
}
export default toPresent
