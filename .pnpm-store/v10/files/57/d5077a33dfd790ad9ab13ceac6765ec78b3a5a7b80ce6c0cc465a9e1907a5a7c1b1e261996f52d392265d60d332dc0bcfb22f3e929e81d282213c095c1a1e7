'use strict'

const https = require('https')
const test = require('ava')
const { createSecureServer, createSecureProxy, PROXY_HOSTNAME, SERVER_HOSTNAME } = require('./utils')
const { HttpsProxyAgent } = require('../')

function request (opts) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, resolve)
    req.on('error', reject)
    req.end(opts.body)
  })
}

test('Basic', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  const response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent: new HttpsProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
    })
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Connection header (keep-alive)', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  proxy.authenticate = function (req, fn) {
    t.is(req.headers.connection, 'keep-alive')
    fn(null, true)
  }

  const response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent: new HttpsProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
    })
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Connection header (close)', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  proxy.authenticate = function (req, fn) {
    t.is(req.headers.connection, 'close')
    fn(null, true)
  }

  const response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent: new HttpsProxyAgent({
      keepAlive: false,
      keepAliveMsecs: 1000,
      maxSockets: Infinity,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
    })
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Proxy authentication (empty)', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  proxy.authenticate = function (req, fn) {
    fn(null, req.headers['proxy-authorization'] === undefined)
  }

  const response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent: new HttpsProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
    })
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Proxy authentication', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  proxy.authenticate = function (req, fn) {
    fn(null, req.headers['proxy-authorization'] === `Basic ${Buffer.from('hello:world').toString('base64')}`)
  }

  const response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent: new HttpsProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `https://hello:world@${PROXY_HOSTNAME}:${proxy.address().port}`
    })
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Configure the agent to reuse sockets', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  let count = 0
  proxy.on('connection', () => {
    count += 1
    t.is(count, 1)
  })

  const agent = new HttpsProxyAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 256,
    maxFreeSockets: 256,
    scheduling: 'lifo',
    proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
  })

  let response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent
  })

  body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Configure the agent to NOT reuse sockets', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  const ports = []
  proxy.on('connection', socket => {
    t.false(ports.includes(socket.remotePort))
    ports.push(socket.remotePort)
  })

  const agent = new HttpsProxyAgent({
    keepAlive: false,
    keepAliveMsecs: 1000,
    maxSockets: Infinity,
    maxFreeSockets: 256,
    scheduling: 'lifo',
    proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
  })

  let response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent
  })

  body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Timeout', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  try {
    await request({
      method: 'GET',
      hostname: SERVER_HOSTNAME,
      port: server.address().port,
      path: '/',
      timeout: 1,
      agent: new HttpsProxyAgent({
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 256,
        maxFreeSockets: 256,
        scheduling: 'lifo',
        proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
      })
    })
    t.fail('Should throw')
  } catch (err) {
    t.is(err.message, 'Proxy timeout')
  }

  server.close()
  proxy.close()
})

test('Username and password should not be encoded', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  proxy.authenticate = function (req, fn) {
    fn(null, req.headers['proxy-authorization'] === `Basic ${Buffer.from('username_with_=:password_with_=').toString('base64')}`)
  }

  const response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent: new HttpsProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `https://username_with_=:password_with_=@${PROXY_HOSTNAME}:${proxy.address().port}`
    })
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Proxy request options should be passed to the CONNECT request only', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  let serverCustomHeaderReceived
  let proxyCustomHeaderReceived
  server.on('request', (req, res) => {
    serverCustomHeaderReceived = req.headers['x-custom-header']
    return res.end('ok')
  })
  proxy.on('connect', (req) => {
    proxyCustomHeaderReceived = req.headers['x-custom-header']
  })

  const response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent: new HttpsProxyAgent({
      proxyRequestOptions: {
        headers: {
          'x-custom-header': 'value'
        }
      },
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
    })
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)
  t.falsy(serverCustomHeaderReceived)
  t.is(proxyCustomHeaderReceived, 'value')

  server.close()
  proxy.close()
})

test('Proxy request options should not override internal default options for CONNECT request', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  let proxyConnectionHeaderReceived
  server.on('request', (req, res) => res.end('ok'))
  proxy.on('connect', (req) => {
    proxyConnectionHeaderReceived = req.headers.connection
  })

  const response = await request({
    method: 'GET',
    hostname: SERVER_HOSTNAME,
    port: server.address().port,
    path: '/',
    agent: new HttpsProxyAgent({
      proxyRequestOptions: {
        headers: {
          connection: 'close'
        }
      },
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
    })
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)
  t.is(proxyConnectionHeaderReceived, 'keep-alive')

  server.close()
  proxy.close()
})
