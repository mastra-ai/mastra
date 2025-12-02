'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const { join } = require('node:path')
const { readFile } = require('node:fs').promises

const { watchFileCreated, file } = require('../helper')
const pino = require('../../')
const { DEFAULT_LEVELS } = require('../../lib/constants')

const { pid } = process
const hostname = os.hostname()

test('pino.transport with a pipeline', async (t) => {
  const destination = file()
  const transport = pino.transport({
    pipeline: [{
      target: join(__dirname, '..', 'fixtures', 'transport-transform.js')
    }, {
      target: join(__dirname, '..', 'fixtures', 'to-file-transport.js'),
      options: { destination }
    }]
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
    level: DEFAULT_LEVELS.info,
    msg: 'hello',
    service: 'pino' // this property was added by the transform
  })
})

test('pino.transport with targets containing pipelines', async (t) => {
  const destinationA = file()
  const destinationB = file()
  const transport = pino.transport({
    targets: [
      {
        target: join(__dirname, '..', 'fixtures', 'to-file-transport.js'),
        options: { destination: destinationA }
      },
      {
        pipeline: [
          {
            target: join(__dirname, '..', 'fixtures', 'transport-transform.js')
          },
          {
            target: join(__dirname, '..', 'fixtures', 'to-file-transport.js'),
            options: { destination: destinationB }
          }
        ]
      }
    ]
  })

  t.after(transport.end.bind(transport))
  const instance = pino(transport)
  instance.info('hello')
  await watchFileCreated(destinationA)
  await watchFileCreated(destinationB)
  const resultA = JSON.parse(await readFile(destinationA))
  const resultB = JSON.parse(await readFile(destinationB))
  delete resultA.time
  delete resultB.time
  assert.deepEqual(resultA, {
    pid,
    hostname,
    level: DEFAULT_LEVELS.info,
    msg: 'hello'
  })
  assert.deepEqual(resultB, {
    pid,
    hostname,
    level: DEFAULT_LEVELS.info,
    msg: 'hello',
    service: 'pino' // this property was added by the transform
  })
})

test('pino.transport with targets containing pipelines with levels defined and dedupe', async (t) => {
  const destinationA = file()
  const destinationB = file()
  const transport = pino.transport({
    targets: [
      {
        target: join(__dirname, '..', 'fixtures', 'to-file-transport.js'),
        options: { destination: destinationA },
        level: DEFAULT_LEVELS.info
      },
      {
        pipeline: [
          {
            target: join(__dirname, '..', 'fixtures', 'transport-transform.js')
          },
          {
            target: join(__dirname, '..', 'fixtures', 'to-file-transport.js'),
            options: { destination: destinationB }
          }
        ],
        level: DEFAULT_LEVELS.error
      }
    ],
    dedupe: true
  })

  t.after(transport.end.bind(transport))
  const instance = pino(transport)
  instance.info('hello info')
  instance.error('hello error')
  await watchFileCreated(destinationA)
  await watchFileCreated(destinationB)
  const resultA = JSON.parse(await readFile(destinationA))
  const resultB = JSON.parse(await readFile(destinationB))
  delete resultA.time
  delete resultB.time
  assert.deepEqual(resultA, {
    pid,
    hostname,
    level: DEFAULT_LEVELS.info,
    msg: 'hello info'
  })
  assert.deepEqual(resultB, {
    pid,
    hostname,
    level: DEFAULT_LEVELS.error,
    msg: 'hello error',
    service: 'pino' // this property was added by the transform
  })
})
