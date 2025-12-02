import { DOMExceptionCoercer, ErrorEventCoercer, ErrorCoercer, ObjectCoercer, StringCoercer } from './coercers'
import { PrimitiveCoercer } from './coercers/primitive-coercer'
import { PromiseRejectionEventCoercer } from './coercers/promise-rejection-event'
import { ErrorPropertiesBuilder } from './error-properties-builder'
import { ExceptionLike } from './types'

describe('ErrorPropertiesBuilder', () => {
  describe('coerceUnknown', () => {
    class CustomTestError extends Error {
      constructor(message: string, cause?: unknown) {
        super(message)
        this.name = 'CustomTestError'
        this.cause = cause
      }
    }

    const errorPropertiesBuilder = new ErrorPropertiesBuilder(
      [
        new DOMExceptionCoercer(),
        new ErrorEventCoercer(),
        new ErrorCoercer(),
        new PromiseRejectionEventCoercer(),
        new ObjectCoercer(),
        new StringCoercer(),
        new PrimitiveCoercer(),
      ],
      [],
      []
    )

    function coerceInput(input: unknown, error: Error = new Error()): ExceptionLike | undefined {
      const coercingContext = errorPropertiesBuilder.buildCoercingContext(
        { handled: false },
        {
          syntheticException: error,
        }
      )
      return coercingContext.apply(input)
    }

    it('should handle null values', async () => {
      const syntheticError = new Error()
      const exception = coerceInput(null, syntheticError)
      expect(exception).toMatchObject({
        type: 'Error',
        value: 'Primitive value captured as exception: null',
        stack: syntheticError.stack,
      })
    })

    it('should handle string', () => {
      const syntheticError = new Error()
      const exception = coerceInput('test', syntheticError)
      expect(exception).toMatchObject({
        type: 'Error',
        value: 'test',
        stack: syntheticError.stack,
      })
    })

    it('should handle exception string', () => {
      const syntheticError = new Error()
      const exception = coerceInput('Uncaught exception: InternalError: but somehow still a string', syntheticError)
      expect(exception).toMatchObject({
        type: 'InternalError',
        value: 'but somehow still a string',
        stack: syntheticError.stack,
      })
    })

    it('should use keys in objects', async () => {
      const syntheticError = new Error()
      const errorObject = { foo: 'Foo value', bar: 'Bar value' }
      const exception = coerceInput(errorObject, syntheticError)
      expect(exception).toMatchObject({
        type: 'Error',
        value: 'Object captured as exception with keys: bar, foo',
        stack: syntheticError.stack,
      })
    })

    it('should handle object with an error property', () => {
      const nestedError = new CustomTestError('My special error')
      const errorObject = { error: nestedError }
      const syntheticError = new Error()
      const exception = coerceInput(errorObject, syntheticError)
      expect(exception).toMatchObject({
        type: 'CustomTestError',
        value: 'My special error',
        stack: nestedError.stack,
      })
    })

    it('should handle error', () => {
      const errorObject = new CustomTestError('My special error')
      const exception = coerceInput(errorObject)
      expect(exception).toMatchObject({
        type: 'CustomTestError',
        value: 'My special error',
        stack: errorObject.stack,
      })
    })

    it('should handle error with error cause', () => {
      const secondError = new CustomTestError('My original error')
      const firstError = new CustomTestError('My wrapped error', secondError)
      const exception = coerceInput(firstError)
      expect(exception).toMatchObject({
        type: 'CustomTestError',
        value: 'My wrapped error',
        stack: firstError.stack,
        cause: {
          type: 'CustomTestError',
          value: 'My original error',
          stack: secondError.stack,
        },
      })
    })

    it('should handle error with object cause', () => {
      const originalCause = { foo: 'bar', test: 'test' }
      const kaboomError = new CustomTestError('Front error', originalCause)
      const syntheticError = new Error()
      const exception = coerceInput(kaboomError, syntheticError)
      expect(exception).toMatchObject({
        type: 'CustomTestError',
        value: 'Front error',
        stack: kaboomError.stack,
        cause: {
          type: 'Error',
          value: 'Object captured as exception with keys: foo, test',
          // Do we want to use the stack from the synthetic error?
          stack: undefined,
        },
      })
    })

    it('should handle error with string cause', () => {
      const originalCause = 'My original error'
      const kaboomError = new CustomTestError('Front error', originalCause)
      const syntheticError = new Error()
      const exception = coerceInput(kaboomError, syntheticError)
      expect(exception).toMatchObject({
        type: 'CustomTestError',
        value: 'Front error',
        stack: kaboomError.stack,
        cause: {
          type: 'Error',
          value: 'My original error',
          // Do we want to use the stack from the synthetic error?
          stack: undefined,
        },
      })
    })

    it('should convert a plain Event to an error', () => {
      class MouseEvent extends Event {
        constructor(type: string, eventInitDict?: EventInit) {
          super(type, eventInitDict)
        }
      }
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })
      const syntheticError = new Error()
      const exception = coerceInput(event, syntheticError)
      expect(exception).toMatchObject({
        type: 'MouseEvent',
        value: "'MouseEvent' captured as exception with keys: [object has no keys]",
        stack: syntheticError.stack,
        synthetic: true,
      })
    })

    it('should convert a DOM Error to an error', () => {
      class FakeDomError {
        constructor(
          public name: string,
          public message: string
        ) {}
        [Symbol.toStringTag] = 'DOMError'
      }
      const event = new FakeDomError('click', 'foo')
      const exception = coerceInput(event)
      expect(exception).toMatchObject({
        type: 'DOMError',
        value: 'click: foo',
        stack: undefined,
        synthetic: false,
      })
    })

    it('should convert a DOM Exception to an error', () => {
      const event = new DOMException('oh no disaster', 'dom-exception')
      const exception = coerceInput(event)
      expect(exception).toBeDefined()
      expect(exception).toMatchObject({
        type: 'DOMException',
        value: 'dom-exception: oh no disaster',
        synthetic: false,
      })
    })
  })
})
