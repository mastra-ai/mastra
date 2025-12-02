import { doDoes, toInf } from '../lib.js'
const keep = { tags: true }

// do/does not walk 
const doesNot = function (vb, parsed) {
  let does = doDoes(vb, parsed)
  vb.prepend(does + ' not')
  return vb
}

const isWas = function (vb) {
  // not be
  let m = vb.match('be')
  if (m.found) {
    m.prepend('not')
    return vb
  }
  // will not
  m = vb.match('(is|was|am|are|will|were)')
  if (m.found) {
    m.append('not')
    return vb
  }
  return vb
}

const hasCopula = (vb) => vb.has('(is|was|am|are|will|were|be)')

//vaguely, turn 'he is cool' into 'he is not cool'
const forms = {


  // he walks' -> 'he does not walk'
  'simple-present': (vb, parsed) => {
    // is/was
    if (hasCopula(vb) === true) {
      return isWas(vb, parsed)
    }
    // he walk
    vb = toInf(vb, parsed)
    // does not 
    vb = doesNot(vb, parsed)
    return vb
  },
  // 'he walked' -> 'he did not walk'
  'simple-past': (vb, parsed) => {
    // is/was
    if (hasCopula(vb) === true) {
      return isWas(vb, parsed)
    }
    // he walk
    vb = toInf(vb, parsed)
    // vb.debug()
    // did not walk
    vb.prepend('did not')
    return vb
  },

  // walk! -> 'do not walk'
  'imperative': (vb) => {
    vb.prepend('do not')
    return vb
  },
  // walk -> does not walk
  'infinitive': (vb, parsed) => {
    if (hasCopula(vb) === true) {
      return isWas(vb, parsed)
    }
    return doesNot(vb, parsed)
  },

  'passive-past': (vb) => {
    // got walked -> did not get walked
    if (vb.has('got')) {
      vb.replace('got', 'get', keep)
      vb.prepend('did not')
      return vb
    }
    // was walked, were walked
    // was being walked
    // had been walked, have been eaten
    let m = vb.match('(was|were|had|have)')
    if (m.found) {
      m.append('not')
    }
    return vb
  },
  'auxiliary-past': (vb) => {
    // used to walk
    if (vb.has('used')) {
      vb.prepend('did not')
      return vb
    }
    // he did walk
    let m = vb.match('(did|does|do)')
    if (m.found) {
      m.append('not')
    }
    return vb
  },

  // wants to walk
  'want-infinitive': (vb, parsed) => {
    // does not 
    vb = doesNot(vb, parsed)
    // want
    vb = vb.replace('wants', 'want', keep)
    return vb
  },

}

const toNegative = function (vb, parsed, form) {
  // console.log(form)
  if (vb.has('#Negative')) {
    return vb
  }
  if (forms.hasOwnProperty(form)) {
    vb = forms[form](vb, parsed)
    return vb
  }

  // 'not be'
  let m = vb.matchOne('be')
  if (m.found) {
    m.prepend('not')
    return vb
  }
  // is/was not
  if (hasCopula(vb) === true) {
    return isWas(vb, parsed)
  }

  // 'would not'
  m = vb.matchOne('(will|had|have|has|did|does|do|#Modal)')
  if (m.found) {
    m.append('not')
    return vb
  }
  // do nothing i guess?
  return vb
}
export default toNegative