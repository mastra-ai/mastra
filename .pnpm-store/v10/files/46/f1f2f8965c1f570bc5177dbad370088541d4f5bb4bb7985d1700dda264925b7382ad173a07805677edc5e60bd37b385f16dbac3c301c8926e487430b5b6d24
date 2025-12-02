'use strict'

/* eslint no-prototype-builtins: 0 */

const test = require('node:test')
const assert = require('node:assert')

const { sink, once } = require('./helper')
const pino = require('../')

// Silence all warnings for this test
process.removeAllListeners('warning')
process.on('warning', () => {})

test('adds additional levels', async () => {
  const stream = sink()
  const logger = pino({
    customLevels: {
      foo: 35,
      bar: 45
    }
  }, stream)

  logger.foo('test')
  const { level } = await once(stream, 'data')
  assert.equal(level, 35)
})

test('custom levels does not override default levels', async () => {
  const stream = sink()
  const logger = pino({
    customLevels: {
      foo: 35
    }
  }, stream)

  logger.info('test')
  const { level } = await once(stream, 'data')
  assert.equal(level, 30)
})

test('default levels can be redefined using custom levels', async () => {
  const stream = sink()
  const logger = pino({
    customLevels: {
      info: 35,
      debug: 45
    },
    useOnlyCustomLevels: true
  }, stream)

  assert.equal(logger.hasOwnProperty('info'), true)

  logger.info('test')
  const { level } = await once(stream, 'data')
  assert.equal(level, 35)
})

test('custom levels overrides default level label if use useOnlyCustomLevels', async () => {
  const stream = sink()
  const logger = pino({
    customLevels: {
      foo: 35
    },
    useOnlyCustomLevels: true,
    level: 'foo'
  }, stream)

  assert.equal(logger.hasOwnProperty('info'), false)
})

test('custom levels overrides default level value if use useOnlyCustomLevels', async () => {
  const stream = sink()
  const logger = pino({
    customLevels: {
      foo: 35
    },
    useOnlyCustomLevels: true,
    level: 35
  }, stream)

  assert.equal(logger.hasOwnProperty('info'), false)
})

test('custom levels are inherited by children', async () => {
  const stream = sink()
  const logger = pino({
    customLevels: {
      foo: 35
    }
  }, stream)

  logger.child({ childMsg: 'ok' }).foo('test')
  const { msg, childMsg, level } = await once(stream, 'data')
  assert.equal(level, 35)
  assert.equal(childMsg, 'ok')
  assert.equal(msg, 'test')
})

test('custom levels can be specified on child bindings', async () => {
  const stream = sink()
  const logger = pino(stream).child({
    childMsg: 'ok'
  }, {
    customLevels: {
      foo: 35
    }
  })

  logger.foo('test')
  const { msg, childMsg, level } = await once(stream, 'data')
  assert.equal(level, 35)
  assert.equal(childMsg, 'ok')
  assert.equal(msg, 'test')
})

test('customLevels property child bindings does not get logged', async () => {
  const stream = sink()
  const logger = pino(stream).child({
    childMsg: 'ok'
  }, {
    customLevels: {
      foo: 35
    }
  })

  logger.foo('test')
  const { customLevels } = await once(stream, 'data')
  assert.equal(customLevels, undefined)
})

test('throws when specifying pre-existing parent labels via child bindings', async () => {
  const stream = sink()
  assert.throws(
    () => pino({
      customLevels: {
        foo: 35
      }
    }, stream).child({}, {
      customLevels: {
        foo: 45
      }
    }),
    /levels cannot be overridden/
  )
})

test('throws when specifying pre-existing parent values via child bindings', async () => {
  const stream = sink()
  assert.throws(
    () => pino({
      customLevels: {
        foo: 35
      }
    }, stream).child({}, {
      customLevels: {
        bar: 35
      }
    }),
    /pre-existing level values cannot be used for new levels/
  )
})

test('throws when specifying core values via child bindings', async () => {
  const stream = sink()
  assert.throws(
    () => pino(stream).child({}, {
      customLevels: {
        foo: 30
      }
    }),
    /pre-existing level values cannot be used for new levels/
  )
})

test('throws when useOnlyCustomLevels is set true without customLevels', async () => {
  const stream = sink()
  assert.throws(
    () => pino({
      useOnlyCustomLevels: true
    }, stream),
    /customLevels is required if useOnlyCustomLevels is set true/
  )
})

test('custom level on one instance does not affect other instances', async () => {
  pino({
    customLevels: {
      foo: 37
    }
  })
  assert.equal(typeof pino().foo, 'undefined')
})

test('setting level below or at custom level will successfully log', async () => {
  const stream = sink()
  const instance = pino({ customLevels: { foo: 35 } }, stream)
  instance.level = 'foo'
  instance.info('nope')
  instance.foo('bar')
  const { msg } = await once(stream, 'data')
  assert.equal(msg, 'bar')
})

test('custom level below level threshold will not log', async () => {
  const stream = sink()
  const instance = pino({ customLevels: { foo: 15 } }, stream)
  instance.level = 'info'
  instance.info('bar')
  instance.foo('nope')
  const { msg } = await once(stream, 'data')
  assert.equal(msg, 'bar')
})

test('does not share custom level state across siblings', async () => {
  const stream = sink()
  const logger = pino(stream)
  logger.child({}, {
    customLevels: { foo: 35 }
  })
  assert.doesNotThrow(() => {
    logger.child({}, {
      customLevels: { foo: 35 }
    })
  })
})

test('custom level does not affect the levels serializer', async () => {
  const stream = sink()
  const logger = pino({
    customLevels: {
      foo: 35,
      bar: 45
    },
    formatters: {
      level (label, number) {
        return { priority: number }
      }
    }
  }, stream)

  logger.foo('test')
  const { priority } = await once(stream, 'data')
  assert.equal(priority, 35)
})

test('When useOnlyCustomLevels is set to true, the level formatter should only get custom levels', async () => {
  const stream = sink()
  const logger = pino({
    customLevels: {
      answer: 42
    },
    useOnlyCustomLevels: true,
    level: 42,
    formatters: {
      level (label, number) {
        assert.equal(label, 'answer')
        assert.equal(number, 42)
        return { level: number }
      }
    }
  }, stream)

  logger.answer('test')
  const { level } = await once(stream, 'data')
  assert.equal(level, 42)
})
