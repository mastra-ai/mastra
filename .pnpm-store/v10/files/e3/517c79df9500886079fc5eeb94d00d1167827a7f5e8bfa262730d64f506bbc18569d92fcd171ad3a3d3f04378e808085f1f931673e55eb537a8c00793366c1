'use strict'

const { format } = require('node:util')

function toString () {
  return `${this.name} [${this.code}]: ${this.message}`
}

const FastifyGenericErrorSymbol = Symbol.for('fastify-error-generic')

function createError (code, message, statusCode = 500, Base = Error, captureStackTrace = createError.captureStackTrace) {
  const shouldCreateFastifyGenericError = code === FastifyGenericErrorSymbol

  if (shouldCreateFastifyGenericError) {
    code = 'FST_ERR'
  }

  if (!code) throw new Error('Fastify error code must not be empty')
  if (!message) throw new Error('Fastify error message must not be empty')

  code = code.toUpperCase()
  !statusCode && (statusCode = undefined)

  const FastifySpecificErrorSymbol = Symbol.for(`fastify-error ${code}`)

  function FastifyError (...args) {
    if (!new.target) {
      return new FastifyError(...args)
    }

    this.code = code
    this.name = 'FastifyError'
    this.statusCode = statusCode

    const lastElement = args.length - 1
    if (lastElement !== -1 && args[lastElement] && typeof args[lastElement] === 'object' && 'cause' in args[lastElement]) {
      this.cause = args.pop().cause
    }

    this.message = format(message, ...args)

    Error.stackTraceLimit && captureStackTrace && Error.captureStackTrace(this, FastifyError)
  }

  FastifyError.prototype = Object.create(Base.prototype, {
    constructor: {
      value: FastifyError,
      enumerable: false,
      writable: true,
      configurable: true
    },
    [FastifyGenericErrorSymbol]: {
      value: true,
      enumerable: false,
      writable: false,
      configurable: false
    },
    [FastifySpecificErrorSymbol]: {
      value: true,
      enumerable: false,
      writable: false,
      configurable: false
    }
  })

  if (shouldCreateFastifyGenericError) {
    Object.defineProperty(FastifyError, Symbol.hasInstance, {
      value (instance) {
        return instance && instance[FastifyGenericErrorSymbol]
      },
      configurable: false,
      writable: false,
      enumerable: false
    })
  } else {
    Object.defineProperty(FastifyError, Symbol.hasInstance, {
      value (instance) {
        return instance && instance[FastifySpecificErrorSymbol]
      },
      configurable: false,
      writable: false,
      enumerable: false
    })
  }

  FastifyError.prototype[Symbol.toStringTag] = 'Error'

  FastifyError.prototype.toString = toString

  return FastifyError
}

createError.captureStackTrace = true

const FastifyErrorConstructor = createError(FastifyGenericErrorSymbol, 'Fastify Error', 500, Error)

module.exports = createError
module.exports.FastifyError = FastifyErrorConstructor
module.exports.default = createError
module.exports.createError = createError
