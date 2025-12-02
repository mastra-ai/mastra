// This regex matches frames that have no function name (ie. are at the top level of a module).
// For example "at http://localhost:5000//script.js:1:126"

import { StackLineParser } from '../types'
import { createFrame, UNKNOWN_FUNCTION } from './base'
import { extractSafariExtensionDetails } from './safari'

// Frames _with_ function names usually look as follows: "at commitLayoutEffects (react-dom.development.js:23426:1)"
const chromeRegexNoFnName = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i

// This regex matches all the frames that have a function name.
const chromeRegex =
  /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i

const chromeEvalRegex = /\((\S*)(?::(\d+))(?::(\d+))\)/

// Chromium based browsers: Chrome, Brave, new Opera, new Edge
// We cannot call this variable `chrome` because it can conflict with global `chrome` variable in certain environments
// See: https://github.com/getsentry/sentry-javascript/issues/6880
export const chromeStackLineParser: StackLineParser = (line) => {
  // If the stack line has no function name, we need to parse it differently
  const noFnParts = chromeRegexNoFnName.exec(line) as null | [string, string, string, string]

  if (noFnParts) {
    const [, filename, line, col] = noFnParts
    return createFrame(filename, UNKNOWN_FUNCTION, +line, +col)
  }

  const parts = chromeRegex.exec(line) as null | [string, string, string, string, string]

  if (parts) {
    const isEval = parts[2] && parts[2].indexOf('eval') === 0 // start of line

    if (isEval) {
      const subMatch = chromeEvalRegex.exec(parts[2]) as null | [string, string, string, string]

      if (subMatch) {
        // throw out eval line/column and use top-most line/column number
        parts[2] = subMatch[1] // url
        parts[3] = subMatch[2] // line
        parts[4] = subMatch[3] // column
      }
    }

    // Kamil: One more hack won't hurt us right? Understanding and adding more rules on top of these regexps right now
    // would be way too time consuming. (TODO: Rewrite whole RegExp to be more readable)
    const [func, filename] = extractSafariExtensionDetails(parts[1] || UNKNOWN_FUNCTION, parts[2])

    return createFrame(filename, func, parts[3] ? +parts[3] : undefined, parts[4] ? +parts[4] : undefined)
  }

  return
}
