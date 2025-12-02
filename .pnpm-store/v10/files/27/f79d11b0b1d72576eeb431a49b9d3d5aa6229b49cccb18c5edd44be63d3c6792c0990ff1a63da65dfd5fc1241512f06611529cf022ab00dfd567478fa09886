'use strict'

/* eslint no-prototype-builtins: 0 */

const test = require('node:test')
const assert = require('node:assert')

const { sink, once } = require('./helper')
const pino = require('../')

test('pino exposes standard time functions', async () => {
  assert.ok(pino.stdTimeFunctions)
  assert.ok(pino.stdTimeFunctions.epochTime)
  assert.ok(pino.stdTimeFunctions.unixTime)
  assert.ok(pino.stdTimeFunctions.nullTime)
  assert.ok(pino.stdTimeFunctions.isoTime)
  assert.ok(pino.stdTimeFunctions.isoTimeNano)
})

test('pino accepts external time functions', async () => {
  const opts = {
    timestamp: () => ',"time":"none"'
  }
  const stream = sink()
  const instance = pino(opts, stream)
  instance.info('foobar')
  const result = await once(stream, 'data')
  assert.equal(result.hasOwnProperty('time'), true)
  assert.equal(result.time, 'none')
})

test('pino accepts external time functions with custom label', async () => {
  const opts = {
    timestamp: () => ',"custom-time-label":"none"'
  }
  const stream = sink()
  const instance = pino(opts, stream)
  instance.info('foobar')
  const result = await once(stream, 'data')
  assert.equal(result.hasOwnProperty('custom-time-label'), true)
  assert.equal(result['custom-time-label'], 'none')
})

test('inserts timestamp by default', async ({ ok, equal }) => {
  const stream = sink()
  const instance = pino(stream)
  instance.info('foobar')
  const result = await once(stream, 'data')
  assert.equal(result.hasOwnProperty('time'), true)
  assert.ok(new Date(result.time) <= new Date(), 'time is greater than timestamp')
  assert.equal(result.msg, 'foobar')
})

test('omits timestamp when timestamp option is false', async () => {
  const stream = sink()
  const instance = pino({ timestamp: false }, stream)
  instance.info('foobar')
  const result = await once(stream, 'data')
  assert.equal(result.hasOwnProperty('time'), false)
  assert.equal(result.msg, 'foobar')
})

test('inserts timestamp when timestamp option is true', async ({ ok, equal }) => {
  const stream = sink()
  const instance = pino({ timestamp: true }, stream)
  instance.info('foobar')
  const result = await once(stream, 'data')
  assert.equal(result.hasOwnProperty('time'), true)
  assert.ok(new Date(result.time) <= new Date(), 'time is greater than timestamp')
  assert.equal(result.msg, 'foobar')
})

test('child inserts timestamp by default', async ({ ok, equal }) => {
  const stream = sink()
  const logger = pino(stream)
  const instance = logger.child({ component: 'child' })
  instance.info('foobar')
  const result = await once(stream, 'data')
  assert.equal(result.hasOwnProperty('time'), true)
  assert.ok(new Date(result.time) <= new Date(), 'time is greater than timestamp')
  assert.equal(result.msg, 'foobar')
})

test('child omits timestamp with option', async () => {
  const stream = sink()
  const logger = pino({ timestamp: false }, stream)
  const instance = logger.child({ component: 'child' })
  instance.info('foobar')
  const result = await once(stream, 'data')
  assert.equal(result.hasOwnProperty('time'), false)
  assert.equal(result.msg, 'foobar')
})

test('pino.stdTimeFunctions.unixTime returns seconds based timestamps', async () => {
  const opts = {
    timestamp: pino.stdTimeFunctions.unixTime
  }
  const stream = sink()
  const instance = pino(opts, stream)
  const now = Date.now
  Date.now = () => 1531069919686
  instance.info('foobar')
  const result = await once(stream, 'data')
  assert.equal(result.hasOwnProperty('time'), true)
  assert.equal(result.time, 1531069920)
  Date.now = now
})

test('pino.stdTimeFunctions.isoTime returns ISO 8601 timestamps', async () => {
  const opts = {
    timestamp: pino.stdTimeFunctions.isoTime
  }
  const stream = sink()
  const instance = pino(opts, stream)
  const ms = 1531069919686
  const now = Date.now
  Date.now = () => ms
  const iso = new Date(ms).toISOString()
  instance.info('foobar')
  const result = await once(stream, 'data')
  assert.equal(result.hasOwnProperty('time'), true)
  assert.equal(result.time, iso)
  Date.now = now
})
