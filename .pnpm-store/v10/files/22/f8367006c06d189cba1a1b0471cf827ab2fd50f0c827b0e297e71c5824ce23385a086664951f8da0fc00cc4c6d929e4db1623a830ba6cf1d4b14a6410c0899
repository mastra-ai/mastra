'use strict'

const { test } = require('node:test')

const build = require('..')

test('serialize string with newlines - issue #793', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      message: {
        type: 'string'
      }
    }
  }

  const input = {
    message: `This is a string
with multiple
newlines in it
Foo`
  }

  const stringify = build(schema)
  const output = stringify(input)

  // The output should be valid JSON
  t.assert.doesNotThrow(() => {
    JSON.parse(output)
  }, 'JSON output should be parseable')

  // The parsed output should match the input
  const parsed = JSON.parse(output)
  t.assert.equal(parsed.message, input.message)
})

test('serialize string with various newline characters - issue #793', (t) => {
  t.plan(4)

  const schema = {
    type: 'string'
  }

  const stringify = build(schema)

  // Test \n (line feed)
  const inputLF = 'line1\nline2'
  const outputLF = stringify(inputLF)
  t.assert.equal(JSON.parse(outputLF), inputLF)

  // Test \r (carriage return)
  const inputCR = 'line1\rline2'
  const outputCR = stringify(inputCR)
  t.assert.equal(JSON.parse(outputCR), inputCR)

  // Test \r\n (CRLF)
  const inputCRLF = 'line1\r\nline2'
  const outputCRLF = stringify(inputCRLF)
  t.assert.equal(JSON.parse(outputCRLF), inputCRLF)

  // Test mixed newlines
  const inputMixed = 'line1\nline2\rline3\r\nline4'
  const outputMixed = stringify(inputMixed)
  t.assert.equal(JSON.parse(outputMixed), inputMixed)
})

test('serialize object with newlines in multiple properties - issue #793', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      message: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      timestamp: {
        type: 'string'
      }
    }
  }

  const input = {
    message: `This is a string
with multiple
newlines in it
Foo`,
    description: 'This JSON response contains a field with newline characters',
    timestamp: new Date().toISOString()
  }

  const stringify = build(schema)
  const output = stringify(input)

  // The output should be valid JSON
  t.assert.doesNotThrow(() => {
    JSON.parse(output)
  }, 'JSON output should be parseable')

  // The parsed output should match the input
  const parsed = JSON.parse(output)
  t.assert.deepEqual(parsed, input)
})
