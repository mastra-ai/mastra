'use strict'

const { describe, test } = require('node:test')
const tspl = require('@matteo.collina/tspl')

const { sink, match, once } = require('./helper')
const pino = require('../')

describe('log method hook', () => {
  test('gets invoked', async t => {
    const plan = tspl(t, { plan: 7 })

    const stream = sink()
    const logger = pino({
      hooks: {
        logMethod (args, method, level) {
          plan.equal(Array.isArray(args), true)
          plan.equal(typeof level, 'number')
          plan.equal(args.length, 3)
          plan.equal(level, this.levels.values.info)
          plan.deepEqual(args, ['a', 'b', 'c'])

          plan.equal(typeof method, 'function')
          plan.equal(method.name, 'LOG')

          method.apply(this, [args.join('-')])
        }
      }
    }, stream)

    const o = once(stream, 'data')
    logger.info('a', 'b', 'c')
    match(await o, { msg: 'a-b-c' })
  })

  test('fatal method invokes hook', async t => {
    const plan = tspl(t, { plan: 1 })

    const stream = sink()
    const logger = pino({
      hooks: {
        logMethod (args, method) {
          plan.ok(true)
          method.apply(this, [args.join('-')])
        }
      }
    }, stream)

    const o = once(stream, 'data')
    logger.fatal('a')
    match(await o, { msg: 'a' })
  })

  test('children get the hook', async t => {
    const plan = tspl(t, { plan: 2 })

    const stream = sink()
    const root = pino({
      hooks: {
        logMethod (args, method) {
          plan.ok(true)
          method.apply(this, [args.join('-')])
        }
      }
    }, stream)
    const child = root.child({ child: 'one' })
    const grandchild = child.child({ child: 'two' })

    let o = once(stream, 'data')
    child.info('a', 'b')
    match(await o, { msg: 'a-b' })

    o = once(stream, 'data')
    grandchild.info('c', 'd')
    match(await o, { msg: 'c-d' })
  })

  test('get log level', async t => {
    const plan = tspl(t, { plan: 2 })

    const stream = sink()
    const logger = pino({
      hooks: {
        logMethod (args, method, level) {
          plan.equal(typeof level, 'number')
          plan.equal(level, this.levels.values.error)

          method.apply(this, [args.join('-')])
        }
      }
    }, stream)

    const o = once(stream, 'data')
    logger.error('a')
    match(await o, { msg: 'a' })
  })
})

describe('streamWrite hook', () => {
  test('gets invoked', async () => {
    const stream = sink()
    const logger = pino({
      hooks: {
        streamWrite (s) {
          return s.replaceAll('redact-me', 'XXX')
        }
      }
    }, stream)

    const o = once(stream, 'data')
    logger.info('hide redact-me in this string')
    match(await o, { msg: 'hide XXX in this string' })
  })
})
