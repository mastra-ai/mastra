'use strict'

const test = require('node:test')
const assert = require('node:assert')
const proxyquire = require('proxyquire')

test('pino.transport resolves targets in REPL', async () => {
  // Arrange
  const transport = proxyquire('../../lib/transport', {
    './caller': () => ['node:repl']
  })

  // Act / Assert
  assert.doesNotThrow(() => transport({ target: 'pino-pretty' }))
})
