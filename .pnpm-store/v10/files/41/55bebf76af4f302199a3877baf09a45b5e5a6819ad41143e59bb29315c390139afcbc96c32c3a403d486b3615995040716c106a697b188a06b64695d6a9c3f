'use strict'

const test = require('node:test')
const proxyquire = require('proxyquire')
const tspl = require('@matteo.collina/tspl')

test('should import', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const mockRealRequire = (target) => {
    return {
      default: {
        default: () => {
          plan.equal(target, 'pino-pretty')
          return Promise.resolve()
        }
      }
    }
  }
  const mockRealImport = async () => {
    await Promise.resolve()
    throw Object.assign(new Error(), { code: 'ERR_MODULE_NOT_FOUND' })
  }

  const loadTransportStreamBuilder = proxyquire(
    '../lib/transport-stream.js',
    {
      'real-require': {
        realRequire: mockRealRequire,
        realImport: mockRealImport
      }
    }
  )

  const fn = await loadTransportStreamBuilder('pino-pretty')

  await fn()
  plan.ok('returned promise resolved')

  await plan
})
