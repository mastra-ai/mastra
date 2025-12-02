import { CoercingContext, ErrorTrackingCoercer, ExceptionLike } from '../types'
import { isErrorEvent } from '@/utils'

export class ErrorEventCoercer implements ErrorTrackingCoercer<ErrorEvent> {
  constructor() {}

  match(err: unknown): err is ErrorEvent {
    return isErrorEvent(err) && (err as ErrorEvent).error != undefined
  }

  coerce(err: ErrorEvent, ctx: CoercingContext): ExceptionLike {
    const exceptionLike = ctx.apply(err.error)
    if (!exceptionLike) {
      return {
        type: 'ErrorEvent',
        value: err.message,
        stack: ctx.syntheticException?.stack,
        synthetic: true,
      }
    } else {
      return exceptionLike
    }
  }
}
