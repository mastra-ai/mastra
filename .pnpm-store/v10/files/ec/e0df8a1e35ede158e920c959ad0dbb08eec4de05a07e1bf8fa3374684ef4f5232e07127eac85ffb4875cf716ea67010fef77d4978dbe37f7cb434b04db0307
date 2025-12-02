'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { sink, once } = require('./helper')
const stdSerializers = require('pino-std-serializers')
const pino = require('../')

test('set the errorKey with error serializer', async () => {
  const stream = sink()
  const errorKey = 'error'
  const instance = pino({
    errorKey,
    serializers: { [errorKey]: stdSerializers.err }
  }, stream)
  instance.error(new ReferenceError('test'))
  const o = await once(stream, 'data')
  assert.equal(typeof o[errorKey], 'object')
  assert.equal(o[errorKey].type, 'ReferenceError')
  assert.equal(o[errorKey].message, 'test')
  assert.equal(typeof o[errorKey].stack, 'string')
})

test('set the errorKey without error serializer', async () => {
  const stream = sink()
  const errorKey = 'error'
  const instance = pino({
    errorKey
  }, stream)
  instance.error(new ReferenceError('test'))
  const o = await once(stream, 'data')
  assert.equal(typeof o[errorKey], 'object')
  assert.equal(o[errorKey].type, 'ReferenceError')
  assert.equal(o[errorKey].message, 'test')
  assert.equal(typeof o[errorKey].stack, 'string')
})
