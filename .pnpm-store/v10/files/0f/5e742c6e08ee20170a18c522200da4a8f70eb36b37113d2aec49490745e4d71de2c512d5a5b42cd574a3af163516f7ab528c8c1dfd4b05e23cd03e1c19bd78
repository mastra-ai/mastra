/* eslint-disable no-bitwise */
/* eslint-disable no-mixed-operators */
/* eslint-disable no-multi-assign */

// https://github.com/jbt/tiny-hashes/
let k = [],
  i = 0
for (; i < 64; ) {
  k[i] = 0 | (Math.sin(++i % Math.PI) * 4294967296)
}

const md5 = function (s) {
  let b,
    c,
    d,
    h = [(b = 0x67452301), (c = 0xefcdab89), ~b, ~c],
    words = [],
    j = decodeURI(encodeURI(s)) + '\x80',
    a = j.length

  s = (--a / 4 + 2) | 15

  words[--s] = a * 8

  for (; ~a; ) {
    words[a >> 2] |= j.charCodeAt(a) << (8 * a--)
  }

  for (i = j = 0; i < s; i += 16) {
    a = h

    for (
      ;
      j < 64;
      a = [
        (d = a[3]),
        b +
          (((d =
            a[0] +
            [(b & c) | (~b & d), (d & b) | (~d & c), b ^ c ^ d, c ^ (b | ~d)][(a = j >> 4)] +
            k[j] +
            ~~words[i | ([j, 5 * j + 1, 3 * j + 5, 7 * j][a] & 15)]) <<
            (a = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][4 * a + (j++ % 4)])) |
            (d >>> -a)),
        b,
        c,
      ]
    ) {
      b = a[1] | 0
      c = a[2]
    }
    for (j = 4; j; ) h[--j] += a[j]
  }

  for (s = ''; j < 32; ) {
    s += ((h[j >> 3] >> ((1 ^ j++) * 4)) & 15).toString(16)
  }

  return s
}
export default md5
// console.log(md5('food-safety'))
