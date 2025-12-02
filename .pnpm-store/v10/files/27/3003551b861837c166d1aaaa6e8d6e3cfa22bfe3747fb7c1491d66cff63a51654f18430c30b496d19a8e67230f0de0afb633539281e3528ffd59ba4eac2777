'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const { join } = require('node:path')
const { readFile } = require('node:fs').promises

const { watchFileCreated, file } = require('../helper')
const pino = require('../../pino')

const { pid } = process
const hostname = os.hostname()

test('pino.transport with destination overridden by bundler', async (t) => {
  globalThis.__bundlerPathsOverrides = {
    foobar: join(__dirname, '..', 'fixtures', 'to-file-transport.js')
  }

  const destination = file()
  const transport = pino.transport({
    target: 'foobar',
    options: { destination }
  })
  t.after(transport.end.bind(transport))
  const instance = pino(transport)
  instance.info('hello')
  await watchFileCreated(destination)
  const result = JSON.parse(await readFile(destination))
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: 'hello'
  })

  globalThis.__bundlerPathsOverrides = undefined
})

test('pino.transport with worker destination overridden by bundler', async (t) => {
  globalThis.__bundlerPathsOverrides = {
    'pino-worker': join(__dirname, '..', '..', 'lib/worker.js')
  }

  const destination = file()
  const transport = pino.transport({
    targets: [
      {
        target: join(__dirname, '..', 'fixtures', 'to-file-transport.js'),
        options: { destination }
      }
    ]
  })
  t.after(transport.end.bind(transport))
  const instance = pino(transport)
  instance.info('hello')
  await watchFileCreated(destination)
  const result = JSON.parse(await readFile(destination))
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: 'hello'
  })

  globalThis.__bundlerPathsOverrides = undefined
})

test('pino.transport with worker destination overridden by bundler and mjs transport', async (t) => {
  globalThis.__bundlerPathsOverrides = {
    'pino-worker': join(__dirname, '..', '..', 'lib/worker.js')
  }

  const destination = file()
  const transport = pino.transport({
    targets: [
      {
        target: join(__dirname, '..', 'fixtures', 'ts', 'to-file-transport.es2017.cjs'),
        options: { destination }
      }
    ]
  })
  t.after(transport.end.bind(transport))
  const instance = pino(transport)
  instance.info('hello')
  await watchFileCreated(destination)
  const result = JSON.parse(await readFile(destination))
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: 'hello'
  })

  globalThis.__bundlerPathsOverrides = undefined
})
