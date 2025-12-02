const BASE = 36
const seq = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const cache = seq.split('').reduce(function (h, c, i) {
  h[c] = i
  return h
}, {})

// 0, 1, 2, ..., A, B, C, ..., 00, 01, ... AA, AB, AC, ..., AAA, AAB, ...
const toAlphaCode = function (n) {
  if (seq[n] !== undefined) {
    return seq[n]
  }
  let places = 1
  let range = BASE
  let s = ''
  for (; n >= range; n -= range, places++, range *= BASE) {}
  while (places--) {
    const d = n % BASE
    s = String.fromCharCode((d < 10 ? 48 : 55) + d) + s
    n = (n - d) / BASE
  }
  return s
}

const fromAlphaCode = function (s) {
  if (cache[s] !== undefined) {
    return cache[s]
  }
  let n = 0
  let places = 1
  let range = BASE
  let pow = 1
  for (; places < s.length; n += range, places++, range *= BASE) {}
  for (let i = s.length - 1; i >= 0; i--, pow *= BASE) {
    let d = s.charCodeAt(i) - 48
    if (d > 10) {
      d -= 7
    }
    n += d * pow
  }
  return n
}

export default {
  toAlphaCode,
  fromAlphaCode
}
