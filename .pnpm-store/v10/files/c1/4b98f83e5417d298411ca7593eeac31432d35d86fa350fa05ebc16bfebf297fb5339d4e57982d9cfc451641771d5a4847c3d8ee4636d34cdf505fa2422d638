import { isEvent } from '@/utils'
import { CoercingContext, ErrorTrackingCoercer, ExceptionLike } from '../types'
import { extractExceptionKeysForMessage } from './utils'

export class EventCoercer implements ErrorTrackingCoercer<Event> {
  match(err: unknown): err is Event {
    return isEvent(err)
  }

  coerce(evt: Event, ctx: CoercingContext): ExceptionLike {
    const constructorName = evt.constructor.name
    return {
      type: constructorName,
      value: `${constructorName} captured as exception with keys: ${extractExceptionKeysForMessage(evt)}`,
      stack: ctx.syntheticException?.stack,
      synthetic: true,
    }
  }
}
