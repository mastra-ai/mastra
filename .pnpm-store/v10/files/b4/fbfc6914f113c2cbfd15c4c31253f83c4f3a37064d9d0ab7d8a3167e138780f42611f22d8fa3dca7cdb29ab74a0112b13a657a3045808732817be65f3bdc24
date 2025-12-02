/* globals atob, it */
'use strict'
const bent = require('../')
const assert = require('assert')
const tsame = require('tsame')
const { PassThrough } = require('stream')

const http = require('http')

const test = it

const same = (x, y) => assert.ok(tsame(x, y))

const baseurl = 'https://echo-server.mikeal.now.sh/src'
const u = path => baseurl + path

const enc = str => (new TextEncoder()).encode(str).buffer
const dec = str => Uint8Array.from(atob(str), c => c.charCodeAt(0)).buffer
const decode = arr => (new TextDecoder('utf-8')).decode(arr)

test('basic 200 ok', async () => {
  const request = bent('string')
  const str = await request(u('/echo.js?body=ok'))
  same(str, 'ok')
})

test('basic 200 ok baseurl', async () => {
  const request = bent('string', baseurl)
  const str = await request('/echo.js?body=ok')
  same(str, 'ok')
})

test('basic 200', async () => {
  const request = bent()
  const res = await request(u('/echo.js?body=ok'))
  same(res.statusCode, 200)
})

test('basic buffer', async () => {
  const request = bent('buffer')
  const buff = await request(u('/echo.js?body=ok'))
  if (buff instanceof ArrayBuffer) {
    same(buff, enc('ok'))
  } else {
    same(buff, Buffer.from('ok'))
  }
})

test('double buffer decode', async () => {
  const request = bent()
  const resp = await request(u('/echo.js?body=ok'))
  const validate = buff => {
    if (buff instanceof ArrayBuffer) {
      same(buff, enc('ok'))
    } else {
      same(buff, Buffer.from('ok'))
    }
  }
  validate(await resp.arrayBuffer())
  let threw = true
  try {
    await resp.arrayBuffer()
    threw = false
  } catch (e) {
    if (!e.message.includes('body stream is locked')) throw e
  }
  assert.ok(threw)
})

test('basic json', async () => {
  const request = bent('json')
  const json = await request(u('/info.js'))
  same(json.method, 'GET')
})

test('json based media type', async () => {
  const request = bent('json', { accept: 'application/vnd.something.com' })
  const json = await request(u('/info.js'))
  same(json.headers.accept, 'application/vnd.something.com')
})

test('basic PUT', async () => {
  const request = bent('PUT', 'json')
  let body
  if (process.browser) {
    body = enc(Math.random().toString())
  } else {
    body = Buffer.from(Math.random().toString())
  }
  const json = await request(u('/info.js'), body)
  if (process.browser) {
    same(dec(json.base64), body)
  } else {
    same(Buffer.from(json.base64, 'base64'), body)
  }
})

test('base PUT string', async () => {
  const request = bent('PUT', 'json')
  const json = await request(u('/info.js'), 'teststring')
  if (process.browser) {
    same(atob(json.base64), 'teststring')
  } else {
    same(Buffer.from(json.base64, 'base64').toString(), 'teststring')
  }
})

test('status 201', async () => {
  const request = bent('string', 201)
  const str = await request(u('/echo.js?statusCode=201&body=ok'))
  same(str, 'ok')

  try {
    await request(u('/echo.js?body=ok'))
    throw new Error('Call should have thrown.')
  } catch (e) {
    same(e.message, process.browser ? null : 'OK')
    // basic header test
    same(e.headers['content-length'], '2')
  }
})

test('multiple status', async () => {
  const request = bent('string', [200, 201])
  const str200 = await request(u('/echo.js?body=ok'))
  same(str200, 'ok')

  const str201 = await request(u('/echo.js?statusCode=201&body=ok'))
  same(str201, 'ok')

  try {
    await request(u('/echo.js?statusCode=202&body=ok'))
    throw new Error('Call should have thrown.')
  } catch (e) {
    same(e.message, process.browser ? null : 'Accepted')
    // basic header test
    same(e.headers['content-length'], '2')
  }
})

test('PUT stream', async () => {
  const body = Buffer.from(Math.random().toString())
  const request = bent('PUT', 'json')
  const b = new PassThrough()
  const res = request(u('/info.js'), b)
  b.end(body)
  const info = await res
  same(info.method, 'PUT')
  // Unfortunately, we can't test this against lamda cause it doesn't support
  // transfer-encoding: chunked.
  // t.same(Buffer.from(info.base64, 'base64'), body)
})

test('PUT JSON', async () => {
  const request = bent('PUT', 'json')
  const info = await request(u('/info.js'), { ok: 200 })
  let res
  if (process.browser) {
    res = JSON.parse(atob(info.base64))
  } else {
    res = JSON.parse(Buffer.from(info.base64, 'base64').toString())
  }
  same(res, { ok: 200 })
  same(info.headers['content-type'], 'application/json')
})

if (process.browser) {
  test('500 Response body and message', async () => {
    const request = bent()
    let body
    let _e
    try {
      await request(u('/echo.js?statusCode=500&body=ok'))
    } catch (e) {
      _e = e
      body = e.responseBody
    }
    const validate = buffer => {
      if (process.browser) {
        same(decode(buffer), 'ok')
      } else {
        same(buffer.toString(), 'ok')
      }
    }
    validate(await body)
    // should be able to access again
    validate(await _e.responseBody)

    same(_e.message, null)
  })
} else {
  test('500 Response body and message', async () => {
    const request = bent()
    let body
    let _e
    try {
      await request(u('/echo.js?statusCode=500&body=ok'))
    } catch (e) {
      _e = e
      body = e.responseBody
    }
    const validate = buffer => {
      if (process.browser) {
        same(decode(buffer), 'ok')
      } else {
        same(buffer.toString(), 'ok')
      }
    }
    validate(await body)
    // should be able to access again
    validate(await _e.responseBody)

    same(_e.message, 'Internal Server Error')
  })
}

test('auth', async () => {
  const request = bent('https://test:pass@httpbin.org/basic-auth/test/pass', 'json')
  const obj = await request()
  same(obj, { authenticated: true, user: 'test' })
})

if (process.browser) {
  test('override headers', async () => {
    const request = bent('string', { Accept: 'application/json' })
    let info = await request(u('/info.js'), null, { Accept: 'application/xml' })
    info = JSON.parse(info)
    same(info.headers.accept, 'application/xml')
  })
} else {
  test('override headers', async () => {
    const request = bent('json', { 'X-Default': 'ok', 'X-Override-Me': 'not overriden' })
    const info = await request(u('/info.js'), null, { 'X-Override-Me': 'overriden', 'X-New': 'ok' })
    same(info.headers['x-default'], 'ok')
    same(info.headers['x-override-me'], 'overriden')
    same(info.headers['x-new'], 'ok')
  })

  test('manually-set content-type header when body is present', async () => {
    const server = http.createServer((request, response) => {
      response.statusCode = request.headers['content-type'] === 'application/jose+json' ? 200 : 400
      response.end()
    })
    await new Promise((resolve, reject) => {
      server.listen(9999, () => {
        resolve()
      })
    })
    const request = bent('POST')
    const response = request('http://localhost:9999', { ok: true }, { 'content-type': 'application/jose+json' })
    const info = await response
    same(info.statusCode, 200)
    server.close()
  })
}
