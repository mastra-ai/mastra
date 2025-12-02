'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { join } = require('node:path')
const { fork } = require('node:child_process')
const tspl = require('@matteo.collina/tspl')
const { once } = require('./helper')
const pino = require('..')

if (process.platform === 'win32') {
  console.log('skipping on windows')
  process.exit(0)
}

if (process.env.CITGM) {
  // This looks like a some form of limitations of the CITGM test runner
  // or the HW/SW we run it on. This file can hang on Node.js v18.x.
  // The failure does not reproduce locally or on our CI.
  // Skipping it is the only way to keep pino in CITGM.
  // https://github.com/nodejs/citgm/pull/1002#issuecomment-1751942988
  console.log('Skipping on Node.js core CITGM because it hangs on v18.x')
  process.exit(0)
}

function testFile (file) {
  file = join('fixtures', 'broken-pipe', file)
  test(file, async () => {
    const child = fork(join(__dirname, file), { silent: true })
    child.stdout.destroy()

    child.stderr.pipe(process.stdout)

    const res = await once(child, 'close')
    assert.equal(res, 0) // process exits successfully
  })
}

testFile('basic.js')
testFile('destination.js')
testFile('syncfalse.js')

test('let error pass through', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const stream = pino.destination({ sync: true })

  // side effect of the pino constructor is that it will set an
  // event handler for error
  pino(stream)

  process.nextTick(() => stream.emit('error', new Error('kaboom')))
  process.nextTick(() => stream.emit('error', new Error('kaboom')))

  stream.on('error', (err) => {
    plan.equal(err.message, 'kaboom')
  })

  await plan
})
