// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License

import type { StackParser } from './types'

type StackString = string
type CachedResult = [string, string]

type ChunkIdMapType = Record<string, string>

let parsedStackResults: Record<StackString, CachedResult> | undefined
let lastKeysCount: number | undefined
let cachedFilenameChunkIds: ChunkIdMapType | undefined

export function getFilenameToChunkIdMap(stackParser: StackParser): ChunkIdMapType | undefined {
  const chunkIdMap = (globalThis as any)._posthogChunkIds as ChunkIdMapType | undefined
  if (!chunkIdMap) {
    return undefined
  }

  const chunkIdKeys = Object.keys(chunkIdMap)

  if (cachedFilenameChunkIds && chunkIdKeys.length === lastKeysCount) {
    return cachedFilenameChunkIds
  }

  lastKeysCount = chunkIdKeys.length

  cachedFilenameChunkIds = chunkIdKeys.reduce<Record<string, string>>((acc, stackKey) => {
    if (!parsedStackResults) {
      parsedStackResults = {}
    }

    const result = parsedStackResults[stackKey]

    if (result) {
      acc[result[0]] = result[1]
    } else {
      const parsedStack = stackParser(stackKey)

      for (let i = parsedStack.length - 1; i >= 0; i--) {
        const stackFrame = parsedStack[i]
        const filename = stackFrame?.filename
        const chunkId = chunkIdMap[stackKey]

        if (filename && chunkId) {
          acc[filename] = chunkId
          parsedStackResults[stackKey] = [filename, chunkId]
          break
        }
      }
    }

    return acc
  }, {})

  return cachedFilenameChunkIds
}
