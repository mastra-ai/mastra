import { isPrimitive } from '@/utils'
import { CoercingContext, ErrorTrackingCoercer, ExceptionLike } from '../types'

export type PrimitiveType = null | undefined | boolean | number | string | symbol | bigint

export class PrimitiveCoercer implements ErrorTrackingCoercer<PrimitiveType> {
  match(candidate: unknown): candidate is PrimitiveType {
    return isPrimitive(candidate)
  }

  coerce(value: PrimitiveType, ctx: CoercingContext): ExceptionLike | undefined {
    return {
      type: 'Error',
      value: `Primitive value captured as exception: ${String(value)}`,
      stack: ctx.syntheticException?.stack,
      synthetic: true,
    }
  }
}
