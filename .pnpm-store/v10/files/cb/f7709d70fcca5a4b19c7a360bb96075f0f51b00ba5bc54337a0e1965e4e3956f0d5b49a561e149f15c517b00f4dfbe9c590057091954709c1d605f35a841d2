'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const pino = require('../..')()

test('should be the same as package.json', () => {
  const json = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'))
      .toString('utf8')
  )

  assert.equal(pino.version, json.version)
})
