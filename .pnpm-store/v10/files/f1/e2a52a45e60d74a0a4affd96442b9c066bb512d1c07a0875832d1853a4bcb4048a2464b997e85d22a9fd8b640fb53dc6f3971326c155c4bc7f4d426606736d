'use strict'

const fetch = require('node-fetch')
const test = require('ava')
const {
  createServer,
  createSecureServer,
  createProxy,
  createSecureProxy,
  PROXY_HOSTNAME,
  SERVER_HOSTNAME
} = require('./utils')
const { HttpProxyAgent, HttpsProxyAgent } = require('../')

test('http to http', async t => {
  const server = await createServer()
  const proxy = await createProxy()
  server.on('request', (req, res) => res.end('ok'))

  const response = await fetch(`http://${server.address().address}:${server.address().port}`, {
    agent: new HttpProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `http://${proxy.address().address}:${proxy.address().port}`
    })
  })

  t.is(await response.text(), 'ok')
  t.is(response.status, 200)

  server.close()
  proxy.close()
})

test('https to http', async t => {
  const server = await createServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  const response = await fetch(`http://${server.address().address}:${server.address().port}`, {
    agent: new HttpProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
    })
  })

  t.is(await response.text(), 'ok')
  t.is(response.status, 200)

  server.close()
  proxy.close()
})

test('http to https', async t => {
  const server = await createSecureServer()
  const proxy = await createProxy()
  server.on('request', (req, res) => res.end('ok'))

  const response = await fetch(`https://${SERVER_HOSTNAME}:${server.address().port}`, {
    agent: new HttpsProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `http://${proxy.address().address}:${proxy.address().port}`
    })
  })

  t.is(await response.text(), 'ok')
  t.is(response.status, 200)

  server.close()
  proxy.close()
})

test('https to https', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  server.on('request', (req, res) => res.end('ok'))

  const response = await fetch(`https://${SERVER_HOSTNAME}:${server.address().port}`, {
    agent: new HttpsProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `https://${PROXY_HOSTNAME}:${proxy.address().port}`
    })
  })

  t.is(await response.text(), 'ok')
  t.is(response.status, 200)

  server.close()
  proxy.close()
})
