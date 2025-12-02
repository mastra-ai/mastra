'use strict'
/* globals it */
const bent = require('../')
const assert = require('assert')
const tsame = require('tsame')
const qs = require('querystring')
const zlib = require('zlib')

const test = it

const same = (x, y) => assert.ok(tsame(x, y))

const baseurl = 'https://echo-server.mikeal.now.sh/src'
const u = path => baseurl + path

if (!process.browser) {
  test('accept header', async () => {
    let request = bent('json')
    let json = await request(u('/info.js'))
    same(json.headers['accept-encoding'], 'br, gzip, deflate')

    request = bent('json', { 'Accept-Encoding': 'test' })
    json = await request(u('/info.js'))
    same(json.headers['accept-encoding'], 'test')
  })

  test('brotli', async () => {
    const request = bent('string', baseurl)
    const base64 = zlib.brotliCompressSync('ok').toString('base64')
    const headers = 'content-encoding:br'
    const str = await request(`/echo.js?${qs.stringify({ base64, headers })}`)
    same(str, 'ok')
  })

  test('gzip', async () => {
    const request = bent('string', baseurl)
    const base64 = zlib.gzipSync('ok').toString('base64')
    const headers = 'content-encoding:gzip'
    const str = await request(`/echo.js?${qs.stringify({ base64, headers })}`)
    same(str, 'ok')
  })

  test('deflate', async () => {
    const request = bent('string', baseurl)
    const base64 = zlib.deflateSync('ok').toString('base64')
    const headers = 'content-encoding:deflate'
    const str = await request(`/echo.js?${qs.stringify({ base64, headers })}`)
    same(str, 'ok')
  })

  test('unknown', async () => {
    const request = bent('buffer', baseurl)
    const base64 = zlib.gzipSync('untouched').toString('base64')
    const headers = 'content-encoding:myown'
    const buffer = await request(`/echo.js?${qs.stringify({ base64, headers })}`)
    const str = zlib.gunzipSync(buffer).toString('utf8')
    same(str, 'untouched')
  })
}
