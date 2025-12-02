'use strict'

const os = require('node:os')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const assert = require('node:assert')

const { sink, check, match, once, watchFileCreated, file } = require('./helper')
const pino = require('../')
const { version } = require('../package.json')
const { pid } = process
const hostname = os.hostname()

test('pino version is exposed on export', () => {
  assert.equal(pino.version, version)
})

test('pino version is exposed on instance', () => {
  const instance = pino()
  assert.equal(instance.version, version)
})

test('child instance exposes pino version', () => {
  const child = pino().child({ foo: 'bar' })
  assert.equal(child.version, version)
})

test('bindings are exposed on every instance', () => {
  const instance = pino()
  assert.deepEqual(instance.bindings(), {})
})

test('bindings contain the name and the child bindings', () => {
  const instance = pino({ name: 'basicTest', level: 'info' }).child({ foo: 'bar' }).child({ a: 2 })
  assert.deepEqual(instance.bindings(), { name: 'basicTest', foo: 'bar', a: 2 })
})

test('set bindings on instance', () => {
  const instance = pino({ name: 'basicTest', level: 'info' })
  instance.setBindings({ foo: 'bar' })
  assert.deepEqual(instance.bindings(), { name: 'basicTest', foo: 'bar' })
})

test('newly set bindings overwrite old bindings', () => {
  const instance = pino({ name: 'basicTest', level: 'info', base: { foo: 'bar' } })
  instance.setBindings({ foo: 'baz' })
  assert.deepEqual(instance.bindings(), { name: 'basicTest', foo: 'baz' })
})

test('set bindings on child instance', () => {
  const child = pino({ name: 'basicTest', level: 'info' }).child({})
  child.setBindings({ foo: 'bar' })
  assert.deepEqual(child.bindings(), { name: 'basicTest', foo: 'bar' })
})

test('child should have bindings set by parent', () => {
  const instance = pino({ name: 'basicTest', level: 'info' })
  instance.setBindings({ foo: 'bar' })
  const child = instance.child({})
  assert.deepEqual(child.bindings(), { name: 'basicTest', foo: 'bar' })
})

test('child should not share bindings of parent set after child creation', () => {
  const instance = pino({ name: 'basicTest', level: 'info' })
  const child = instance.child({})
  instance.setBindings({ foo: 'bar' })
  assert.deepEqual(instance.bindings(), { name: 'basicTest', foo: 'bar' })
  assert.deepEqual(child.bindings(), { name: 'basicTest' })
})

function levelTest (name, level) {
  test(`${name} logs as ${level}`, async () => {
    const stream = sink()
    const instance = pino(stream)
    instance.level = name
    instance[name]('hello world')
    check(assert.equal, await once(stream, 'data'), level, 'hello world')
  })

  test(`passing objects at level ${name}`, async () => {
    const stream = sink()
    const instance = pino(stream)
    instance.level = name
    const obj = { hello: 'world' }
    instance[name](obj)

    const result = await once(stream, 'data')
    assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
    assert.equal(result.pid, pid)
    assert.equal(result.hostname, hostname)
    assert.equal(result.level, level)
    assert.equal(result.hello, 'world')
    assert.deepEqual(Object.keys(obj), ['hello'])
  })

  test(`passing an object and a string at level ${name}`, async () => {
    const stream = sink()
    const instance = pino(stream)
    instance.level = name
    const obj = { hello: 'world' }
    instance[name](obj, 'a string')
    const result = await once(stream, 'data')
    assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
    delete result.time
    assert.deepEqual(result, {
      pid,
      hostname,
      level,
      msg: 'a string',
      hello: 'world'
    })
    assert.deepEqual(Object.keys(obj), ['hello'])
  })

  test(`passing a undefined and a string at level ${name}`, async () => {
    const stream = sink()
    const instance = pino(stream)
    instance.level = name
    instance[name](undefined, 'a string')
    const result = await once(stream, 'data')
    assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
    delete result.time
    assert.deepEqual(result, {
      pid,
      hostname,
      level,
      msg: 'a string'
    })
  })

  test(`overriding object key by string at level ${name}`, async () => {
    const stream = sink()
    const instance = pino(stream)
    instance.level = name
    instance[name]({ hello: 'world', msg: 'object' }, 'string')
    const result = await once(stream, 'data')
    assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
    delete result.time
    assert.deepEqual(result, {
      pid,
      hostname,
      level,
      msg: 'string',
      hello: 'world'
    })
  })

  test(`formatting logs as ${name}`, async () => {
    const stream = sink()
    const instance = pino(stream)
    instance.level = name
    instance[name]('hello %d', 42)
    const result = await once(stream, 'data')
    check(assert.equal, result, level, 'hello 42')
  })

  test(`formatting a symbol at level ${name}`, async () => {
    const stream = sink()
    const instance = pino(stream)
    instance.level = name

    const sym = Symbol('foo')
    instance[name]('hello %s', sym)

    const result = await once(stream, 'data')

    check(assert.equal, result, level, 'hello Symbol(foo)')
  })

  test(`passing error with a serializer at level ${name}`, async () => {
    const stream = sink()
    const err = new Error('myerror')
    const instance = pino({
      serializers: {
        err: pino.stdSerializers.err
      }
    }, stream)
    instance.level = name
    instance[name]({ err })
    const result = await once(stream, 'data')
    assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
    delete result.time
    assert.deepEqual(result, {
      pid,
      hostname,
      level,
      err: {
        type: 'Error',
        message: err.message,
        stack: err.stack
      },
      msg: err.message
    })
  })

  test(`child logger for level ${name}`, async () => {
    const stream = sink()
    const instance = pino(stream)
    instance.level = name
    const child = instance.child({ hello: 'world' })
    child[name]('hello world')
    const result = await once(stream, 'data')
    assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
    delete result.time
    assert.deepEqual(result, {
      pid,
      hostname,
      level,
      msg: 'hello world',
      hello: 'world'
    })
  })
}

levelTest('fatal', 60)
levelTest('error', 50)
levelTest('warn', 40)
levelTest('info', 30)
levelTest('debug', 20)
levelTest('trace', 10)

test('serializers can return undefined to strip field', async () => {
  const stream = sink()
  const instance = pino({
    serializers: {
      test () { return undefined }
    }
  }, stream)

  instance.info({ test: 'sensitive info' })
  const result = await once(stream, 'data')
  assert.equal('test' in result, false)
})

test('streams receive a message event with PINO_CONFIG', (t, end) => {
  const stream = sink()
  stream.once('message', (message) => {
    match(message, {
      code: 'PINO_CONFIG',
      config: {
        errorKey: 'err',
        levels: {
          labels: {
            10: 'trace',
            20: 'debug',
            30: 'info',
            40: 'warn',
            50: 'error',
            60: 'fatal'
          },
          values: {
            debug: 20,
            error: 50,
            fatal: 60,
            info: 30,
            trace: 10,
            warn: 40
          }
        },
        messageKey: 'msg'
      }
    })
    end()
  })
  pino(stream)
})

test('does not explode with a circular ref', () => {
  const stream = sink()
  const instance = pino(stream)
  const b = {}
  const a = {
    hello: b
  }
  b.a = a // circular ref
  assert.doesNotThrow(() => instance.info(a))
})

test('set the name', async () => {
  const stream = sink()
  const instance = pino({
    name: 'hello'
  }, stream)
  instance.fatal('this is fatal')
  const result = await once(stream, 'data')
  assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    name: 'hello',
    msg: 'this is fatal'
  })
})

test('set the messageKey', async () => {
  const stream = sink()
  const message = 'hello world'
  const messageKey = 'fooMessage'
  const instance = pino({
    messageKey
  }, stream)
  instance.info(message)
  const result = await once(stream, 'data')
  assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    fooMessage: message
  })
})

test('set the nestedKey', async () => {
  const stream = sink()
  const object = { hello: 'world' }
  const nestedKey = 'stuff'
  const instance = pino({
    nestedKey
  }, stream)
  instance.info(object)
  const result = await once(stream, 'data')
  assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    stuff: object
  })
})

test('set undefined properties', async () => {
  const stream = sink()
  const instance = pino(stream)
  instance.info({ hello: 'world', property: undefined })
  const result = await once(stream, 'data')
  assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    hello: 'world'
  })
})

test('prototype properties are not logged', async () => {
  const stream = sink()
  const instance = pino(stream)
  instance.info(Object.create({ hello: 'world' }))
  const { hello } = await once(stream, 'data')
  assert.equal(hello, undefined)
})

test('set the base', async () => {
  const stream = sink()
  const instance = pino({
    base: {
      a: 'b'
    }
  }, stream)

  instance.fatal('this is fatal')
  const result = await once(stream, 'data')
  assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    a: 'b',
    level: 60,
    msg: 'this is fatal'
  })
})

test('set the base to null', async () => {
  const stream = sink()
  const instance = pino({
    base: null
  }, stream)
  instance.fatal('this is fatal')
  const result = await once(stream, 'data')
  assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    level: 60,
    msg: 'this is fatal'
  })
})

test('set the base to null and use a formatter', async () => {
  const stream = sink()
  const instance = pino({
    base: null,
    formatters: {
      log (input) {
        return Object.assign({}, input, { additionalMessage: 'using pino' })
      }
    }
  }, stream)
  instance.fatal('this is fatal too')
  const result = await once(stream, 'data')
  assert.equal(new Date(result.time) <= new Date(), true, 'time is greater than Date.now()')
  delete result.time
  assert.deepEqual(result, {
    level: 60,
    msg: 'this is fatal too',
    additionalMessage: 'using pino'
  })
})

test('throw if creating child without bindings', () => {
  const stream = sink()
  const instance = pino(stream)
  try {
    instance.child()
    assert.fail('it should throw')
  } catch (err) {
    assert.equal(err.message, 'missing bindings for child Pino')
  }
})

test('correctly escapes msg strings with stray double quote at end', async () => {
  const stream = sink()
  const instance = pino({
    name: 'hello'
  }, stream)

  instance.fatal('this contains "')
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    name: 'hello',
    msg: 'this contains "'
  })
})

test('correctly escape msg strings with unclosed double quote', async () => {
  const stream = sink()
  const instance = pino({
    name: 'hello'
  }, stream)
  instance.fatal('" this contains')
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 60,
    name: 'hello',
    msg: '" this contains'
  })
})

test('correctly escape quote in a key', async () => {
  const stream = sink()
  const instance = pino(stream)
  const obj = { 'some"obj': 'world' }
  instance.info(obj, 'a string')
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    level: 30,
    pid,
    hostname,
    msg: 'a string',
    'some"obj': 'world'
  })
  assert.deepEqual(Object.keys(obj), ['some"obj'])
})

// https://github.com/pinojs/pino/issues/139
test('object and format string', async () => {
  const stream = sink()
  const instance = pino(stream)
  instance.info({}, 'foo %s', 'bar')

  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: 'foo bar'
  })
})

test('object and format string property', async () => {
  const stream = sink()
  const instance = pino(stream)
  instance.info({ answer: 42 }, 'foo %s', 'bar')
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: 'foo bar',
    answer: 42
  })
})

test('correctly strip undefined when returned from toJSON', async () => {
  const stream = sink()
  const instance = pino({
    test: 'this'
  }, stream)
  instance.fatal({ test: { toJSON () { return undefined } } })
  const result = await once(stream, 'data')
  assert.equal('test' in result, false)
})

test('correctly supports stderr', (t, end) => {
  // stderr inherits from Stream, rather than Writable
  const dest = {
    writable: true,
    write (result) {
      result = JSON.parse(result)
      delete result.time
      assert.deepEqual(result, {
        pid,
        hostname,
        level: 60,
        msg: 'a message'
      })
      end()
    }
  }
  const instance = pino(dest)
  instance.fatal('a message')
})

test('normalize number to string', async () => {
  const stream = sink()
  const instance = pino(stream)
  instance.info(1)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: '1'
  })
})

test('normalize number to string with an object', async () => {
  const stream = sink()
  const instance = pino(stream)
  instance.info({ answer: 42 }, 1)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: '1',
    answer: 42
  })
})

test('handles objects with null prototype', async () => {
  const stream = sink()
  const instance = pino(stream)
  const o = Object.create(null)
  o.test = 'test'
  instance.info(o)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    test: 'test'
  })
})

test('pino.destination', async () => {
  const tmp = file()
  const instance = pino(pino.destination(tmp))
  instance.info('hello')
  await watchFileCreated(tmp)
  const result = JSON.parse(readFileSync(tmp).toString())
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: 'hello'
  })
})

test('auto pino.destination with a string', async () => {
  const tmp = file()
  const instance = pino(tmp)
  instance.info('hello')
  await watchFileCreated(tmp)
  const result = JSON.parse(readFileSync(tmp).toString())
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: 'hello'
  })
})

test('auto pino.destination with a string as second argument', async () => {
  const tmp = file()
  const instance = pino(null, tmp)
  instance.info('hello')
  await watchFileCreated(tmp)
  const result = JSON.parse(readFileSync(tmp).toString())
  delete result.time
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: 'hello'
  })
})

test('does not override opts with a string as second argument', async () => {
  const tmp = file()
  const instance = pino({
    timestamp: () => ',"time":"none"'
  }, tmp)
  instance.info('hello')
  await watchFileCreated(tmp)
  const result = JSON.parse(readFileSync(tmp).toString())
  assert.deepEqual(result, {
    pid,
    hostname,
    level: 30,
    time: 'none',
    msg: 'hello'
  })
})

// https://github.com/pinojs/pino/issues/222
test('children with same names render in correct order', async () => {
  const stream = sink()
  const root = pino(stream)
  root.child({ a: 1 }).child({ a: 2 }).info({ a: 3 })
  const { a } = await once(stream, 'data')
  assert.equal(a, 3, 'last logged object takes precedence')
})

test('use `safe-stable-stringify` to avoid circular dependencies', async () => {
  const stream = sink()
  const root = pino(stream)
  // circular depth
  const obj = {}
  obj.a = obj
  root.info(obj)
  const { a } = await once(stream, 'data')
  assert.deepEqual(a, { a: '[Circular]' })
})

test('correctly log non circular objects', async () => {
  const stream = sink()
  const root = pino(stream)
  const obj = {}
  let parent = obj
  for (let i = 0; i < 10; i++) {
    parent.node = {}
    parent = parent.node
  }
  root.info(obj)
  const { node } = await once(stream, 'data')
  assert.deepEqual(node, { node: { node: { node: { node: { node: { node: { node: { node: { node: {} } } } } } } } } })
})

test('safe-stable-stringify must be used when interpolating', async () => {
  const stream = sink()
  const instance = pino(stream)

  const o = { a: { b: {} } }
  o.a.b.c = o.a.b
  instance.info('test %j', o)

  const { msg } = await once(stream, 'data')
  assert.equal(msg, 'test {"a":{"b":{"c":"[Circular]"}}}')
})

test('throws when setting useOnlyCustomLevels without customLevels', () => {
  assert.throws(
    () => {
      pino({
        useOnlyCustomLevels: true
      })
    },
    /customLevels is required if useOnlyCustomLevels is set true/
  )
})

test('correctly log Infinity', async () => {
  const stream = sink()
  const instance = pino(stream)

  const o = { num: Infinity }
  instance.info(o)

  const { num } = await once(stream, 'data')
  assert.equal(num, null)
})

test('correctly log -Infinity', async () => {
  const stream = sink()
  const instance = pino(stream)

  const o = { num: -Infinity }
  instance.info(o)

  const { num } = await once(stream, 'data')
  assert.equal(num, null)
})

test('correctly log NaN', async () => {
  const stream = sink()
  const instance = pino(stream)

  const o = { num: NaN }
  instance.info(o)

  const { num } = await once(stream, 'data')
  assert.equal(num, null)
})

test('offers a .default() method to please typescript', async () => {
  assert.equal(pino.default, pino)

  const stream = sink()
  const instance = pino.default(stream)
  instance.info('hello world')
  check(assert.equal, await once(stream, 'data'), 30, 'hello world')
})

test('correctly skip function', async () => {
  const stream = sink()
  const instance = pino(stream)

  const o = { num: NaN }
  instance.info(o, () => {})

  const { msg } = await once(stream, 'data')
  assert.equal(msg, undefined)
})

test('correctly skip Infinity', async () => {
  const stream = sink()
  const instance = pino(stream)

  const o = { num: NaN }
  instance.info(o, Infinity)

  const { msg } = await once(stream, 'data')
  assert.equal(msg, null)
})

test('correctly log number', async () => {
  const stream = sink()
  const instance = pino(stream)

  const o = { num: NaN }
  instance.info(o, 42)

  const { msg } = await once(stream, 'data')
  assert.equal(msg, 42)
})

test('nestedKey should not be used for non-objects', async () => {
  const stream = sink()
  const message = 'hello'
  const nestedKey = 'stuff'
  const instance = pino({
    nestedKey
  }, stream)
  instance.info(message)
  const result = await once(stream, 'data')
  delete result.time
  assert.deepStrictEqual(result, {
    pid,
    hostname,
    level: 30,
    msg: message
  })
})

test('throws if prettyPrint is passed in as an option', async () => {
  assert.throws(
    () => {
      pino({
        prettyPrint: true
      })
    },
    Error('prettyPrint option is no longer supported, see the pino-pretty package (https://github.com/pinojs/pino-pretty)')
  )
})

test('Should invoke `onChild` with the newly created child', () => {
  let innerChild
  const child = pino({
    onChild: (instance) => {
      innerChild = instance
    }
  }).child({ foo: 'bar' })
  assert.equal(child, innerChild)
})

test('logger message should have the prefix message that defined in the logger creation', async () => {
  const stream = sink()
  const logger = pino({
    msgPrefix: 'My name is Bond '
  }, stream)
  assert.equal(logger.msgPrefix, 'My name is Bond ')
  logger.info('James Bond')
  const { msg } = await once(stream, 'data')
  assert.equal(msg, 'My name is Bond James Bond')
})

test('child message should have the prefix message that defined in the child creation', async () => {
  const stream = sink()
  const instance = pino(stream)
  const child = instance.child({}, { msgPrefix: 'My name is Bond ' })
  child.info('James Bond')
  const { msg } = await once(stream, 'data')
  assert.equal(msg, 'My name is Bond James Bond')
})

test('child message should have the prefix message that defined in the child creation when logging with log meta', async () => {
  const stream = sink()
  const instance = pino(stream)
  const child = instance.child({}, { msgPrefix: 'My name is Bond ' })
  child.info({ hello: 'world' }, 'James Bond')
  const { msg, hello } = await once(stream, 'data')
  assert.equal(hello, 'world')
  assert.equal(msg, 'My name is Bond James Bond')
})

test('logged message should not have the prefix when not providing any message', async () => {
  const stream = sink()
  const instance = pino(stream)
  const child = instance.child({}, { msgPrefix: 'This should not be shown ' })
  child.info({ hello: 'world' })
  const { msg, hello } = await once(stream, 'data')
  assert.equal(hello, 'world')
  assert.equal(msg, undefined)
})

test('child message should append parent prefix to current prefix that defined in the child creation', async () => {
  const stream = sink()
  const instance = pino({
    msgPrefix: 'My name is Bond '
  }, stream)
  const child = instance.child({}, { msgPrefix: 'James ' })
  child.info('Bond')
  assert.equal(child.msgPrefix, 'My name is Bond James ')
  const { msg } = await once(stream, 'data')
  assert.equal(msg, 'My name is Bond James Bond')
})

test('child message should inherent parent prefix', async () => {
  const stream = sink()
  const instance = pino({
    msgPrefix: 'My name is Bond '
  }, stream)
  const child = instance.child({})
  child.info('James Bond')
  const { msg } = await once(stream, 'data')
  assert.equal(msg, 'My name is Bond James Bond')
})

test('grandchild message should inherent parent prefix', async () => {
  const stream = sink()
  const instance = pino(stream)
  const child = instance.child({}, { msgPrefix: 'My name is Bond ' })
  const grandchild = child.child({})
  grandchild.info('James Bond')
  const { msg } = await once(stream, 'data')
  assert.equal(msg, 'My name is Bond James Bond')
})
