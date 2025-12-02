const hasContraction = /'/
const isFeminine = /(e|é|aison|sion|tion)$/
const isMasculine = /(age|isme|acle|ege|oire)$/
// l'amour
const preL = (terms, i) => {
  // le/la
  let after = terms[i].normal.split(hasContraction)[1]
  // quick french gender disambig (rough)
  if (after && after.endsWith('e')) {
    return ['la', after]
  }
  return ['le', after]
}

// d'amerique
const preD = (terms, i) => {
  let after = terms[i].normal.split(hasContraction)[1]
  // quick guess for noun-agreement (rough)
  if (after && isFeminine.test(after) && !isMasculine.test(after)) {
    return ['du', after]
  } else if (after && after.endsWith('s')) {
    return ['des', after]
  }
  return ['de', after]
}

// j'aime
const preJ = (terms, i) => {
  let after = terms[i].normal.split(hasContraction)[1]
  return ['je', after]
}

export default {
  preJ,
  preL,
  preD,
}
