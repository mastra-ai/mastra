'use strict'
/* globals it */
const bent = require('../')
const tsame = require('tsame')
const assert = require('assert')
const zlib = require('zlib')
const ttype = (e, str) => same(e.constructor.name, str)
const qs = require('querystring')

const test = it
const same = (x, y) => assert.ok(tsame(x, y))

test('Invalid encoding', done => {
  try {
    bent('blah')
  } catch (e) {
    ttype(e, 'Error')
    same(e.message, 'Unknown encoding, blah')
    done()
  }
})

test('double method', done => {
  try {
    bent('GET', 'PUT')
  } catch (e) {
    ttype(e, 'Error')
    same(e.message, 'Can\'t set method to PUT, already set to GET.')
    done()
  }
})

test('double headers', done => {
  try {
    bent({}, {})
  } catch (e) {
    ttype(e, 'Error')
    same(e.message, 'Cannot set headers twice.')
    done()
  }
})

test('unknown protocol', async () => {
  try {
    const request = bent()
    await request('ftp://host.com')
    throw new Error('Should have already failed')
  } catch (e) {
    ttype(e, 'Error')
    same(e.message, 'Unknown protocol, ftp:')
  }
})

test('Invalid type', done => {
  try {
    bent(true)
  } catch (e) {
    ttype(e, 'Error')
    same(e.message, 'Unknown type: boolean')
    done()
  }
})

test('Invalid body', async () => {
  const r = bent('PUT')
  try {
    await r('http://localhost:3000', true)
    throw new Error('Should have failed')
  } catch (e) {
    ttype(e, 'Error')
    same(e.message, 'Unknown body type.')
  }
})

test('Invalid json', async () => {
  const r = bent('GET', 'json')
  try {
    await r('https://echo-server.mikeal.now.sh/src/echo.js?body=[asdf]')
    throw new Error('Should have failed')
  } catch (e) {
    assert.ok(e.message.startsWith('Unexpected token a in JSON'))
  }
})

const getError = async () => {
  const r = bent(201)
  try {
    await r('https://echo-server.mikeal.now.sh/src/echo.js?body="asdf"')
    throw new Error('Should have failed')
  } catch (e) {
    ttype(e, 'StatusError')
    return e
  }
}

test('error decodings', async () => {
  let e = await getError()
  same(await e.text(), '"asdf"')
  e = await getError()
  same(await e.json(), 'asdf')
})

if (!process.browser) {
  test('Z_BUF_ERROR error', async () => {
    const request = bent('json')
    try {
      await request('https://echo-server.mikeal.now.sh/src/echo.js?headers=content-encoding%3Agzip%2Ccontent-type%3Aapplication%2Fjson')
    } catch (e) {
      ttype(e, 'Error')
      return e
    }
  })
  test('gzip json compresssion SyntaxError', async () => {
    const request = bent('json')
    const base64 = zlib.gzipSync('ok').toString('base64')
    const headers = 'content-encoding:gzip,content-type:application/json'
    try {
      await request(`https://echo-server.mikeal.now.sh/src/echo.js?${qs.stringify({ base64, headers })}`)
    } catch (e) {
      ttype(e, 'SyntaxError')
      return e
    }
  })
}
