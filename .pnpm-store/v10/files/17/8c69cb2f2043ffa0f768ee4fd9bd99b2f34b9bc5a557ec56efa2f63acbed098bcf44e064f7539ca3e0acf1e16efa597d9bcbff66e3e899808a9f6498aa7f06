import { Logger } from '../types'
import { isNumber } from './type-utils'

/**
 * Clamps a value to a range.
 * @param value the value to clamp
 * @param min the minimum value
 * @param max the maximum value
 * @param label if provided then enables logging and prefixes all logs with labels
 * @param fallbackValue if provided then returns this value if the value is not a valid number
 */
export function clampToRange(value: unknown, min: number, max: number, logger: Logger, fallbackValue?: number): number {
  if (min > max) {
    logger.warn('min cannot be greater than max.')
    min = max
  }

  if (!isNumber(value)) {
    logger.warn(' must be a number. using max or fallback. max: ' + max + ', fallback: ' + fallbackValue)
    return clampToRange(fallbackValue || max, min, max, logger)
  } else if (value > max) {
    logger.warn(' cannot be  greater than max: ' + max + '. Using max value instead.')
    return max
  } else if (value < min) {
    logger.warn(' cannot be less than min: ' + min + '. Using min value instead.')
    return min
  } else {
    return value
  }
}
