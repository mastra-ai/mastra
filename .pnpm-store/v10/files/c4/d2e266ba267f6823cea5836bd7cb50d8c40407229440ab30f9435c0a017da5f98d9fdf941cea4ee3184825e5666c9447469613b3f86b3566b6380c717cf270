import { CoercingContext, ErrorTrackingCoercer, ExceptionLike } from '@/error-tracking/types'
import { isBuiltin, isString } from '@/utils'

export class DOMExceptionCoercer implements ErrorTrackingCoercer<DOMException> {
  match(err: unknown): err is DOMException {
    return this.isDOMException(err) || this.isDOMError(err)
  }

  coerce(err: DOMException, ctx: CoercingContext): ExceptionLike {
    const hasStack = isString(err.stack)

    return {
      type: this.getType(err),
      value: this.getValue(err),
      stack: hasStack ? err.stack : undefined,
      cause: err.cause ? ctx.next(err.cause) : undefined,
      synthetic: false,
    }
  }

  private getType(candidate: DOMException) {
    return this.isDOMError(candidate) ? 'DOMError' : 'DOMException'
  }

  private getValue(err: DOMException) {
    const name = err.name || (this.isDOMError(err) ? 'DOMError' : 'DOMException')
    const message = err.message ? `${name}: ${err.message}` : name
    return message
  }

  private isDOMException(err: unknown): err is DOMException {
    return isBuiltin(err, 'DOMException')
  }

  private isDOMError(err: unknown): err is DOMException {
    return isBuiltin(err, 'DOMError')
  }
}
