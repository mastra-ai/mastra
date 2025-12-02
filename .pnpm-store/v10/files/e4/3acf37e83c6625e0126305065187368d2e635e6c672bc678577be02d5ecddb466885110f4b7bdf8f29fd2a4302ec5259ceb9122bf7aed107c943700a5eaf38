'use strict'

const https = require('https')
const { createSecureServer, SERVER_HOSTNAME } = require('../utils')
const { HttpsProxyAgent } = require('../../')

function request (opts) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, resolve)
    req.on('error', reject)
    req.end(opts.body)
  })
}

const timeout = setTimeout(() => {
  console.log('The https agent is not cleaning up hanging sockets')
  process.exit(1)
}, 5000)

async function run () {
  const server = await createSecureServer()
  server.on('connect', (request, socket, head) => {
    socket.on('end', () => {
      clearTimeout(timeout)
    })
    const lines = [
      'HTTP/1.1 403 FORBIDDEN',
      '',
      'Forbidden'
    ]
    socket.write(lines.join('\r\n'))
  })

  const agent = new HttpsProxyAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 256,
    maxFreeSockets: 256,
    scheduling: 'lifo',
    timeout: 500,
    proxy: `https://${SERVER_HOSTNAME}:${server.address().port}`
  })

  try {
    await request({
      method: 'GET',
      hostname: 'www.example.com',
      port: '',
      path: '/',
      agent
    })
    console.error(new Error('Should throw'))
    process.exit(1)
  } catch (err) {
    if (err.message !== 'Bad response: 403') {
      console.error(new Error('Expected a different error, got:', err.message))
      process.exit(1)
    }
  }

  server.close()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
