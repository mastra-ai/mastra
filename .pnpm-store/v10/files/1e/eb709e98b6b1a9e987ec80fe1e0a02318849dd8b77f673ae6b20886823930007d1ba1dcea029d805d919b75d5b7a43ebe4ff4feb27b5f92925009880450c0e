const commonPrefix = function (w1, w2) {
  let len = Math.min(w1.length, w2.length)
  while (len > 0) {
    const prefix = w1.slice(0, len)
    if (prefix === w2.slice(0, len)) {
      return prefix
    }
    len -= 1
  }
  return ''
}

/* Sort elements and remove duplicates from array (modified in place) */
const unique = function (a) {
  a.sort()
  for (let i = 1; i < a.length; i++) {
    if (a[i - 1] === a[i]) {
      a.splice(i, 1)
    }
  }
}

export default {
  commonPrefix,
  unique
}
