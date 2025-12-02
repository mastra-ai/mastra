'use strict'
const http = require('http')
const https = require('https')
const { URL } = require('url')
const isStream = require('is-stream')
const caseless = require('caseless')
const bytes = require('bytesish')
const bent = require('./core')
const zlib = require('zlib')
const { PassThrough } = require('stream')

const compression = {}

/* istanbul ignore else */
if (zlib.createBrotliDecompress) compression.br = () => zlib.createBrotliDecompress()
/* istanbul ignore else */
if (zlib.createGunzip) compression.gzip = () => zlib.createGunzip()
/* istanbul ignore else */
if (zlib.createInflate) compression.deflate = () => zlib.createInflate()

const acceptEncoding = Object.keys(compression).join(', ')

const getResponse = resp => {
  const ret = new PassThrough()
  ret.statusCode = resp.statusCode
  ret.status = resp.statusCode
  ret.statusMessage = resp.statusMessage
  ret.headers = resp.headers
  ret._response = resp
  if (ret.headers['content-encoding']) {
    const encodings = ret.headers['content-encoding'].split(', ').reverse()
    while (encodings.length) {
      const enc = encodings.shift()
      if (compression[enc]) {
        const decompress = compression[enc]()
        decompress.on('error', (e) => ret.emit('error', new Error('ZBufError', e)))
        resp = resp.pipe(decompress)
      } else {
        break
      }
    }
  }
  return resp.pipe(ret)
}

class StatusError extends Error {
  constructor (res, ...params) {
    super(...params)

    Error.captureStackTrace(this, StatusError)
    this.name = 'StatusError'
    this.message = res.statusMessage
    this.statusCode = res.statusCode
    this.json = res.json
    this.text = res.text
    this.arrayBuffer = res.arrayBuffer
    this.headers = res.headers
    let buffer
    const get = () => {
      if (!buffer) buffer = this.arrayBuffer()
      return buffer
    }
    Object.defineProperty(this, 'responseBody', { get })
  }
}

const getBuffer = stream => new Promise((resolve, reject) => {
  const parts = []
  stream.on('error', reject)
  stream.on('end', () => resolve(Buffer.concat(parts)))
  stream.on('data', d => parts.push(d))
})

const decodings = res => {
  let _buffer
  res.arrayBuffer = () => {
    if (!_buffer) {
      _buffer = getBuffer(res)
      return _buffer
    } else {
      throw new Error('body stream is locked')
    }
  }
  res.text = () => res.arrayBuffer().then(buff => buff.toString())
  res.json = async () => {
    const str = await res.text()
    try {
      return JSON.parse(str)
    } catch (e) {
      e.message += `str"${str}"`
      throw e
    }
  }
}

const mkrequest = (statusCodes, method, encoding, headers, baseurl) => (_url, body = null, _headers = {}) => {
  _url = baseurl + (_url || '')
  const parsed = new URL(_url)
  let h
  if (parsed.protocol === 'https:') {
    h = https
  } else if (parsed.protocol === 'http:') {
    h = http
  } else {
    throw new Error(`Unknown protocol, ${parsed.protocol}`)
  }
  const request = {
    path: parsed.pathname + parsed.search,
    port: parsed.port,
    method: method,
    headers: { ...(headers || {}), ..._headers },
    hostname: parsed.hostname
  }
  if (parsed.username || parsed.password) {
    request.auth = [parsed.username, parsed.password].join(':')
  }
  const c = caseless(request.headers)
  if (encoding === 'json') {
    if (!c.get('accept')) {
      c.set('accept', 'application/json')
    }
  }
  if (!c.has('accept-encoding')) {
    c.set('accept-encoding', acceptEncoding)
  }
  return new Promise((resolve, reject) => {
    const req = h.request(request, async res => {
      res = getResponse(res)
      res.on('error', reject)
      decodings(res)
      res.status = res.statusCode
      if (!statusCodes.has(res.statusCode)) {
        return reject(new StatusError(res))
      }

      if (!encoding) return resolve(res)
      else {
        /* istanbul ignore else */
        if (encoding === 'buffer') {
          resolve(res.arrayBuffer())
        } else if (encoding === 'json') {
          resolve(res.json())
        } else if (encoding === 'string') {
          resolve(res.text())
        }
      }
    })
    req.on('error', reject)
    if (body) {
      if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        body = bytes.native(body)
      }
      if (Buffer.isBuffer(body)) {
        // noop
      } else if (typeof body === 'string') {
        body = Buffer.from(body)
      } else if (isStream(body)) {
        body.pipe(req)
        body = null
      } else if (typeof body === 'object') {
        if (!c.has('content-type')) {
          req.setHeader('content-type', 'application/json')
        }
        body = Buffer.from(JSON.stringify(body))
      } else {
        reject(new Error('Unknown body type.'))
      }
      if (body) {
        req.setHeader('content-length', body.length)
        req.end(body)
      }
    } else {
      req.end()
    }
  })
}

module.exports = bent(mkrequest)
