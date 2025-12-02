'use strict'

/* eslint no-prototype-builtins: 0 */

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const tspl = require('@matteo.collina/tspl')

const { sink, once } = require('./helper')
const pino = require('../')

const { pid } = process
const hostname = os.hostname()
const level = 50
const name = 'error'

test('err is serialized with additional properties set on the Error object', async () => {
  const stream = sink()
  const err = Object.assign(new Error('myerror'), { foo: 'bar' })
  const instance = pino(stream)
  instance.level = name
  instance[name](err)
  const result = await once(stream, 'data')
  assert.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level,
    err: {
      type: 'Error',
      message: err.message,
      stack: err.stack,
      foo: err.foo
    },
    msg: err.message
  })
})

test('type should be detected based on constructor', async () => {
  class Bar extends Error {}
  const stream = sink()
  const err = new Bar('myerror')
  const instance = pino(stream)
  instance.level = name
  instance[name](err)
  const result = await once(stream, 'data')
  assert.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level,
    err: {
      type: 'Bar',
      message: err.message,
      stack: err.stack
    },
    msg: err.message
  })
})

test('type, message and stack should be first level properties', async () => {
  const stream = sink()
  const err = Object.assign(new Error('foo'), { foo: 'bar' })
  const instance = pino(stream)
  instance.level = name
  instance[name](err)

  const result = await once(stream, 'data')
  assert.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level,
    err: {
      type: 'Error',
      message: err.message,
      stack: err.stack,
      foo: err.foo
    },
    msg: err.message
  })
})

test('err serializer', async () => {
  const stream = sink()
  const err = Object.assign(new Error('myerror'), { foo: 'bar' })
  const instance = pino({
    serializers: {
      err: pino.stdSerializers.err
    }
  }, stream)

  instance.level = name
  instance[name]({ err })
  const result = await once(stream, 'data')
  assert.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level,
    err: {
      type: 'Error',
      message: err.message,
      stack: err.stack,
      foo: err.foo
    },
    msg: err.message
  })
})

test('an error with statusCode property is not confused for a http response', async () => {
  const stream = sink()
  const err = Object.assign(new Error('StatusCodeErr'), { statusCode: 500 })
  const instance = pino(stream)

  instance.level = name
  instance[name](err)
  const result = await once(stream, 'data')

  assert.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level,
    err: {
      type: 'Error',
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode
    },
    msg: err.message
  })
})

test('stack is omitted if it is not set on err', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const err = new Error('myerror')
  delete err.stack
  const instance = pino(sink(function (chunk, enc, cb) {
    plan.ok(new Date(chunk.time) <= new Date(), 'time is greater than Date.now()')
    delete chunk.time
    plan.equal(chunk.hasOwnProperty('stack'), false)
    cb()
  }))

  instance.level = name
  instance[name](err)

  await plan
})

test('correctly ignores toString on errors', async () => {
  const err = new Error('myerror')
  err.toString = () => undefined
  const stream = sink()
  const instance = pino({
    test: 'this'
  }, stream)
  instance.fatal(err)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    err: {
      type: 'Error',
      message: err.message,
      stack: err.stack
    },
    msg: err.message
  })
})

test('assign mixin()', async () => {
  const err = new Error('myerror')
  const stream = sink()
  const instance = pino({
    mixin () {
      return { hello: 'world' }
    }
  }, stream)
  instance.fatal(err)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    hello: 'world',
    err: {
      type: 'Error',
      message: err.message,
      stack: err.stack
    },
    msg: err.message
  })
})

test('no err serializer', async () => {
  const err = new Error('myerror')
  const stream = sink()
  const instance = pino({
    serializers: {}
  }, stream)
  instance.fatal(err)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    err: {
      type: 'Error',
      message: err.message,
      stack: err.stack
    },
    msg: err.message
  })
})

test('empty serializer', async () => {
  const err = new Error('myerror')
  const stream = sink()
  const instance = pino({
    serializers: {
      err () {}
    }
  }, stream)
  instance.fatal(err)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    msg: err.message
  })
})

test('assign mixin()', async () => {
  const err = new Error('myerror')
  const stream = sink()
  const instance = pino({
    mixin () {
      return { hello: 'world' }
    }
  }, stream)
  instance.fatal(err)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    hello: 'world',
    err: {
      type: 'Error',
      message: err.message,
      stack: err.stack
    },
    msg: err.message
  })
})

test('no err serializer', async () => {
  const err = new Error('myerror')
  const stream = sink()
  const instance = pino({
    serializers: {}
  }, stream)
  instance.fatal(err)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    err: {
      type: 'Error',
      message: err.message,
      stack: err.stack
    },
    msg: err.message
  })
})

test('empty serializer', async () => {
  const err = new Error('myerror')
  const stream = sink()
  const instance = pino({
    serializers: {
      err () {}
    }
  }, stream)
  instance.fatal(err)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    msg: err.message
  })
})

test('correctly adds error information when nestedKey is used', async () => {
  const err = new Error('myerror')
  err.toString = () => undefined
  const stream = sink()
  const instance = pino({
    test: 'this',
    nestedKey: 'obj'
  }, stream)
  instance.fatal(err)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    obj: {
      err: {
        type: 'Error',
        stack: err.stack,
        message: err.message
      }
    },
    msg: err.message
  })
})

test('correctly adds msg on error when nestedKey is used', async () => {
  const err = new Error('myerror')
  err.toString = () => undefined
  const stream = sink()
  const instance = pino({
    test: 'this',
    nestedKey: 'obj'
  }, stream)
  instance.fatal(err, 'msg message')
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    obj: {
      err: {
        type: 'Error',
        stack: err.stack,
        message: err.message
      }
    },
    msg: 'msg message'
  })
})

test('msg should take precedence over error message on mergingObject', async () => {
  const err = new Error('myerror')
  const stream = sink()
  const instance = pino(stream)
  instance.error({ msg: 'my message', err })
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 50,
    err: {
      type: 'Error',
      stack: err.stack,
      message: err.message
    },
    msg: 'my message'
  })
})

test('considers messageKey when giving msg precedence over error', async () => {
  const err = new Error('myerror')
  const stream = sink()
  const instance = pino({ messageKey: 'message' }, stream)
  instance.error({ message: 'my message', err })
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 50,
    err: {
      type: 'Error',
      stack: err.stack,
      message: err.message
    },
    message: 'my message'
  })
})
