import { StackLineParser } from '../types'
import { createFrame, UNKNOWN_FUNCTION } from './base'

const winjsRegex = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:[-a-z]+):.*?):(\d+)(?::(\d+))?\)?\s*$/i

export const winjsStackLineParser: StackLineParser = (line) => {
  const parts = winjsRegex.exec(line) as null | [string, string, string, string, string]

  return parts
    ? createFrame(parts[2], parts[1] || UNKNOWN_FUNCTION, +parts[3], parts[4] ? +parts[4] : undefined)
    : undefined
}
