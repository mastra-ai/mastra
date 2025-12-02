'use strict'

const test = require('node:test')
const { createError, FastifyError } = require('..')

test('Create error with zero parameter', (t) => {
  t.plan(6)

  const NewError = createError('CODE', 'Not available')
  const err = new NewError()
  t.assert.ok(err instanceof Error)
  t.assert.equal(err.name, 'FastifyError')
  t.assert.equal(err.message, 'Not available')
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, 500)
  t.assert.ok(err.stack)
})

test('Create error with 1 parameter', (t) => {
  t.plan(6)

  const NewError = createError('CODE', 'hey %s')
  const err = new NewError('alice')
  t.assert.equal(err.name, 'FastifyError')
  t.assert.ok(err instanceof Error)
  t.assert.equal(err.message, 'hey alice')
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, 500)
  t.assert.ok(err.stack)
})

test('Create error with 1 parameter set to undefined', (t) => {
  t.plan(1)

  const NewError = createError('CODE', 'hey %s')
  const err = new NewError(undefined)
  t.assert.equal(err.message, 'hey undefined')
})

test('Create error with 2 parameters', (t) => {
  t.plan(6)

  const NewError = createError('CODE', 'hey %s, I like your %s')
  const err = new NewError('alice', 'attitude')
  t.assert.ok(err instanceof Error)
  t.assert.equal(err.name, 'FastifyError')
  t.assert.equal(err.message, 'hey alice, I like your attitude')
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, 500)
  t.assert.ok(err.stack)
})

test('Create error with 2 parameters set to undefined', (t) => {
  t.plan(1)

  const NewError = createError('CODE', 'hey %s, I like your %s')
  const err = new NewError(undefined, undefined)
  t.assert.equal(err.message, 'hey undefined, I like your undefined')
})

test('Create error with 3 parameters', (t) => {
  t.plan(6)

  const NewError = createError('CODE', 'hey %s, I like your %s %s')
  const err = new NewError('alice', 'attitude', 'see you')
  t.assert.ok(err instanceof Error)
  t.assert.equal(err.name, 'FastifyError')
  t.assert.equal(err.message, 'hey alice, I like your attitude see you')
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, 500)
  t.assert.ok(err.stack)
})

test('Create error with 3 parameters set to undefined', (t) => {
  t.plan(4)

  const NewError = createError('CODE', 'hey %s, I like your %s %s')
  const err = new NewError(undefined, undefined, undefined)
  t.assert.equal(err.message, 'hey undefined, I like your undefined undefined')
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, 500)
  t.assert.ok(err.stack)
})

test('Create error with 4 parameters set to undefined', (t) => {
  t.plan(4)

  const NewError = createError('CODE', 'hey %s, I like your %s %s and %s')
  const err = new NewError(undefined, undefined, undefined, undefined)
  t.assert.equal(
    err.message,
    'hey undefined, I like your undefined undefined and undefined'
  )
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, 500)
  t.assert.ok(err.stack)
})

test('Create error with no statusCode property', (t) => {
  t.plan(6)

  const NewError = createError('CODE', 'hey %s', 0)
  const err = new NewError('dude')
  t.assert.ok(err instanceof Error)
  t.assert.equal(err.name, 'FastifyError')
  t.assert.equal(err.message, 'hey dude')
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, undefined)
  t.assert.ok(err.stack)
})

test('Should throw when error code has no fastify code', (t) => {
  t.plan(1)
  t.assert.throws(
    () => createError(),
    new Error('Fastify error code must not be empty')
  )
})

test('Should throw when error code has no message', (t) => {
  t.assert.throws(
    () => createError('code'),
    new Error('Fastify error message must not be empty')
  )
})

test('Create error with different base', (t) => {
  t.plan(7)

  const NewError = createError('CODE', 'hey %s', 500, TypeError)
  const err = new NewError('dude')
  t.assert.ok(err instanceof Error)
  t.assert.ok(err instanceof TypeError)
  t.assert.equal(err.name, 'FastifyError')
  t.assert.equal(err.message, 'hey dude')
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, 500)
  t.assert.ok(err.stack)
})

test('Create error with different base (no stack) (global)', (t) => {
  t.plan(7)

  createError.captureStackTrace = false
  const NewError = createError('CODE', 'hey %s', 500, TypeError)
  const err = new NewError('dude')
  t.assert.ok(err instanceof Error)
  t.assert.ok(err instanceof TypeError)
  t.assert.equal(err.name, 'FastifyError')
  t.assert.equal(err.message, 'hey dude')
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, 500)
  t.assert.equal(err.stack, undefined)
  createError.captureStackTrace = true
})

test('Create error with different base (no stack) (parameter)', (t) => {
  t.plan(7)

  const NewError = createError('CODE', 'hey %s', 500, TypeError, false)
  const err = new NewError('dude')
  t.assert.ok(err instanceof Error)
  t.assert.ok(err instanceof TypeError)
  t.assert.equal(err.name, 'FastifyError')
  t.assert.equal(err.message, 'hey dude')
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, 500)
  t.assert.equal(err.stack, undefined)
})

test('FastifyError.toString returns code', (t) => {
  t.plan(1)

  const NewError = createError('CODE', 'foo')
  const err = new NewError()
  t.assert.equal(err.toString(), 'FastifyError [CODE]: foo')
})

test('Create the error without the new keyword', (t) => {
  t.plan(6)

  const NewError = createError('CODE', 'Not available')
  const err = NewError()
  t.assert.ok(err instanceof Error)
  t.assert.equal(err.name, 'FastifyError')
  t.assert.equal(err.message, 'Not available')
  t.assert.equal(err.code, 'CODE')
  t.assert.equal(err.statusCode, 500)
  t.assert.ok(err.stack)
})

test('Create an error with cause', (t) => {
  t.plan(2)

  const cause = new Error('HEY')
  const NewError = createError('CODE', 'Not available')
  const err = NewError({ cause })

  t.assert.ok(err instanceof Error)
  t.assert.equal(err.cause, cause)
})

test('Create an error with cause and message', (t) => {
  t.plan(2)

  const cause = new Error('HEY')
  const NewError = createError('CODE', 'Not available: %s')
  const err = NewError('foo', { cause })

  t.assert.ok(err instanceof Error)
  t.assert.equal(err.cause, cause)
})

test('Create an error with last argument null', (t) => {
  t.plan(2)

  const cause = new Error('HEY')
  const NewError = createError('CODE', 'Not available')
  const err = NewError({ cause }, null)

  t.assert.ok(err instanceof Error)
  t.assert.ifError(err.cause)
})

test('check if FastifyError is instantiable', (t) => {
  t.plan(2)

  const err = new FastifyError()

  t.assert.ok(err instanceof FastifyError)
  t.assert.ok(err instanceof Error)
})
