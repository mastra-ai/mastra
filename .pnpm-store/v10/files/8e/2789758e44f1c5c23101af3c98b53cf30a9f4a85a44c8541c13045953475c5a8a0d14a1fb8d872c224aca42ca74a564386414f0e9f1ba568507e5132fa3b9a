import { StackLineParser } from '../types'
import { createFrame, UNKNOWN_FUNCTION } from './base'

const opera10Regex = / line (\d+).*script (?:in )?(\S+)(?:: in function (\S+))?$/i

export const opera10StackLineParser: StackLineParser = (line) => {
  const parts = opera10Regex.exec(line) as null | [string, string, string, string]
  return parts ? createFrame(parts[2], parts[3] || UNKNOWN_FUNCTION, +parts[1]) : undefined
}

// export const opera10StackLineParser: StackLineParser = [OPERA10_PRIORITY, opera10]

const opera11Regex = / line (\d+), column (\d+)\s*(?:in (?:<anonymous function: ([^>]+)>|([^)]+))\(.*\))? in (.*):\s*$/i

export const opera11StackLineParser: StackLineParser = (line) => {
  const parts = opera11Regex.exec(line) as null | [string, string, string, string, string, string]
  return parts ? createFrame(parts[5], parts[3] || parts[4] || UNKNOWN_FUNCTION, +parts[1], +parts[2]) : undefined
}
