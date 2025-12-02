'use strict'

const test = require('node:test')
const http = require('node:http')
const os = require('node:os')
const tspl = require('@matteo.collina/tspl')

const { sink, once } = require('./helper')
const pino = require('../')

const { pid } = process
const hostname = os.hostname()

test('http request support', async (t) => {
  const plan = tspl(t, { plan: 3 })
  let originalReq
  const instance = pino(sink((chunk, enc) => {
    plan.ok(new Date(chunk.time) <= new Date(), 'time is greater than Date.now()')
    delete chunk.time
    plan.deepEqual(chunk, {
      pid,
      hostname,
      level: 30,
      msg: 'my request',
      req: {
        method: originalReq.method,
        url: originalReq.url,
        headers: originalReq.headers,
        remoteAddress: originalReq.socket.remoteAddress,
        remotePort: originalReq.socket.remotePort
      }
    })
  }))

  const server = http.createServer((req, res) => {
    originalReq = req
    instance.info(req, 'my request')
    res.end('hello')
  })
  server.unref()
  server.listen()
  const err = await once(server, 'listening')
  plan.equal(err, undefined)
  const res = await once(http.get('http://localhost:' + server.address().port), 'response')
  res.resume()
  server.close()

  await plan
})

test('http request support via serializer', async (t) => {
  const plan = tspl(t, { plan: 3 })
  let originalReq
  const instance = pino({
    serializers: {
      req: pino.stdSerializers.req
    }
  }, sink((chunk, enc) => {
    plan.ok(new Date(chunk.time) <= new Date(), 'time is greater than Date.now()')
    delete chunk.time
    plan.deepEqual(chunk, {
      pid,
      hostname,
      level: 30,
      msg: 'my request',
      req: {
        method: originalReq.method,
        url: originalReq.url,
        headers: originalReq.headers,
        remoteAddress: originalReq.socket.remoteAddress,
        remotePort: originalReq.socket.remotePort
      }
    })
  }))

  const server = http.createServer(function (req, res) {
    originalReq = req
    instance.info({ req }, 'my request')
    res.end('hello')
  })
  server.unref()
  server.listen()
  const err = await once(server, 'listening')
  plan.equal(err, undefined)

  const res = await once(http.get('http://localhost:' + server.address().port), 'response')
  res.resume()
  server.close()

  await plan
})

test('http response support', async (t) => {
  const plan = tspl(t, { plan: 3 })
  let originalRes
  const instance = pino(sink((chunk, enc) => {
    plan.ok(new Date(chunk.time) <= new Date(), 'time is greater than Date.now()')
    delete chunk.time
    plan.deepEqual(chunk, {
      pid,
      hostname,
      level: 30,
      msg: 'my response',
      res: {
        statusCode: originalRes.statusCode,
        headers: originalRes.getHeaders()
      }
    })
  }))

  const server = http.createServer(function (req, res) {
    originalRes = res
    res.end('hello')
    instance.info(res, 'my response')
  })
  server.unref()
  server.listen()
  const err = await once(server, 'listening')

  plan.equal(err, undefined)

  const res = await once(http.get('http://localhost:' + server.address().port), 'response')
  res.resume()
  server.close()

  await plan
})

test('http response support via a serializer', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const instance = pino({
    serializers: {
      res: pino.stdSerializers.res
    }
  }, sink((chunk, enc) => {
    plan.ok(new Date(chunk.time) <= new Date(), 'time is greater than Date.now()')
    delete chunk.time
    plan.deepEqual(chunk, {
      pid,
      hostname,
      level: 30,
      msg: 'my response',
      res: {
        statusCode: 200,
        headers: {
          'x-single': 'y',
          'x-multi': [1, 2]
        }
      }
    })
  }))

  const server = http.createServer(function (req, res) {
    res.setHeader('x-single', 'y')
    res.setHeader('x-multi', [1, 2])
    res.end('hello')
    instance.info({ res }, 'my response')
  })

  server.unref()
  server.listen()
  const err = await once(server, 'listening')
  plan.equal(err, undefined)

  const res = await once(http.get('http://localhost:' + server.address().port), 'response')
  res.resume()
  server.close()

  await plan
})

test('http request support via serializer in a child', async (t) => {
  const plan = tspl(t, { plan: 3 })
  let originalReq
  const instance = pino({
    serializers: {
      req: pino.stdSerializers.req
    }
  }, sink((chunk, enc) => {
    plan.ok(new Date(chunk.time) <= new Date(), 'time is greater than Date.now()')
    delete chunk.time
    plan.deepEqual(chunk, {
      pid,
      hostname,
      level: 30,
      msg: 'my request',
      req: {
        method: originalReq.method,
        url: originalReq.url,
        headers: originalReq.headers,
        remoteAddress: originalReq.socket.remoteAddress,
        remotePort: originalReq.socket.remotePort
      }
    })
  }))

  const server = http.createServer(function (req, res) {
    originalReq = req
    const child = instance.child({ req })
    child.info('my request')
    res.end('hello')
  })

  server.unref()
  server.listen()
  const err = await once(server, 'listening')
  plan.equal(err, undefined)

  const res = await once(http.get('http://localhost:' + server.address().port), 'response')
  res.resume()
  server.close()

  await plan
})
