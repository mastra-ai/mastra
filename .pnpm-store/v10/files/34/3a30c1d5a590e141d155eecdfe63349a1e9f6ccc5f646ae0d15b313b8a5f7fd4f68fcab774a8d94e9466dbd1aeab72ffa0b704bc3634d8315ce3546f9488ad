'use strict'

const { test } = require('node:test')

const build = require('..')

test('serialize string with quotes - issue #794', (t) => {
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
    message: 'Error: Property "name" is required'
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

test('serialize string with various quote types - issue #794', (t) => {
  t.plan(6)

  const schema = {
    type: 'string'
  }

  const stringify = build(schema)

  // Test double quotes
  const inputDoubleQuotes = 'Property "name" is required'
  const outputDoubleQuotes = stringify(inputDoubleQuotes)
  t.assert.doesNotThrow(() => JSON.parse(outputDoubleQuotes))
  t.assert.equal(JSON.parse(outputDoubleQuotes), inputDoubleQuotes)

  // Test single quotes (should be fine but test for completeness)
  const inputSingleQuotes = "Property 'name' is required"
  const outputSingleQuotes = stringify(inputSingleQuotes)
  t.assert.doesNotThrow(() => JSON.parse(outputSingleQuotes))
  t.assert.equal(JSON.parse(outputSingleQuotes), inputSingleQuotes)

  // Test mixed quotes
  const inputMixedQuotes = 'Error: "Property \'name\' is required"'
  const outputMixedQuotes = stringify(inputMixedQuotes)
  t.assert.doesNotThrow(() => JSON.parse(outputMixedQuotes))
  t.assert.equal(JSON.parse(outputMixedQuotes), inputMixedQuotes)
})

test('serialize error-like object with quotes in message - issue #794', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          message: {
            type: 'string'
          },
          code: {
            type: 'string'
          }
        }
      }
    }
  }

  const input = {
    error: {
      message: 'Validation failed: Property "email" must be a valid email address',
      code: 'VALIDATION_ERROR'
    }
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

test('serialize validation errors array with quotes - issue #794', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            message: {
              type: 'string'
            },
            field: {
              type: 'string'
            }
          }
        }
      }
    }
  }

  const input = {
    errors: [
      {
        message: 'Property "name" is required',
        field: 'name'
      },
      {
        message: 'Property "email" must be a valid email address',
        field: 'email'
      },
      {
        message: 'Value must be between "1" and "100"',
        field: 'age'
      }
    ]
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

test('serialize string with backslashes and quotes - issue #794', (t) => {
  t.plan(4)

  const schema = {
    type: 'string'
  }

  const stringify = build(schema)

  // Test backslashes
  const inputBackslash = 'Path: C:\\Users\\test\\file.json'
  const outputBackslash = stringify(inputBackslash)
  t.assert.doesNotThrow(() => JSON.parse(outputBackslash))
  t.assert.equal(JSON.parse(outputBackslash), inputBackslash)

  // Test combination of backslashes and quotes
  const inputMixed = 'Error: Could not find file "C:\\Users\\test\\config.json"'
  const outputMixed = stringify(inputMixed)
  t.assert.doesNotThrow(() => JSON.parse(outputMixed))
  t.assert.equal(JSON.parse(outputMixed), inputMixed)
})
