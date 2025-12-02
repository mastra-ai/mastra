'use strict'

const test = require('node:test')
const os = require('node:os')
const tspl = require('@matteo.collina/tspl')

const pino = require('../')

const { pid } = process
const hostname = os.hostname()

test('metadata works', async (t) => {
  const plan = tspl(t, { plan: 7 })
  const now = Date.now()
  const instance = pino({}, {
    [Symbol.for('pino.metadata')]: true,
    write (chunk) {
      plan.equal(instance, this.lastLogger)
      plan.equal(30, this.lastLevel)
      plan.equal('a msg', this.lastMsg)
      plan.ok(Number(this.lastTime) >= now)
      plan.deepEqual(this.lastObj, { hello: 'world' })
      const result = JSON.parse(chunk)
      plan.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
      delete result.time
      plan.deepEqual(result, {
        pid,
        hostname,
        level: 30,
        hello: 'world',
        msg: 'a msg'
      })
    }
  })

  instance.info({ hello: 'world' }, 'a msg')

  await plan
})

test('child loggers works', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const instance = pino({}, {
    [Symbol.for('pino.metadata')]: true,
    write (chunk) {
      plan.equal(child, this.lastLogger)
      plan.equal(30, this.lastLevel)
      plan.equal('a msg', this.lastMsg)
      plan.deepEqual(this.lastObj, { from: 'child' })
      const result = JSON.parse(chunk)
      plan.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
      delete result.time
      plan.deepEqual(result, {
        pid,
        hostname,
        level: 30,
        hello: 'world',
        from: 'child',
        msg: 'a msg'
      })
    }
  })

  const child = instance.child({ hello: 'world' })
  child.info({ from: 'child' }, 'a msg')

  await plan
})

test('without object', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const instance = pino({}, {
    [Symbol.for('pino.metadata')]: true,
    write (chunk) {
      plan.equal(instance, this.lastLogger)
      plan.equal(30, this.lastLevel)
      plan.equal('a msg', this.lastMsg)
      plan.deepEqual({ }, this.lastObj)
      const result = JSON.parse(chunk)
      plan.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
      delete result.time
      plan.deepEqual(result, {
        pid,
        hostname,
        level: 30,
        msg: 'a msg'
      })
    }
  })

  instance.info('a msg')

  await plan
})

test('without msg', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const instance = pino({}, {
    [Symbol.for('pino.metadata')]: true,
    write (chunk) {
      plan.equal(instance, this.lastLogger)
      plan.equal(30, this.lastLevel)
      plan.equal(undefined, this.lastMsg)
      plan.deepEqual({ hello: 'world' }, this.lastObj)
      const result = JSON.parse(chunk)
      plan.ok(new Date(result.time) <= new Date(), 'time is greater than Date.now()')
      delete result.time
      plan.deepEqual(result, {
        pid,
        hostname,
        level: 30,
        hello: 'world'
      })
    }
  })

  instance.info({ hello: 'world' })

  await plan
})
