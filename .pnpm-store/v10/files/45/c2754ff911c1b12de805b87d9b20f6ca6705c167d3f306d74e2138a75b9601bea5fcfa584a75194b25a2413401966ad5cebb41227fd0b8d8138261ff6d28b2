'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { join } = require('node:path')

const execa = require('execa')
const writer = require('flush-write-stream')
const { once } = require('./helper')

// https://github.com/pinojs/pino/issues/542
test('pino.destination log everything when calling process.exit(0)', async () => {
  let actual = ''
  const child = execa(process.argv[0], [join(__dirname, 'fixtures', 'destination-exit.js')])

  child.stdout.pipe(writer((s, enc, cb) => {
    actual += s
    cb()
  }))

  await once(child, 'close')

  assert.equal(actual.match(/hello/) != null, true)
  assert.equal(actual.match(/world/) != null, true)
})

test('pino with no args log everything when calling process.exit(0)', async () => {
  let actual = ''
  const child = execa(process.argv[0], [join(__dirname, 'fixtures', 'default-exit.js')])

  child.stdout.pipe(writer((s, enc, cb) => {
    actual += s
    cb()
  }))

  await once(child, 'close')

  assert.equal(actual.match(/hello/) != null, true)
  assert.equal(actual.match(/world/) != null, true)
})

test('sync false logs everything when calling process.exit(0)', async () => {
  let actual = ''
  const child = execa(process.argv[0], [join(__dirname, 'fixtures', 'syncfalse-exit.js')])

  child.stdout.pipe(writer((s, enc, cb) => {
    actual += s
    cb()
  }))

  await once(child, 'close')

  assert.equal(actual.match(/hello/) != null, true)
  assert.equal(actual.match(/world/) != null, true)
})

test('sync false logs everything when calling flushSync', async () => {
  let actual = ''
  const child = execa(process.argv[0], [join(__dirname, 'fixtures', 'syncfalse-flush-exit.js')])

  child.stdout.pipe(writer((s, enc, cb) => {
    actual += s
    cb()
  }))

  await once(child, 'close')

  assert.equal(actual.match(/hello/) != null, true)
  assert.equal(actual.match(/world/) != null, true)
})

test('transports exits gracefully when logging in exit', async () => {
  const child = execa(process.argv[0], [join(__dirname, 'fixtures', 'transport-with-on-exit.js')])
  child.stdout.resume()

  const code = await once(child, 'close')

  assert.equal(code, 0)
})
