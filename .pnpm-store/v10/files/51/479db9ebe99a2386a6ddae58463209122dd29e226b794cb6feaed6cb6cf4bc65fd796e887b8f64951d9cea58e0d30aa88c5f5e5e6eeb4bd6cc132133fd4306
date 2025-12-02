// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License

import { ErrorTracking as CoreErrorTracking } from '@posthog/core'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const LRU_FILE_CONTENTS_CACHE = new CoreErrorTracking.ReduceableCache<string, Record<number, string>>(25)
const LRU_FILE_CONTENTS_FS_READ_FAILED = new CoreErrorTracking.ReduceableCache<string, 1>(20)
const DEFAULT_LINES_OF_CONTEXT = 7
// Determines the upper bound of lineno/colno that we will attempt to read. Large colno values are likely to be
// minified code while large lineno values are likely to be bundled code.
// Exported for testing purposes.
export const MAX_CONTEXTLINES_COLNO: number = 1000
export const MAX_CONTEXTLINES_LINENO: number = 10000

type ReadlineRange = [start: number, end: number]

export async function addSourceContext(
  frames: CoreErrorTracking.StackFrame[]
): Promise<CoreErrorTracking.StackFrame[]> {
  // keep a lookup map of which files we've already enqueued to read,
  // so we don't enqueue the same file multiple times which would cause multiple i/o reads
  const filesToLines: Record<string, number[]> = {}

  // Maps preserve insertion order, so we iterate in reverse, starting at the
  // outermost frame and closer to where the exception has occurred (poor mans priority)
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame: CoreErrorTracking.StackFrame | undefined = frames[i]
    const filename = frame?.filename

    if (
      !frame ||
      typeof filename !== 'string' ||
      typeof frame.lineno !== 'number' ||
      shouldSkipContextLinesForFile(filename) ||
      shouldSkipContextLinesForFrame(frame)
    ) {
      continue
    }

    const filesToLinesOutput = filesToLines[filename]
    if (!filesToLinesOutput) {
      filesToLines[filename] = []
    }
    filesToLines[filename].push(frame.lineno)
  }

  const files = Object.keys(filesToLines)
  if (files.length == 0) {
    return frames
  }

  const readlinePromises: Promise<void>[] = []
  for (const file of files) {
    // If we failed to read this before, dont try reading it again.
    if (LRU_FILE_CONTENTS_FS_READ_FAILED.get(file)) {
      continue
    }

    const filesToLineRanges = filesToLines[file]
    if (!filesToLineRanges) {
      continue
    }

    // Sort ranges so that they are sorted by line increasing order and match how the file is read.
    filesToLineRanges.sort((a, b) => a - b)
    // Check if the contents are already in the cache and if we can avoid reading the file again.
    const ranges = makeLineReaderRanges(filesToLineRanges)
    if (ranges.every((r) => rangeExistsInContentCache(file, r))) {
      continue
    }

    const cache = emplace(LRU_FILE_CONTENTS_CACHE, file, {})
    readlinePromises.push(getContextLinesFromFile(file, ranges, cache))
  }

  // The promise rejections are caught in order to prevent them from short circuiting Promise.all
  await Promise.all(readlinePromises).catch(() => {})

  // Perform the same loop as above, but this time we can assume all files are in the cache
  // and attempt to add source context to frames.
  if (frames && frames.length > 0) {
    addSourceContextToFrames(frames, LRU_FILE_CONTENTS_CACHE)
  }

  // Once we're finished processing an exception reduce the files held in the cache
  // so that we don't indefinetly increase the size of this map
  LRU_FILE_CONTENTS_CACHE.reduce()

  return frames
}

/**
 * Extracts lines from a file and stores them in a cache.
 */
function getContextLinesFromFile(path: string, ranges: ReadlineRange[], output: Record<number, string>): Promise<void> {
  return new Promise((resolve) => {
    // It is important *not* to have any async code between createInterface and the 'line' event listener
    // as it will cause the 'line' event to
    // be emitted before the listener is attached.
    const stream = createReadStream(path)
    const lineReaded = createInterface({
      input: stream,
    })

    // We need to explicitly destroy the stream to prevent memory leaks,
    // removing the listeners on the readline interface is not enough.
    // See: https://github.com/nodejs/node/issues/9002 and https://github.com/getsentry/sentry-javascript/issues/14892
    function destroyStreamAndResolve(): void {
      stream.destroy()
      resolve()
    }

    // Init at zero and increment at the start of the loop because lines are 1 indexed.
    let lineNumber = 0
    let currentRangeIndex = 0
    const range = ranges[currentRangeIndex]
    if (range === undefined) {
      // We should never reach this point, but if we do, we should resolve the promise to prevent it from hanging.
      destroyStreamAndResolve()
      return
    }
    let rangeStart = range[0]
    let rangeEnd = range[1]

    // We use this inside Promise.all, so we need to resolve the promise even if there is an error
    // to prevent Promise.all from short circuiting the rest.
    function onStreamError(): void {
      // Mark file path as failed to read and prevent multiple read attempts.
      LRU_FILE_CONTENTS_FS_READ_FAILED.set(path, 1)
      lineReaded.close()
      lineReaded.removeAllListeners()
      destroyStreamAndResolve()
    }

    // We need to handle the error event to prevent the process from crashing in < Node 16
    // https://github.com/nodejs/node/pull/31603
    stream.on('error', onStreamError)
    lineReaded.on('error', onStreamError)
    lineReaded.on('close', destroyStreamAndResolve)

    lineReaded.on('line', (line) => {
      lineNumber++
      if (lineNumber < rangeStart) {
        return
      }

      // !Warning: This mutates the cache by storing the snipped line into the cache.
      output[lineNumber] = snipLine(line, 0)

      if (lineNumber >= rangeEnd) {
        if (currentRangeIndex === ranges.length - 1) {
          // We need to close the file stream and remove listeners, else the reader will continue to run our listener;
          lineReaded.close()
          lineReaded.removeAllListeners()
          return
        }
        currentRangeIndex++
        const range = ranges[currentRangeIndex]
        if (range === undefined) {
          // This should never happen as it means we have a bug in the context.
          lineReaded.close()
          lineReaded.removeAllListeners()
          return
        }
        rangeStart = range[0]
        rangeEnd = range[1]
      }
    })
  })
}

/** Adds context lines to frames */
function addSourceContextToFrames(
  frames: CoreErrorTracking.StackFrame[],
  cache: CoreErrorTracking.ReduceableCache<string, Record<number, string>>
): void {
  for (const frame of frames) {
    // Only add context if we have a filename and it hasn't already been added
    if (frame.filename && frame.context_line === undefined && typeof frame.lineno === 'number') {
      const contents = cache.get(frame.filename)
      if (contents === undefined) {
        continue
      }

      addContextToFrame(frame.lineno, frame, contents)
    }
  }
}

/**
 * Resolves context lines before and after the given line number and appends them to the frame;
 */
function addContextToFrame(
  lineno: number,
  frame: CoreErrorTracking.StackFrame,
  contents: Record<number, string> | undefined
): void {
  // When there is no line number in the frame, attaching context is nonsensical and will even break grouping.
  // We already check for lineno before calling this, but since StackFrame lineno is optional, we check it again.
  if (frame.lineno === undefined || contents === undefined) {
    return
  }

  frame.pre_context = []
  for (let i = makeRangeStart(lineno); i < lineno; i++) {
    // We always expect the start context as line numbers cannot be negative. If we dont find a line, then
    // something went wrong somewhere. Clear the context and return without adding any linecontext.
    const line = contents[i]
    if (line === undefined) {
      clearLineContext(frame)
      return
    }

    frame.pre_context.push(line)
  }

  // We should always have the context line. If we dont, something went wrong, so we clear the context and return
  // without adding any linecontext.
  if (contents[lineno] === undefined) {
    clearLineContext(frame)
    return
  }

  frame.context_line = contents[lineno]

  const end = makeRangeEnd(lineno)
  frame.post_context = []
  for (let i = lineno + 1; i <= end; i++) {
    // Since we dont track when the file ends, we cant clear the context if we dont find a line as it could
    // just be that we reached the end of the file.
    const line = contents[i]
    if (line === undefined) {
      break
    }
    frame.post_context.push(line)
  }
}

/**
 * Clears the context lines from a frame, used to reset a frame to its original state
 * if we fail to resolve all context lines for it.
 */
function clearLineContext(frame: CoreErrorTracking.StackFrame): void {
  delete frame.pre_context
  delete frame.context_line
  delete frame.post_context
}

/**
 * Determines if context lines should be skipped for a file.
 * - .min.(mjs|cjs|js) files are and not useful since they dont point to the original source
 * - node: prefixed modules are part of the runtime and cannot be resolved to a file
 * - data: skip json, wasm and inline js https://nodejs.org/api/esm.html#data-imports
 */
function shouldSkipContextLinesForFile(path: string): boolean {
  // Test the most common prefix and extension first. These are the ones we
  // are most likely to see in user applications and are the ones we can break out of first.
  return (
    path.startsWith('node:') ||
    path.endsWith('.min.js') ||
    path.endsWith('.min.cjs') ||
    path.endsWith('.min.mjs') ||
    path.startsWith('data:')
  )
}

/**
 * Determines if we should skip contextlines based off the max lineno and colno values.
 */
function shouldSkipContextLinesForFrame(frame: CoreErrorTracking.StackFrame): boolean {
  if (frame.lineno !== undefined && frame.lineno > MAX_CONTEXTLINES_LINENO) {
    return true
  }
  if (frame.colno !== undefined && frame.colno > MAX_CONTEXTLINES_COLNO) {
    return true
  }
  return false
}

/**
 * Checks if we have all the contents that we need in the cache.
 */
function rangeExistsInContentCache(file: string, range: ReadlineRange): boolean {
  const contents = LRU_FILE_CONTENTS_CACHE.get(file)
  if (contents === undefined) {
    return false
  }

  for (let i = range[0]; i <= range[1]; i++) {
    if (contents[i] === undefined) {
      return false
    }
  }

  return true
}

/**
 * Creates contiguous ranges of lines to read from a file. In the case where context lines overlap,
 * the ranges are merged to create a single range.
 */
function makeLineReaderRanges(lines: number[]): ReadlineRange[] {
  if (!lines.length) {
    return []
  }

  let i = 0
  const line = lines[0]

  if (typeof line !== 'number') {
    return []
  }

  let current = makeContextRange(line)
  const out: ReadlineRange[] = []
  while (true) {
    if (i === lines.length - 1) {
      out.push(current)
      break
    }

    // If the next line falls into the current range, extend the current range to lineno + linecontext.
    const next = lines[i + 1]
    if (typeof next !== 'number') {
      break
    }
    if (next <= current[1]) {
      current[1] = next + DEFAULT_LINES_OF_CONTEXT
    } else {
      out.push(current)
      current = makeContextRange(next)
    }

    i++
  }

  return out
}
// Determine start and end indices for context range (inclusive);
function makeContextRange(line: number): [start: number, end: number] {
  return [makeRangeStart(line), makeRangeEnd(line)]
}
// Compute inclusive end context range
function makeRangeStart(line: number): number {
  return Math.max(1, line - DEFAULT_LINES_OF_CONTEXT)
}
// Compute inclusive start context range
function makeRangeEnd(line: number): number {
  return line + DEFAULT_LINES_OF_CONTEXT
}

/**
 * Get or init map value
 */
function emplace<T extends CoreErrorTracking.ReduceableCache<K, V>, K extends string, V>(
  map: T,
  key: K,
  contents: V
): V {
  const value = map.get(key)

  if (value === undefined) {
    map.set(key, contents)
    return contents
  }

  return value
}

function snipLine(line: string, colno: number): string {
  let newLine = line
  const lineLength = newLine.length
  if (lineLength <= 150) {
    return newLine
  }
  if (colno > lineLength) {
    colno = lineLength
  }

  let start = Math.max(colno - 60, 0)
  if (start < 5) {
    start = 0
  }

  let end = Math.min(start + 140, lineLength)
  if (end > lineLength - 5) {
    end = lineLength
  }
  if (end === lineLength) {
    start = Math.max(end - 140, 0)
  }

  newLine = newLine.slice(start, end)
  if (start > 0) {
    newLine = `...${newLine}`
  }
  if (end < lineLength) {
    newLine += '...'
  }

  return newLine
}
