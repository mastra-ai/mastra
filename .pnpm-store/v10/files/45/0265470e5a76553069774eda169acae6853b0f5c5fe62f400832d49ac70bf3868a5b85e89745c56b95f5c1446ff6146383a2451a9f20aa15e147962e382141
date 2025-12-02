// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License

// 💖 open source

// This was originally forked from https://github.com/csnover/TraceKit, and was largely
// re-written as part of raven - js.
//
// This code was later copied to the JavaScript mono - repo and further modified and
// refactored over the years.

// Copyright (c) 2013 Onur Can Cakmak onur.cakmak@gmail.com and all TraceKit contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this
// software and associated documentation files(the 'Software'), to deal in the Software
// without restriction, including without limitation the rights to use, copy, modify,
// merge, publish, distribute, sublicense, and / or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to the following
// conditions:
//
// The above copyright notice and this permission notice shall be included in all copies
// or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
// CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
// OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import { StackFrame, StackLineParser, StackParser } from '../types'
import { UNKNOWN_FUNCTION } from './base'
export { chromeStackLineParser } from './chrome'
export { winjsStackLineParser } from './winjs'
export { geckoStackLineParser } from './gecko'
export { opera10StackLineParser, opera11StackLineParser } from './opera'
export { nodeStackLineParser } from './node'

const WEBPACK_ERROR_REGEXP = /\(error: (.*)\)/
const STACKTRACE_FRAME_LIMIT = 50

export function reverseAndStripFrames(stack: ReadonlyArray<StackFrame>): StackFrame[] {
  if (!stack.length) {
    return []
  }

  const localStack = Array.from(stack)

  localStack.reverse()

  return localStack.slice(0, STACKTRACE_FRAME_LIMIT).map((frame) => ({
    ...frame,
    filename: frame.filename || getLastStackFrame(localStack).filename,
    function: frame.function || UNKNOWN_FUNCTION,
  }))
}

function getLastStackFrame(arr: StackFrame[]): StackFrame {
  return arr[arr.length - 1] || {}
}

export function createStackParser(...parsers: StackLineParser[]): StackParser {
  // const sortedParsers = parsers.sort((a, b) => a[0] - b[0]).map((p) => p[1])

  return (stack: string, skipFirstLines: number = 0): StackFrame[] => {
    const frames: StackFrame[] = []
    const lines = stack.split('\n')

    for (let i = skipFirstLines; i < lines.length; i++) {
      const line = lines[i] as string
      // Ignore lines over 1kb as they are unlikely to be stack frames.
      // Many of the regular expressions use backtracking which results in run time that increases exponentially with
      // input size. Huge strings can result in hangs/Denial of Service:
      // https://github.com/getsentry/sentry-javascript/issues/2286
      if (line.length > 1024) {
        continue
      }

      // https://github.com/getsentry/sentry-javascript/issues/5459
      // Remove webpack (error: *) wrappers
      const cleanedLine = WEBPACK_ERROR_REGEXP.test(line) ? line.replace(WEBPACK_ERROR_REGEXP, '$1') : line

      // https://github.com/getsentry/sentry-javascript/issues/7813
      // Skip Error: lines
      if (cleanedLine.match(/\S*Error: /)) {
        continue
      }

      for (const parser of parsers) {
        const frame = parser(cleanedLine)
        if (frame) {
          frames.push(frame)
          break
        }
      }

      if (frames.length >= STACKTRACE_FRAME_LIMIT) {
        break
      }
    }

    return reverseAndStripFrames(frames)
  }
}
