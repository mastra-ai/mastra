import test from 'node:test'
import assert from 'node:assert'

import pino from '../../pino.js'
import helper from '../helper.js'

const { sink, check, once } = helper

test('esm support', async () => {
  const stream = sink()
  const instance = pino(stream)
  instance.info('hello world')
  check(assert.equal, await once(stream, 'data'), 30, 'hello world')
})
