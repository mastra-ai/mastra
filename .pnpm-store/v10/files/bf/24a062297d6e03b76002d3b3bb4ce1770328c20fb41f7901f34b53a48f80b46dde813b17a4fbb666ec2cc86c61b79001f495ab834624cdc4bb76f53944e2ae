'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { PassThrough } = require('node:stream')

const { sink, once } = require('./helper')
const pino = require('../')

test('Proxy and stream objects', async () => {
  const s = new PassThrough()
  s.resume()
  s.write('', () => {})
  const obj = { s, p: new Proxy({}, { get () { throw new Error('kaboom') } }) }
  const stream = sink()
  const instance = pino(stream)
  instance.info({ obj })

  const result = await once(stream, 'data')

  assert.equal(result.obj, '[unable to serialize, circular reference is too complex to analyze]')
})

test('Proxy and stream objects', async () => {
  const s = new PassThrough()
  s.resume()
  s.write('', () => {})
  const obj = { s, p: new Proxy({}, { get () { throw new Error('kaboom') } }) }
  const stream = sink()
  const instance = pino(stream)
  instance.info(obj)

  const result = await once(stream, 'data')

  assert.equal(result.p, '[unable to serialize, circular reference is too complex to analyze]')
})
