import getRoot from './root.js'
import getAdverbs from './adverbs.js'

const getAuxiliary = function (vb, root) {
  let parts = vb.splitBefore(root)
  if (parts.length <= 1) {
    return vb.none()
  }
  let aux = parts.eq(0)
  aux = aux.not('(#Adverb|#Negative|#Prefix)')
  return aux
}

const getNegative = function (vb) {
  return vb.match('#Negative')
}

// pull-apart phrasal-verb into verb-particle
const getPhrasal = function (root) {
  if (!root.has('(#Particle|#PhrasalVerb)')) {
    return {
      verb: root.none(),
      particle: root.none()
    }
  }
  let particle = root.match('#Particle$')
  return {
    verb: root.not(particle),
    particle: particle,
  }
}

const parseVerb = function (view) {
  let vb = view.clone()
  vb.contractions().expand()
  const root = getRoot(vb)
  let res = {
    root: root,
    prefix: vb.match('#Prefix'),
    adverbs: getAdverbs(vb, root),
    auxiliary: getAuxiliary(vb, root),
    negative: getNegative(vb),
    phrasal: getPhrasal(root),
  }
  return res
}
export default parseVerb
