'use strict'

const cp = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const test = require('node:test')
const { createError, FastifyError } = require('..')

test('Readme: All errors created with `createError` will be instances of the base error constructor you provided, or `Error` if none was provided.', (t) => {
  t.plan(3)

  const CustomError = createError('ERROR_CODE', 'Hello %s', 500, TypeError)
  const customError = new CustomError('world')

  t.assert.ok(customError instanceof CustomError)
  t.assert.ok(customError instanceof TypeError)
  t.assert.ok(customError instanceof Error)
})

test('Readme: All instantiated errors will be instances of the `FastifyError` class. The `FastifyError` class can be required from the module directly.', (t) => {
  t.plan(1)

  const CustomError = createError('ERROR_CODE', 'Hello %s', 500, TypeError)
  const customError = new CustomError('world')

  t.assert.ok(customError instanceof FastifyError)
})

test('Readme: It is possible to create a `FastifyError` that extends another `FastifyError`, created by `createError`, while instanceof working correctly.', (t) => {
  t.plan(5)

  const CustomError = createError('ERROR_CODE', 'Hello %s', 500, TypeError)
  const ChildCustomError = createError('CHILD_ERROR_CODE', 'Hello %s', 500, CustomError)

  const customError = new ChildCustomError('world')

  t.assert.ok(customError instanceof ChildCustomError)
  t.assert.ok(customError instanceof CustomError)
  t.assert.ok(customError instanceof FastifyError)
  t.assert.ok(customError instanceof TypeError)
  t.assert.ok(customError instanceof Error)
})

test('Readme: Changing the code of an instantiated Error will not change the result of the `instanceof` operator.', (t) => {
  t.plan(3)

  const CustomError = createError('ERROR_CODE', 'Hello %s', 500, TypeError)
  const AnotherCustomError = createError('ANOTHER_ERROR_CODE', 'Hello %s', 500, CustomError)

  const customError = new CustomError('world')
  customError.code = 'ANOTHER_ERROR_CODE'

  t.assert.ok(customError instanceof CustomError)
  t.assert.ok(customError instanceof AnotherCustomError === false)
  t.assert.ok(customError instanceof FastifyError)
})

test('check if createError creates an Error which is instanceof Error', (t) => {
  t.plan(3)

  const CustomFastifyError = createError('CODE', 'Not available')
  const err = CustomFastifyError()

  t.assert.ok(err instanceof Error)
  t.assert.ok(err instanceof SyntaxError === false)
  t.assert.ok(err instanceof TypeError === false)
})

test('check if createError creates an Error which is instanceof FastifyError', (t) => {
  t.plan(4)

  const CustomFastifyError = createError('CODE', 'Not available')
  const err = CustomFastifyError()

  t.assert.ok(err instanceof Error)
  t.assert.ok(err instanceof FastifyError)
  t.assert.ok(err instanceof SyntaxError === false)
  t.assert.ok(err instanceof TypeError === false)
})

test('check if createError creates an Error with the right BaseConstructor', (t) => {
  t.plan(2)

  const CustomFastifyError = createError('CODE', 'Not available', 500, TypeError)
  const err = CustomFastifyError()

  t.assert.ok(err instanceof Error)
  t.assert.ok(err instanceof TypeError)
})

test('check if createError creates an Error with the right BaseConstructor, which is a FastifyError', (t) => {
  t.plan(6)

  const BaseFastifyError = createError('CODE', 'Not available', 500, TypeError)
  const CustomFastifyError = createError('CODE', 'Not available', 500, BaseFastifyError)
  const err = CustomFastifyError()

  t.assert.ok(err instanceof Error)
  t.assert.ok(err instanceof TypeError)
  t.assert.ok(err instanceof FastifyError)
  t.assert.ok(err instanceof BaseFastifyError)
  t.assert.ok(err instanceof CustomFastifyError)
  t.assert.ok(err instanceof SyntaxError === false)
})

// for more information see https://github.com/fastify/fastify-error/pull/86#issuecomment-1301466407
test('ensure that instanceof works accross different installations of the fastify-error module', async (t) => {
  const assertsPlanned = 5
  t.plan(assertsPlanned)

  // We need to create a test environment where fastify-error is installed in two different locations
  // and then we will check if the error created in one location is instanceof the error created in the other location
  // This is done by creating a test directory with the following structure:

  // /
  // ├── index.js
  // └── node_modules/
  //     ├── fastify-error/
  //     │   └── index.js
  //     └── dep/
  //         ├── index.js
  //         └── node_modules/
  //             └── fastify-error/
  //                 └── index.js

  const testDirectoryPrefix = 'fastify-error-instanceof-test-'

  const testCwd = path.resolve(os.tmpdir(), `${testDirectoryPrefix}${Math.random().toString(36).substring(2, 15)}`)
  fs.mkdirSync(testCwd, { recursive: true })

  // Create the index.js. It will be executed as a forked process, so we need to
  // use process.send to send messages back to the parent process.
  fs.writeFileSync(path.resolve(testCwd, 'index.js'), `
    'use strict'

    const path = require('node:path')
    const { createError, FastifyError } = require('fastify-error')
    const { foo } = require('dep')

    const actualPathOfFastifyError = require.resolve('fastify-error')
    const expectedPathOfFastifyError = path.resolve('node_modules', 'fastify-error', 'index.js')

    // Ensure that fastify-error is required from the node_modules directory of the test-project
    if (actualPathOfFastifyError !== expectedPathOfFastifyError) {
      console.error('actualPathOfFastifyError', actualPathOfFastifyError)
      console.error('expectedPathOfFastifyError', expectedPathOfFastifyError)
      throw new Error('fastify-error should be required from the node_modules directory of the test-project')
    }
    
    const Boom = createError('Boom', 'Boom', 500)
    const ChildBoom = createError('ChildBoom', 'Boom', 500, Boom)
    const NotChildBoom = createError('NotChildBoom', 'NotChildBoom', 500, Boom)

    try {
        foo()
    } catch (err) {
        process.send(err instanceof Error)
        process.send(err instanceof FastifyError)
        process.send(err instanceof NotChildBoom)
        process.send(err instanceof Boom)
        process.send(err instanceof ChildBoom)
    }
    `)

  // Create /node_modules/fastify-error directory
  // Copy the index.js file to the fastify-error directory
  fs.mkdirSync(path.resolve(testCwd, 'node_modules', 'fastify-error'), { recursive: true })
  fs.copyFileSync(path.resolve(process.cwd(), 'index.js'), path.resolve(testCwd, 'node_modules', 'fastify-error', 'index.js'))

  // Create /node_modules/dep/node_modules/fastify-error directory
  // Copy the index.js to the fastify-error directory
  fs.mkdirSync(path.resolve(testCwd, 'node_modules', 'dep', 'node_modules', 'fastify-error'), { recursive: true })
  fs.copyFileSync(path.resolve(process.cwd(), 'index.js'), path.resolve(testCwd, 'node_modules', 'dep', 'node_modules', 'fastify-error', 'index.js'))

  // Create /node_modules/dep/index.js. It will export a function foo which will
  // throw an error when called. The error will be an instance of ChildBoom, created
  // by the fastify-error module in the node_modules directory of dep.
  fs.writeFileSync(path.resolve(testCwd, 'node_modules', 'dep', 'index.js'), `
    'use strict'

    const path = require('node:path')
    const { createError } = require('fastify-error')

    const actualPathOfFastifyError = require.resolve('fastify-error')
    const expectedPathOfFastifyError = path.resolve('node_modules', 'dep', 'node_modules', 'fastify-error', 'index.js')

    // Ensure that fastify-error is required from the node_modules directory of the test-project
    if (actualPathOfFastifyError !== expectedPathOfFastifyError) {
      console.error('actualPathOfFastifyError', actualPathOfFastifyError)
      console.error('expectedPathOfFastifyError', expectedPathOfFastifyError)
      throw new Error('fastify-error should be required from the node_modules directory of dep')
    }
    
    const Boom = createError('Boom', 'Boom', 500)
    const ChildBoom = createError('ChildBoom', 'Boom', 500, Boom)

    module.exports.foo = function foo () {
        throw new ChildBoom('foo go Boom')
    }
    `)

  const finishedPromise = {
    promise: undefined,
    reject: undefined,
    resolve: undefined,
  }

  finishedPromise.promise = new Promise((resolve, reject) => {
    finishedPromise.resolve = resolve
    finishedPromise.reject = reject
  })

  const child = cp.fork(path.resolve(testCwd, 'index.js'), {
    cwd: testCwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '--no-warnings'
    },
  })

  let messageCount = 0
  child.on('message', message => {
    try {
      switch (messageCount) {
        case 0:
          t.assert.strictEqual(message, true, 'instanceof Error')
          break
        case 1:
          t.assert.strictEqual(message, true, 'instanceof FastifyError')
          break
        case 2:
          t.assert.strictEqual(message, false, 'instanceof NotChildBoom')
          break
        case 3:
          t.assert.strictEqual(message, true, 'instanceof Boom')
          break
        case 4:
          t.assert.strictEqual(message, true, 'instanceof ChildBoom')
          break
      }
      if (++messageCount === assertsPlanned) {
        finishedPromise.resolve()
      }
    } catch (err) {
      finishedPromise.reject(err)
    }
  })

  child.on('error', err => {
    finishedPromise.reject(err)
  })

  await finishedPromise.promise

  // Cleanup
  // As we are creating the test-setup on the fly in the /tmp directory, we can remove it
  // safely when we are done. It is not relevant for the test if the deletion fails.
  try {
    fs.rmSync(testCwd, { recursive: true, force: true })
  } catch {}
})
