'use strict'

const length = (a, b) => {
  if (a.byteLength === b.byteLength) return a.byteLength
  else if (a.byteLength > b.byteLength) return a.byteLength
  return b.byteLength
}

const bytes = (_from, encoding) => bytes.from(_from, encoding)

bytes.sorter = (a, b) => {
  a = bytes(a)
  b = bytes(b)
  const len = length(a, b)
  let i = 0
  while (i < (len - 1)) {
    if (i >= a.byteLength) return 1
    else if (i >= b.byteLength) return -1

    if (a.getUint8(i) < b.getUint8(i)) return -1
    else if (a.getUint8(i) > b.getUint8(i)) return 1
    i++
  }
  return 0
}

bytes.compare = (a, b) => !bytes.sorter(a, b)
bytes.memcopy = (_from, encoding) => {
  const b = bytes(_from, encoding)
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
}
bytes.arrayBuffer = (_from, encoding) => {
  _from = bytes(_from, encoding)
  if (_from.buffer.byteLength === _from.byteLength) return _from.buffer
  return _from.buffer.slice(_from.byteOffset, _from.byteOffset + _from.byteLength)
}
const sliceOptions = (_from, start = 0, end = null) => {
  _from = bytes(_from)
  end = (end === null ? _from.byteLength : end) - start
  return [_from.buffer, _from.byteOffset + start, end]
}
bytes.slice = (_from, start, end) => new DataView(...sliceOptions(_from, start, end))

bytes.memcopySlice = (_from, start, end) => {
  const [buffer, offset, length] = sliceOptions(_from, start, end)
  return buffer.slice(offset, length + offset)
}
bytes.typedArray = (_from, _Class = Uint8Array) => {
  _from = bytes(_from)
  return new _Class(_from.buffer, _from.byteOffset, _from.byteLength / _Class.BYTES_PER_ELEMENT)
}

bytes.concat = (_from) => {
  _from = Array.from(_from)
  _from = _from.map(b => bytes(b))
  const length = _from.reduce((x, y) => x + y.byteLength, 0)
  const ret = new Uint8Array(length)
  let i = 0
  for (const part of _from) {
    const view = bytes.typedArray(part)
    ret.set(view, i)
    i += view.byteLength
  }
  return ret.buffer
}

const maxEntropy = 65536

bytes.random = length => {
  const ab = new ArrayBuffer(length)
  if (length > maxEntropy) {
    let i = 0
    while (i < ab.byteLength) {
      let len
      if (i + maxEntropy > ab.byteLength) len = ab.byteLength - i
      else len = maxEntropy
      const view = new Uint8Array(ab, i, len)
      i += maxEntropy
      bytes._randomFill(view)
    }
  } else {
    const view = new Uint8Array(ab)
    bytes._randomFill(view)
  }
  return ab
}

module.exports = bytes
