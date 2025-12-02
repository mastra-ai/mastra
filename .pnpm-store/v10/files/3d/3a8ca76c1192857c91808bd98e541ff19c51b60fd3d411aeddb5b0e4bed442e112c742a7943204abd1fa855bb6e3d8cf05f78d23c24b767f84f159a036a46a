'use strict'

const { describe, test } = require('node:test')
const assert = require('node:assert')

const pino = require('../')

const descLevels = {
  trace: 60,
  debug: 50,
  info: 40,
  warn: 30,
  error: 20,
  fatal: 10
}

const ascLevels = {
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

describe('Ascending levels suite', () => {
  const customLevels = ascLevels
  const levelComparison = 'ASC'

  test('can check if current level enabled', async () => {
    const log = pino({ level: 'debug', levelComparison, customLevels, useOnlyCustomLevels: true })
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('can check if level enabled after level set', async () => {
    const log = pino({ levelComparison, customLevels, useOnlyCustomLevels: true })
    assert.equal(false, log.isLevelEnabled('debug'))
    log.level = 'debug'
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('can check if higher level enabled', async () => {
    const log = pino({ level: 'debug', levelComparison, customLevels, useOnlyCustomLevels: true })
    assert.equal(true, log.isLevelEnabled('error'))
  })

  test('can check if lower level is disabled', async () => {
    const log = pino({ level: 'error', customLevels, useOnlyCustomLevels: true })
    assert.equal(false, log.isLevelEnabled('trace'))
  })

  test('can check if child has current level enabled', async () => {
    const log = pino().child({ levelComparison, customLevels, useOnlyCustomLevels: true }, { level: 'debug' })
    assert.equal(true, log.isLevelEnabled('debug'))
    assert.equal(true, log.isLevelEnabled('error'))
    assert.equal(false, log.isLevelEnabled('trace'))
  })

  test('can check if custom level is enabled', async () => {
    const log = pino({
      levelComparison,
      useOnlyCustomLevels: true,
      customLevels: { foo: 35, ...customLevels },
      level: 'debug'
    })
    assert.equal(true, log.isLevelEnabled('foo'))
    assert.equal(true, log.isLevelEnabled('error'))
    assert.equal(false, log.isLevelEnabled('trace'))
  })
})

describe('Descending levels suite', () => {
  const customLevels = descLevels
  const levelComparison = 'DESC'

  test('can check if current level enabled', async () => {
    const log = pino({ level: 'debug', levelComparison, customLevels, useOnlyCustomLevels: true })
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('can check if level enabled after level set', async () => {
    const log = pino({ levelComparison, customLevels, useOnlyCustomLevels: true })
    assert.equal(false, log.isLevelEnabled('debug'))
    log.level = 'debug'
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('can check if higher level enabled', async () => {
    const log = pino({ level: 'debug', levelComparison, customLevels, useOnlyCustomLevels: true })
    assert.equal(true, log.isLevelEnabled('error'))
  })

  test('can check if lower level is disabled', async () => {
    const log = pino({ level: 'error', levelComparison, customLevels, useOnlyCustomLevels: true })
    assert.equal(false, log.isLevelEnabled('trace'))
  })

  test('can check if child has current level enabled', async () => {
    const log = pino({ levelComparison, customLevels, useOnlyCustomLevels: true }).child({}, { level: 'debug' })
    assert.equal(true, log.isLevelEnabled('debug'))
    assert.equal(true, log.isLevelEnabled('error'))
    assert.equal(false, log.isLevelEnabled('trace'))
  })

  test('can check if custom level is enabled', async () => {
    const log = pino({
      levelComparison,
      customLevels: { foo: 35, ...customLevels },
      useOnlyCustomLevels: true,
      level: 'debug'
    })
    assert.equal(true, log.isLevelEnabled('foo'))
    assert.equal(true, log.isLevelEnabled('error'))
    assert.equal(false, log.isLevelEnabled('trace'))
  })
})

describe('Custom levels comparison', () => {
  test('Custom comparison returns true cause level is enabled', async () => {
    const log = pino({ level: 'error', levelComparison: () => true })
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('Custom comparison returns false cause level is disabled', async () => {
    const log = pino({ level: 'error', levelComparison: () => false })
    assert.equal(false, log.isLevelEnabled('debug'))
  })

  test('Custom comparison returns true cause child level is enabled', async () => {
    const log = pino({ levelComparison: () => true }).child({ level: 'error' })
    assert.equal(true, log.isLevelEnabled('debug'))
  })

  test('Custom comparison returns false cause child level is disabled', async () => {
    const log = pino({ levelComparison: () => false }).child({ level: 'error' })
    assert.equal(false, log.isLevelEnabled('debug'))
  })
})
