import { isBuiltin, isPrimitive } from '@/utils'
import { CoercingContext, ErrorTrackingCoercer, ExceptionLike } from '../types'

// Web only
export class PromiseRejectionEventCoercer implements ErrorTrackingCoercer<PromiseRejectionEvent> {
  match(err: unknown): err is PromiseRejectionEvent {
    return isBuiltin(err, 'PromiseRejectionEvent')
  }

  coerce(err: PromiseRejectionEvent, ctx: CoercingContext): ExceptionLike | undefined {
    const reason = this.getUnhandledRejectionReason(err)
    if (isPrimitive(reason)) {
      return {
        type: 'UnhandledRejection',
        value: `Non-Error promise rejection captured with value: ${String(reason)}`,
        stack: ctx.syntheticException?.stack,
        synthetic: true,
      }
    } else {
      return ctx.apply(reason)
    }
  }

  private getUnhandledRejectionReason(error: unknown): unknown {
    if (isPrimitive(error)) {
      return error
    }

    // dig the object of the rejection out of known event types
    try {
      type ErrorWithReason = { reason: unknown }
      // PromiseRejectionEvents store the object of the rejection under 'reason'
      // see https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
      if ('reason' in (error as ErrorWithReason)) {
        return (error as ErrorWithReason).reason
      }

      type CustomEventWithDetail = { detail: { reason: unknown } }
      // something, somewhere, (likely a browser extension) effectively casts PromiseRejectionEvents
      // to CustomEvents, moving the `promise` and `reason` attributes of the PRE into
      // the CustomEvent's `detail` attribute, since they're not part of CustomEvent's spec
      // see https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent and
      // https://github.com/getsentry/sentry-javascript/issues/2380
      if ('detail' in (error as CustomEventWithDetail) && 'reason' in (error as CustomEventWithDetail).detail) {
        return (error as CustomEventWithDetail).detail.reason
      }
    } catch {
      // no-empty
    }

    return error
  }
}
