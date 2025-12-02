'use strict'

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

test('mixin object is included', async () => {
  let n = 0
  const stream = sink()
  const instance = pino({
    mixin () {
      return { hello: ++n }
    }
  }, stream)
  instance.level = name
  instance[name]('test')
  const result = await once(stream, 'data')
  assert.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level,
    msg: 'test',
    hello: 1
  })
})

test('mixin object is new every time', async (t) => {
  const plan = tspl(t, { plan: 6 })

  let n = 0
  const stream = sink()
  const instance = pino({
    mixin () {
      return { hello: n }
    }
  }, stream)
  instance.level = name

  while (++n < 4) {
    const msg = `test #${n}`
    stream.pause()
    instance[name](msg)
    stream.resume()
    const result = await once(stream, 'data')
    plan.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
    delete result.time
    plan.deepEqual(result, {
      pid,
      hostname,
      level,
      msg,
      hello: n
    })
  }

  await plan
})

test('mixin object is not called if below log level', async () => {
  const stream = sink()
  const instance = pino({
    mixin () {
      throw Error('should not call mixin function')
    }
  }, stream)
  instance.level = 'error'
  instance.info('test')
})

test('mixin object + logged object', async () => {
  const stream = sink()
  const instance = pino({
    mixin () {
      return { foo: 1, bar: 2 }
    }
  }, stream)
  instance.level = name
  instance[name]({ bar: 3, baz: 4 })
  const result = await once(stream, 'data')
  assert.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level,
    foo: 1,
    bar: 3,
    baz: 4
  })
})

test('mixin not a function', async () => {
  const stream = sink()
  assert.throws(function () {
    pino({ mixin: 'not a function' }, stream)
  })
})

test('mixin can use context', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const stream = sink()
  const instance = pino({
    mixin (context) {
      plan.ok(context !== null, 'context should be defined')
      plan.ok(context !== undefined, 'context should be defined')
      plan.deepEqual(context, {
        message: '123',
        stack: 'stack'
      })
      return Object.assign({
        error: context.message,
        stack: context.stack
      })
    }
  }, stream)
  instance.level = name
  instance[name]({
    message: '123',
    stack: 'stack'
  }, 'test')

  await plan
})

test('mixin works without context', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const stream = sink()
  const instance = pino({
    mixin (context) {
      plan.ok(context !== null, 'context is still defined w/o passing mergeObject')
      plan.ok(context !== undefined, 'context is still defined w/o passing mergeObject')
      plan.deepEqual(context, {})
      return {
        something: true
      }
    }
  }, stream)
  instance.level = name
  instance[name]('test')

  await plan
})

test('mixin can use level number', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const stream = sink()
  const instance = pino({
    mixin (context, num) {
      plan.ok(num !== null, 'level should be defined')
      plan.ok(num !== undefined, 'level should be defined')
      plan.deepEqual(num, level)
      return Object.assign({
        error: context.message,
        stack: context.stack
      })
    }
  }, stream)
  instance.level = name
  instance[name]({
    message: '123',
    stack: 'stack'
  }, 'test')

  await plan
})

test('mixin receives logger as third parameter', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const stream = sink()
  const instance = pino({
    mixin (context, num, logger) {
      plan.ok(logger !== null, 'logger should be defined')
      plan.ok(logger !== undefined, 'logger should be defined')
      plan.deepEqual(logger, instance)
      return { ...context, num }
    }
  }, stream)
  instance.level = name
  instance[name]({
    message: '123'
  }, 'test')

  await plan
})

test('mixin receives child logger', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const stream = sink()
  let child = null
  const instance = pino({
    mixin (context, num, logger) {
      plan.ok(logger !== null, 'logger should be defined')
      plan.ok(logger !== undefined, 'logger should be defined')
      plan.deepEqual(logger.expected, child.expected)
      return { ...context, num }
    }
  }, stream)
  instance.level = name
  instance.expected = false
  child = instance.child({})
  child.expected = true
  child[name]({
    message: '123'
  }, 'test')

  await plan
})

test('mixin receives logger even if child exists', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const stream = sink()
  let child = null
  const instance = pino({
    mixin (context, num, logger) {
      plan.ok(logger !== null, 'logger should be defined')
      plan.ok(logger !== undefined, 'logger should be defined')
      plan.deepEqual(logger.expected, instance.expected)
      return { ...context, num }
    }
  }, stream)
  instance.level = name
  instance.expected = false
  child = instance.child({})
  child.expected = true
  instance[name]({
    message: '123'
  }, 'test')

  await plan
})
