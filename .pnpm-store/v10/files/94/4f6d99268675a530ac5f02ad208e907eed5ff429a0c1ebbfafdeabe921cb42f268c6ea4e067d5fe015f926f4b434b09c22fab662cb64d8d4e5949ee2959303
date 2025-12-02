import { isPlainError } from '@/utils'
import { CoercingContext, ErrorTrackingCoercer, ExceptionLike } from '../types'

export class ErrorCoercer implements ErrorTrackingCoercer<Error> {
  match(err: unknown): err is Error {
    return isPlainError(err)
  }

  coerce(err: Error, ctx: CoercingContext): ExceptionLike {
    return {
      type: this.getType(err),
      value: this.getMessage(err, ctx),
      stack: this.getStack(err),
      cause: err.cause ? ctx.next(err.cause) : undefined,
      synthetic: false,
    }
  }

  private getType(err: Error): string {
    return err.name || err.constructor.name
  }

  private getMessage(err: Error & { message: { error?: Error } }, _ctx: CoercingContext): string {
    const message = err.message

    if (message.error && typeof message.error.message === 'string') {
      return String(message.error.message)
    }

    return String(message)
  }

  private getStack(err: Error & { stacktrace?: string }): string | undefined {
    return err.stacktrace || err.stack || undefined
  }
}
