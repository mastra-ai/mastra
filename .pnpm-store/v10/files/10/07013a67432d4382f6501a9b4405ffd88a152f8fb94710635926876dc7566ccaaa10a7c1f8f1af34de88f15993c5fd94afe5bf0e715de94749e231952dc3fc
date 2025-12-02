'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const { join } = require('node:path')
const { readFile } = require('node:fs').promises
const { promisify } = require('node:util')

const pino = require('../..')
const { watchFileCreated, file } = require('../helper')

const { pid } = process
const hostname = os.hostname()

test('thread-stream async flush', async () => {
  const destination = file()
  const transport = pino.transport({
    target: join(__dirname, '..', 'fixtures', 'to-file-transport.js'),
    options: { destination }
  })
  const instance = pino(transport)
  instance.info('hello')

  assert.equal(instance.flush(), undefined)

  await watchFileCreated(destination)
  const result = JSON.parse(await readFile(destination))
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: 'hello'
  })
})

test('thread-stream async flush should call the passed callback', async () => {
  const outputPath = file()
  async function getOutputLogLines () {
    return (await readFile(outputPath)).toString().trim().split('\n').map(JSON.parse)
  }
  const transport = pino.transport({
    target: join(__dirname, '..', 'fixtures', 'to-file-transport.js'),
    options: { destination: outputPath }
  })
  const instance = pino(transport)
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
