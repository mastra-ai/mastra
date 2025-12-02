'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const proxyquire = require('proxyquire')
const strip = require('strip-ansi')
const tspl = require('@matteo.collina/tspl')

const writeStream = require('flush-write-stream')
const pino = require('../')
const multistream = pino.multistream
const { file, sink } = require('./helper')

test('sends to multiple streams using string levels', async () => {
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  const streams = [
    { stream },
    { level: 'debug', stream },
    { level: 'trace', stream },
    { level: 'fatal', stream },
    { level: 'silent', stream }
  ]
  const log = pino({
    level: 'trace'
  }, multistream(streams))
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
  assert.equal(messageCount, 9)
})

test('sends to multiple streams using custom levels', async () => {
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  const streams = [
    { stream },
    { level: 'debug', stream },
    { level: 'trace', stream },
    { level: 'fatal', stream },
    { level: 'silent', stream }
  ]
  const log = pino({
    level: 'trace'
  }, multistream(streams))
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
  assert.equal(messageCount, 9)
})

test('sends to multiple streams using optionally predefined levels', async () => {
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  const opts = {
    levels: {
      silent: Infinity,
      fatal: 60,
      error: 50,
      warn: 50,
      info: 30,
      debug: 20,
      trace: 10
    }
  }
  const streams = [
    { stream },
    { level: 'trace', stream },
    { level: 'debug', stream },
    { level: 'info', stream },
    { level: 'warn', stream },
    { level: 'error', stream },
    { level: 'fatal', stream },
    { level: 'silent', stream }
  ]
  const mstream = multistream(streams, opts)
  const log = pino({
    level: 'trace'
  }, mstream)
  log.trace('trace stream')
  log.debug('debug stream')
  log.info('info stream')
  log.warn('warn stream')
  log.error('error stream')
  log.fatal('fatal stream')
  log.silent('silent stream')
  assert.equal(messageCount, 24)
})

test('sends to multiple streams using number levels', async () => {
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  const streams = [
    { stream },
    { level: 20, stream },
    { level: 60, stream }
  ]
  const log = pino({
    level: 'debug'
  }, multistream(streams))
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
  assert.equal(messageCount, 6)
})

test('level include higher levels', async () => {
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  const log = pino({}, multistream([{ level: 'info', stream }]))
  log.fatal('message')
  assert.equal(messageCount, 1)
})

test('supports multiple arguments', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const messages = []
  const stream = writeStream(function (data, enc, cb) {
    messages.push(JSON.parse(data))
    if (messages.length === 2) {
      const msg1 = messages[0]
      plan.equal(msg1.msg, 'foo bar baz foobar')

      const msg2 = messages[1]
      plan.equal(msg2.msg, 'foo bar baz foobar barfoo foofoo')
    }
    cb()
  })
  const log = pino({}, multistream({ stream }))
  log.info('%s %s %s %s', 'foo', 'bar', 'baz', 'foobar') // apply not invoked
  log.info('%s %s %s %s %s %s', 'foo', 'bar', 'baz', 'foobar', 'barfoo', 'foofoo') // apply invoked

  await plan
})

test('supports children', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const stream = writeStream(function (data, enc, cb) {
    const input = JSON.parse(data)
    plan.equal(input.msg, 'child stream')
    plan.equal(input.child, 'one')
    cb()
  })
  const streams = [
    { stream }
  ]
  const log = pino({}, multistream(streams)).child({ child: 'one' })
  log.info('child stream')

  await plan
})

test('supports grandchildren', async (t) => {
  const plan = tspl(t, { plan: 9 })
  const messages = []
  const stream = writeStream(function (data, enc, cb) {
    messages.push(JSON.parse(data))
    if (messages.length === 3) {
      const msg1 = messages[0]
      plan.equal(msg1.msg, 'grandchild stream')
      plan.equal(msg1.child, 'one')
      plan.equal(msg1.grandchild, 'two')

      const msg2 = messages[1]
      plan.equal(msg2.msg, 'grandchild stream')
      plan.equal(msg2.child, 'one')
      plan.equal(msg2.grandchild, 'two')

      const msg3 = messages[2]
      plan.equal(msg3.msg, 'debug grandchild')
      plan.equal(msg3.child, 'one')
      plan.equal(msg3.grandchild, 'two')
    }
    cb()
  })
  const streams = [
    { stream },
    { level: 'debug', stream }
  ]
  const log = pino({
    level: 'debug'
  }, multistream(streams)).child({ child: 'one' }).child({ grandchild: 'two' })
  log.info('grandchild stream')
  log.debug('debug grandchild')

  await plan
})

test('supports custom levels', (t, end) => {
  const stream = writeStream(function (data, enc, cb) {
    assert.equal(JSON.parse(data).msg, 'bar')
    end()
  })
  const log = pino({
    customLevels: {
      foo: 35
    }
  }, multistream([{ level: 35, stream }]))
  log.foo('bar')
})

test('supports pretty print', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const stream = writeStream(function (data, enc, cb) {
    plan.equal(strip(data.toString()).match(/INFO.*: pretty print/) != null, true)
    cb()
  })

  const safeBoom = proxyquire('pino-pretty/lib/utils/build-safe-sonic-boom.js', {
    'sonic-boom': function () {
      plan.ok('sonic created')
      stream.flushSync = () => {}
      stream.flush = () => {}
      return stream
    }
  })
  const nested = proxyquire('pino-pretty/lib/utils/index.js', {
    './build-safe-sonic-boom.js': safeBoom
  })
  const pretty = proxyquire('pino-pretty', {
    './lib/utils/index.js': nested
  })

  const log = pino({
    level: 'debug',
    name: 'helloName'
  }, multistream([
    { stream: pretty() }
  ]))

  log.info('pretty print')

  await plan
})

test('emit propagates events to each stream', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const handler = function (data) {
    plan.equal(data.msg, 'world')
  }
  const streams = [sink(), sink(), sink()]
  streams.forEach(function (s) {
    s.once('hello', handler)
  })
  const stream = multistream(streams)
  stream.emit('hello', { msg: 'world' })

  await plan
})

test('children support custom levels', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const stream = writeStream(function (data, enc, cb) {
    plan.equal(JSON.parse(data).msg, 'bar')
  })
  const parent = pino({
    customLevels: {
      foo: 35
    }
  }, multistream([{ level: 35, stream }]))
  const child = parent.child({ child: 'yes' })
  child.foo('bar')

  await plan
})

test('levelVal overrides level', async () => {
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  const streams = [
    { stream },
    { level: 'blabla', levelVal: 15, stream },
    { level: 60, stream }
  ]
  const log = pino({
    level: 'debug'
  }, multistream(streams))
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
  assert.equal(messageCount, 6)
})

test('forwards metadata', async (t) => {
  const plan = tspl(t, { plan: 4 })
  const streams = [
    {
      stream: {
        [Symbol.for('pino.metadata')]: true,
        write (chunk) {
          plan.equal(log, this.lastLogger)
          plan.equal(30, this.lastLevel)
          plan.deepEqual({ hello: 'world' }, this.lastObj)
          plan.deepEqual('a msg', this.lastMsg)
        }
      }
    }
  ]

  const log = pino({
    level: 'debug'
  }, multistream(streams))

  log.info({ hello: 'world' }, 'a msg')

  await plan
})

test('forward name', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const streams = [
    {
      stream: {
        [Symbol.for('pino.metadata')]: true,
        write (chunk) {
          const line = JSON.parse(chunk)
          plan.equal(line.name, 'helloName')
          plan.equal(line.hello, 'world')
        }
      }
    }
  ]

  const log = pino({
    level: 'debug',
    name: 'helloName'
  }, multistream(streams))

  log.info({ hello: 'world' }, 'a msg')

  await plan
})

test('forward name with child', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const streams = [
    {
      stream: {
        write (chunk) {
          const line = JSON.parse(chunk)
          plan.equal(line.name, 'helloName')
          plan.equal(line.hello, 'world')
          plan.equal(line.component, 'aComponent')
        }
      }
    }
  ]

  const log = pino({
    level: 'debug',
    name: 'helloName'
  }, multistream(streams)).child({ component: 'aComponent' })

  log.info({ hello: 'world' }, 'a msg')

  await plan
})

test('clone generates a new multistream with all stream at the same level', async (t) => {
  const plan = tspl(t, { plan: 14 })
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  const streams = [
    { stream },
    { level: 'debug', stream },
    { level: 'trace', stream },
    { level: 'fatal', stream }
  ]
  const ms = multistream(streams)
  const clone = ms.clone(30)

  // eslint-disable-next-line eqeqeq
  plan.equal(clone != ms, true)

  clone.streams.forEach((s, i) => {
    // eslint-disable-next-line eqeqeq
    plan.equal(s != streams[i], true)
    plan.equal(s.stream, streams[i].stream)
    plan.equal(s.level, 30)
  })

  const log = pino({
    level: 'trace'
  }, clone)

  log.info('info stream')
  log.debug('debug message not counted')
  log.fatal('fatal stream')
  plan.equal(messageCount, 8)

  await plan
})

test('one stream', async () => {
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  const log = pino({
    level: 'trace'
  }, multistream({ stream, level: 'fatal' }))
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
  assert.equal(messageCount, 1)
})

test('dedupe', async () => {
  let messageCount = 0
  const stream1 = writeStream(function (data, enc, cb) {
    messageCount -= 1
    cb()
  })

  const stream2 = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })

  const streams = [
    {
      stream: stream1,
      level: 'info'
    },
    {
      stream: stream2,
      level: 'fatal'
    }
  ]

  const log = pino({
    level: 'trace'
  }, multistream(streams, { dedupe: true }))
  log.info('info stream')
  log.fatal('fatal stream')
  log.fatal('fatal stream')
  assert.equal(messageCount, 1)
})

test('dedupe when logs have different levels', async () => {
  let messageCount = 0
  const stream1 = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })

  const stream2 = writeStream(function (data, enc, cb) {
    messageCount += 2
    cb()
  })

  const streams = [
    {
      stream: stream1,
      level: 'info'
    },
    {
      stream: stream2,
      level: 'error'
    }
  ]

  const log = pino({
    level: 'trace'
  }, multistream(streams, { dedupe: true }))

  log.info('info stream')
  log.warn('warn stream')
  log.error('error streams')
  log.fatal('fatal streams')
  assert.equal(messageCount, 6)
})

test('dedupe when some streams has the same level', async () => {
  let messageCount = 0
  const stream1 = writeStream(function (data, enc, cb) {
    messageCount -= 1
    cb()
  })

  const stream2 = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })

  const stream3 = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })

  const streams = [
    {
      stream: stream1,
      level: 'info'
    },
    {
      stream: stream2,
      level: 'fatal'
    },
    {
      stream: stream3,
      level: 'fatal'
    }
  ]

  const log = pino({
    level: 'trace'
  }, multistream(streams, { dedupe: true }))
  log.info('info stream')
  log.fatal('fatal streams')
  log.fatal('fatal streams')
  assert.equal(messageCount, 3)
})

test('no stream', async () => {
  const log = pino({
    level: 'trace'
  }, multistream())
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
})

test('one stream', async () => {
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  const log = pino({
    level: 'trace'
  }, multistream(stream))
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
  assert.equal(messageCount, 2)
})

test('add a stream', async () => {
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })

  const log = pino({
    level: 'trace'
  }, multistream().add(stream))
  log.info('info stream')
  log.debug('debug stream')
  log.fatal('fatal stream')
  assert.equal(messageCount, 2)
})

test('remove a stream', async () => {
  let messageCount1 = 0
  let messageCount2 = 0
  let messageCount3 = 0

  const stream1 = writeStream(function (data, enc, cb) {
    messageCount1 += 1
    cb()
  })

  const stream2 = writeStream(function (data, enc, cb) {
    messageCount2 += 1
    cb()
  })

  const stream3 = writeStream(function (data, enc, cb) {
    messageCount3 += 1
    cb()
  })

  const multi = multistream()
  const log = pino({ level: 'trace', sync: true }, multi)

  multi.add(stream1)
  const id1 = multi.lastId

  multi.add(stream2)
  const id2 = multi.lastId

  multi.add(stream3)
  const id3 = multi.lastId

  log.info('line')
  multi.remove(id1)

  log.info('line')
  multi.remove(id2)

  log.info('line')
  multi.remove(id3)

  log.info('line')
  multi.remove(Math.floor(Math.random() * 1000)) // non-existing id

  assert.equal(messageCount1, 1)
  assert.equal(messageCount2, 2)
  assert.equal(messageCount3, 3)
})

test('multistream.add throws if not a stream', async () => {
  try {
    pino({
      level: 'trace'
    }, multistream().add({}))
  } catch (_) {
  }
})

test('multistream throws if not a stream', async () => {
  try {
    pino({
      level: 'trace'
    }, multistream({}))
  } catch (_) {
  }
})

test('multistream.write should not throw if one stream fails', async () => {
  let messageCount = 0
  const stream = writeStream(function (data, enc, cb) {
    messageCount += 1
    cb()
  })
  const noopStream = pino.transport({
    target: join(__dirname, 'fixtures', 'noop-transport.js')
  })
  // eslint-disable-next-line
  noopStream.on('error', function (err) {
    // something went wrong while writing to noop stream, ignoring!
  })
  const log = pino({
    level: 'trace'
  },
  multistream([
    {
      level: 'trace',
      stream
    },
    {
      level: 'debug',
      stream: noopStream
    }
  ])
  )
  log.debug('0')
  noopStream.end()
  // noop stream is ending, should emit an error but not throw
  log.debug('1')
  log.debug('2')
  assert.equal(messageCount, 3)
})

test('flushSync', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const tmp = file()
  const destination = pino.destination({ dest: tmp, sync: false, minLength: 4096 })
  const stream = multistream([{ level: 'info', stream: destination }])
  const log = pino({ level: 'info' }, stream)
  destination.on('ready', () => {
    log.info('foo')
    log.info('bar')
    stream.flushSync()
    plan.equal(readFileSync(tmp, { encoding: 'utf-8' }).split('\n').length - 1, 2)
    log.info('biz')
    stream.flushSync()
    plan.equal(readFileSync(tmp, { encoding: 'utf-8' }).split('\n').length - 1, 3)
  })

  await plan
})

test('ends all streams', async (t) => {
  const plan = tspl(t, { plan: 7 })
  const stream = writeStream(function (data, enc, cb) {
    plan.ok('message')
    cb()
  })
  stream.flushSync = function () {
    plan.ok('flushSync')
  }
  // stream2 has no flushSync
  const stream2 = writeStream(function (data, enc, cb) {
    plan.ok('message2')
    cb()
  })
  const streams = [
    { stream },
    { level: 'debug', stream },
    { level: 'trace', stream: stream2 },
    { level: 'fatal', stream },
    { level: 'silent', stream }
  ]
  const multi = multistream(streams)
  const log = pino({
    level: 'trace'
  }, multi)
  log.info('info stream')
  multi.end()

  await plan
})
