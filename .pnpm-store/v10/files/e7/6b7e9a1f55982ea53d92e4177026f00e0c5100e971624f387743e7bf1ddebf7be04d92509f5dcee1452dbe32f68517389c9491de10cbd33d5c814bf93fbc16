'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const { promises: { readFile }, createWriteStream } = require('node:fs')
const { join } = require('node:path')
const { fork } = require('node:child_process')
const writer = require('flush-write-stream')
const {
  once,
  getPathToNull,
  file,
  watchFileCreated
} = require('./helper')
const { promisify } = require('node:util')
const tspl = require('@matteo.collina/tspl')

const sleep = promisify(setTimeout)

test('asynchronous logging', async (t) => {
  const now = Date.now
  const hostname = os.hostname
  const proc = process
  global.process = {
    __proto__: process,
    pid: 123456
  }
  Date.now = () => 1459875739796
  os.hostname = () => 'abcdefghijklmnopqr'
  delete require.cache[require.resolve('../')]
  const pino = require('../')
  let expected = ''
  let actual = ''
  const normal = pino(writer((s, enc, cb) => {
    expected += s
    cb()
  }))

  const dest = createWriteStream(getPathToNull())
  dest.write = (s) => {
    actual += s
  }
  const asyncLogger = pino(dest)

  let i = 44
  while (i--) {
    normal.info('h')
    asyncLogger.info('h')
  }

  const expected2 = expected.split('\n')[0]
  let actual2 = ''

  const child = fork(join(__dirname, '/fixtures/syncfalse.js'), { silent: true })
  child.stdout.pipe(writer((s, enc, cb) => {
    actual2 += s
    cb()
  }))
  await once(child, 'close')
  // Wait for the last write to be flushed
  await sleep(100)
  assert.equal(actual, expected)
  assert.equal(actual2.trim(), expected2)

  t.after(() => {
    os.hostname = hostname
    Date.now = now
    global.process = proc
  })
})

test('sync false with child', async (t) => {
  const now = Date.now
  const hostname = os.hostname
  const proc = process
  global.process = {
    __proto__: process,
    pid: 123456
  }
  Date.now = function () {
    return 1459875739796
  }
  os.hostname = function () {
    return 'abcdefghijklmnopqr'
  }
  delete require.cache[require.resolve('../')]
  const pino = require('../')
  let expected = ''
  let actual = ''
  const normal = pino(writer((s, enc, cb) => {
    expected += s
    cb()
  })).child({ hello: 'world' })

  const dest = createWriteStream(getPathToNull())
  dest.write = function (s) {
    actual += s
  }
  const asyncLogger = pino(dest).child({ hello: 'world' })

  let i = 500
  while (i--) {
    normal.info('h')
    asyncLogger.info('h')
  }

  asyncLogger.flush()

  const expected2 = expected.split('\n')[0]
  let actual2 = ''

  const child = fork(join(__dirname, '/fixtures/syncfalse-child.js'), { silent: true })
  child.stdout.pipe(writer((s, enc, cb) => {
    actual2 += s
    cb()
  }))
  await once(child, 'close')
  assert.equal(actual, expected)
  assert.equal(actual2.trim(), expected2)

  t.after(() => {
    os.hostname = hostname
    Date.now = now
    global.process = proc
  })
})

test('flush does nothing with sync true (default)', async () => {
  const instance = require('..')()
  assert.equal(instance.flush(), undefined)
})

test('should still call flush callback even when does nothing with sync true (default)', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const instance = require('..')()
  instance.flush((...args) => {
    plan.ok('flush called')
    plan.deepEqual(args, [])

    // next tick to make flush not called more than once
    process.nextTick(() => {
      plan.ok('flush next tick called')
    })
  })

  await plan
})

test('should call the flush callback when flushed the data for async logger', async () => {
  const outputPath = file()
  async function getOutputLogLines () {
    return (await readFile(outputPath)).toString().trim().split('\n').map(JSON.parse)
  }

  const pino = require('../')

  const instance = pino({}, pino.destination({
    dest: outputPath,

    // to make sure it does not flush on its own
    minLength: 4096
  }))
  const flushPromise = promisify(instance.flush).bind(instance)

  instance.info('hello')
  await flushPromise()
  await watchFileCreated(outputPath)

  const [firstFlushData] = await getOutputLogLines()

  assert.equal(firstFlushData.msg, 'hello')

  // should not flush this as no data accumulated that's bigger than min length
  instance.info('world')

  // Making sure data is not flushed yet
  const afterLogData = await getOutputLogLines()
  assert.equal(afterLogData.length, 1)

  await flushPromise()

  // Making sure data is not flushed yet
  const afterSecondFlush = (await getOutputLogLines())[1]
  assert.equal(afterSecondFlush.msg, 'world')
})
