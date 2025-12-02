import test from 'node:test'
import assert from 'node:assert'
import { hostname } from 'node:os'
import { readFileSync } from 'node:fs'

import { sink, check, once, watchFileCreated, file } from '../helper.js'
import { pino, destination } from '../../pino.js'

test('named exports support', async () => {
  const stream = sink()
  const instance = pino(stream)
  instance.info('hello world')
  check(assert.equal, await once(stream, 'data'), 30, 'hello world')
})

test('destination', async () => {
  const tmp = file()
  const instance = pino(destination(tmp))
  instance.info('hello')
  await watchFileCreated(tmp)
  const result = JSON.parse(readFileSync(tmp).toString())
  delete result.time
  assert.deepEqual(result, {
    pid: process.pid,
    hostname,
    level: 30,
    msg: 'hello'
  })
})
