import { CoercingContext } from '../types'
import { PromiseRejectionEventCoercer } from './promise-rejection-event'

type PromiseRejectionEventTypes = 'rejectionhandled' | 'unhandledrejection'

type PromiseRejectionEventInit = {
  promise: Promise<any>
  reason: any
}

class PromiseRejectionEvent extends Event {
  public readonly promise: Promise<any>
  public readonly reason: any

  public constructor(type: PromiseRejectionEventTypes, options: PromiseRejectionEventInit) {
    super(type)

    this.promise = options.promise
    this.reason = options.reason
  }
}

describe('PromiseRejectionEventCoercer', () => {
  const coercer = new PromiseRejectionEventCoercer()

  it('should coerce event with reason is a primitive', () => {
    const pre = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve('wat'),
      reason: 'My house is on fire',
    })

    const ctx = {
      apply: jest.fn(() => ({
        type: 'MockType',
        value: 'MockValue',
        synthetic: true,
      })),
      next: jest.fn(),
    } as CoercingContext

    expect(coercer.coerce(pre, ctx)).toMatchObject({
      type: 'UnhandledRejection',
      value: 'Non-Error promise rejection captured with value: My house is on fire',
      synthetic: true,
    })
  })

  it('should coerce event with reason is an error', () => {
    class CustomTestError extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'CustomTestError'
      }
    }

    const pre = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve('wat'),
      reason: new CustomTestError('My house is on fire'),
    })

    const ctx = {
      apply: jest.fn((err: Error) => ({
        type: err.name,
        value: err.message,
        stack: err.stack,
        synthetic: false,
      })),
      next: jest.fn(),
    } as CoercingContext

    expect(coercer.coerce(pre, ctx)).toMatchObject({
      type: 'CustomTestError',
      value: 'My house is on fire',
      synthetic: false,
    })
  })
})
