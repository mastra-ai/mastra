// gecko regex: `(?:bundle|\d+\.js)`: `bundle` is for react native, `\d+\.js` also but specifically for ram bundles because it
// generates filenames without a prefix like `file://` the filenames in the stacktrace are just 42.js

import { StackLineParser } from '../types'
import { createFrame, UNKNOWN_FUNCTION } from './base'
import { extractSafariExtensionDetails } from './safari'

// We need this specific case for now because we want no other regex to match.
const geckoREgex =
  /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i
const geckoEvalRegex = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i

export const geckoStackLineParser: StackLineParser = (line) => {
  const parts = geckoREgex.exec(line) as null | [string, string, string, string, string, string]

  if (parts) {
    const isEval = parts[3] && parts[3].indexOf(' > eval') > -1
    if (isEval) {
      const subMatch = geckoEvalRegex.exec(parts[3]) as null | [string, string, string]

      if (subMatch) {
        // throw out eval line/column and use top-most line number
        parts[1] = parts[1] || 'eval'
        parts[3] = subMatch[1]
        parts[4] = subMatch[2]
        parts[5] = '' // no column when eval
      }
    }

    let filename = parts[3]
    let func = parts[1] || UNKNOWN_FUNCTION
    ;[func, filename] = extractSafariExtensionDetails(func, filename)

    return createFrame(filename, func, parts[4] ? +parts[4] : undefined, parts[5] ? +parts[5] : undefined)
  }

  return
}
