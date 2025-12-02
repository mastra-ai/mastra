'use strict'

const proxy = require('proxy')
const { readFileSync } = require('fs')
const { join } = require('path')
const http = require('http')
const https = require('https')
const dns = require('dns')

/**
 * We've manually created self signed certificates for the proxy
 * and for the server, with the following domains (Subject CN)
 * proxy.hpagent-unit-test.com
 * server.hpagent-unit-test.com
 *
 * This will allow us to properly test the TLS-over-TLS proxy,
 * specifically that the first handshake provides the proxy SNI, not the server SNI.
 *
 * These certs were generated using openssl:
 * openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout key_server.pem -out cert_server.pem
 * openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout key_proxy.pem -out cert_proxy.pem
 *
 * The certs are concatenated to the can be passed to Node.JS as trusted certs:
 * $ cat cert_proxy.pem > certs_unit_test.pem
 * $ cat cert_server.pem >> certs_unit_test.pem
 *
 * using `NODE_EXTRA_CA_CERTS` (https://nodejs.org/api/cli.html#node_extra_ca_certsfile)
 *
 * This allows actual verification of the certs w/ hostname instead of ignoring all errors
 */

const sslProxy = {
  key: readFileSync(join(__dirname, 'fixtures/key_proxy.pem')),
  cert: readFileSync(join(__dirname, 'fixtures/cert_proxy.pem'))
}

const sslServer = {
  key: readFileSync(join(__dirname, 'fixtures/key_server.pem')),
  cert: readFileSync(join(__dirname, 'fixtures/cert_server.pem'))
}

/**
 * We override all DNS requests from the node process (for unit test) to resolve to
 * 127.0.0.1. This allows us to use the self signed certs we made for the fake
 * domains to be verified, and then the connection made to localhost.
 */
dns.lookup = (hostname, opts, cb) => {
  if (typeof opts === 'function') {
    return opts(null, '127.0.0.1', 4)
  }

  return cb(null, '127.0.0.1', 4)
}

function createProxy () {
  return new Promise((resolve, reject) => {
    const server = proxy(http.createServer())
    server.listen(0, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

function createSecureProxy () {
  return new Promise((resolve, reject) => {
    const server = proxy(https.createServer(sslProxy))
    server.listen(0, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

function createServer (handler, callback) {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.listen(0, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

function createSecureServer (handler, callback) {
  return new Promise((resolve, reject) => {
    const server = https.createServer(sslServer)
    server.listen(0, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

const PROXY_HOSTNAME = 'proxy.hpagent-unit-test.com'
const SERVER_HOSTNAME = 'server.hpagent-unit-test.com'

module.exports = {
  createProxy,
  createSecureProxy,
  createServer,
  createSecureServer,
  PROXY_HOSTNAME,
  SERVER_HOSTNAME
}
