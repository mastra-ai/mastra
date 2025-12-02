/* globals atob, btoa, crypto */
/* istanbul ignore file */
'use strict'
const bytes = require('./core')

bytes.from = (_from, _encoding) => {
  if (_from instanceof DataView) return _from
  if (_from instanceof ArrayBuffer) return new DataView(_from)
  let buffer
  if (typeof _from === 'string') {
    if (!_encoding) {
      _encoding = 'utf-8'
    } else if (_encoding === 'base64') {
      buffer = Uint8Array.from(atob(_from), c => c.charCodeAt(0)).buffer
      return new DataView(buffer)
    }
    if (_encoding !== 'utf-8') throw new Error('Browser support for encodings other than utf-8 not implemented')
    return new DataView((new TextEncoder()).encode(_from).buffer)
  } else if (typeof _from === 'object') {
    if (ArrayBuffer.isView(_from)) {
      if (_from.byteLength === _from.buffer.byteLength) return new DataView(_from.buffer)
      else return new DataView(_from.buffer, _from.byteOffset, _from.byteLength)
    }
  }
  throw new Error('Unkown type. Cannot convert to ArrayBuffer')
}

bytes.toString = (_from, encoding) => {
  _from = bytes(_from, encoding)
  const uint = new Uint8Array(_from.buffer, _from.byteOffset, _from.byteLength)
  const str = String.fromCharCode(...uint)
  if (encoding === 'base64') {
    /* would be nice to find a way to do this directly from a buffer
     * instead of doing two string conversions
     */
    return btoa(str)
  } else {
    return str
  }
}

bytes.native = (_from, encoding) => {
  if (_from instanceof Uint8Array) return _from
  _from = bytes.from(_from, encoding)
  return new Uint8Array(_from.buffer, _from.byteOffset, _from.byteLength)
}

if (process.browser) bytes._randomFill = (...args) => crypto.getRandomValues(...args)

module.exports = bytes
