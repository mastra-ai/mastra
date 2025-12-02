'use strict'

const test = require('node:test')
const { join } = require('node:path')
const Writable = require('node:stream').Writable
const proxyquire = require('proxyquire')
const tspl = require('@matteo.collina/tspl')
const pino = require('../../pino')

test('file-target mocked', async function (t) {
  const plan = tspl(t, { plan: 1 })
  let ret
  const fileTarget = proxyquire('../../file', {
    './pino': {
      destination (opts) {
        plan.deepEqual(opts, { dest: 1, sync: false })

        ret = new Writable()
        ret.fd = opts.dest

        process.nextTick(() => {
          ret.emit('ready')
        })

        return ret
      }
    }
  })

  await fileTarget()
  await plan
})

test('pino.transport with syntax error', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const transport = pino.transport({
    targets: [{
      target: join(__dirname, '..', 'fixtures', 'syntax-error-esm.mjs')
    }]
  })
  t.after(transport.end.bind(transport))

  transport.on('error', (err) => {
    plan.deepEqual(err, new SyntaxError('Unexpected end of input'))
  })

  await plan
})
