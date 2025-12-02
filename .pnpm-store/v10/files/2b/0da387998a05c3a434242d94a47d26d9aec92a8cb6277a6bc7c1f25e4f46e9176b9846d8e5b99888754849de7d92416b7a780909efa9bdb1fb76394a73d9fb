'use strict'

const { defineConfig, globalIgnores } = require('eslint/config')
const neostandard = require('neostandard')

module.exports = defineConfig([
  neostandard({}),
  globalIgnores([
    'pino.d.ts',
    'test/types/pino.test-d.ts',
    'test/fixtures/syntax-error-esm.mjs',
    'test/fixtures/ts/*cjs',
  ]),
  {
    rules: {
      'no-var': 'off',
    },
  },
])
