'use strict'

const { describe, test } = require('node:test')
const assert = require('node:assert')
const pino = require('../browser')

const customLevels = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
}

describe('Default levels suite', () => {
  test('can check if current level enabled', async () => {
    const log = pino({ level: 'debug' })
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('can check if current level enabled when as object', async () => {
    const log = pino({ asObject: true, level: 'debug' })
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('can check if level enabled after level set', async () => {
    const log = pino()
    assert.equal(false, log.isLevelEnabled('debug'))
    log.level = 'debug'
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('can check if higher level enabled', async () => {
    const log = pino({ level: 'debug' })
    assert.equal(true, log.isLevelEnabled('error'))
  })

  test('can check if lower level is disabled', async () => {
    const log = pino({ level: 'error' })
    assert.equal(false, log.isLevelEnabled('trace'))
  })

  test('ASC: can check if child has current level enabled', async () => {
    const log = pino().child({}, { level: 'debug' })
    assert.equal(true, log.isLevelEnabled('debug'))
    assert.equal(true, log.isLevelEnabled('error'))
    assert.equal(false, log.isLevelEnabled('trace'))
  })

  test('can check if custom level is enabled', async () => {
    const log = pino({
      customLevels: { foo: 35 },
      level: 'debug'
    })
    assert.equal(true, log.isLevelEnabled('foo'))
    assert.equal(true, log.isLevelEnabled('error'))
    assert.equal(false, log.isLevelEnabled('trace'))
  })
})

describe('Custom levels suite', () => {
  test('can check if current level enabled', async () => {
    const log = pino({ level: 'debug', customLevels })
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('can check if level enabled after level set', async () => {
    const log = pino({ customLevels })
    assert.equal(false, log.isLevelEnabled('debug'))
    log.level = 'debug'
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('can check if higher level enabled', async () => {
    const log = pino({ level: 'debug', customLevels })
    assert.equal(true, log.isLevelEnabled('error'))
  })

  test('can check if lower level is disabled', async () => {
    const log = pino({ level: 'error', customLevels })
    assert.equal(false, log.isLevelEnabled('trace'))
  })

  test('can check if child has current level enabled', async () => {
    const log = pino().child({ customLevels }, { level: 'debug' })
    assert.equal(true, log.isLevelEnabled('debug'))
    assert.equal(true, log.isLevelEnabled('error'))
    assert.equal(false, log.isLevelEnabled('trace'))
  })

  test('can check if custom level is enabled', async () => {
    const log = pino({
      customLevels: { foo: 35, ...customLevels },
      level: 'debug'
    })
    assert.equal(true, log.isLevelEnabled('foo'))
    assert.equal(true, log.isLevelEnabled('error'))
    assert.equal(false, log.isLevelEnabled('trace'))
  })
})
