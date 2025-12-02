// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License

import { ErrorTracking as CoreErrorTracking } from '@posthog/core'
import { posix, sep, dirname } from 'path'

export function createModulerModifier() {
  const getModuleFromFileName = createGetModuleFromFilename()
  return async (frames: CoreErrorTracking.StackFrame[]): Promise<CoreErrorTracking.StackFrame[]> => {
    for (const frame of frames) {
      frame.module = getModuleFromFileName(frame.filename)
    }
    return frames
  }
}

/** Creates a function that gets the module name from a filename */
function createGetModuleFromFilename(
  basePath: string = process.argv[1] ? dirname(process.argv[1]) : process.cwd(),
  isWindows: boolean = sep === '\\'
): (filename: string | undefined) => string | undefined {
  const normalizedBase = isWindows ? normalizeWindowsPath(basePath) : basePath

  return (filename: string | undefined) => {
    if (!filename) {
      return
    }

    const normalizedFilename = isWindows ? normalizeWindowsPath(filename) : filename

    // eslint-disable-next-line prefer-const
    let { dir, base: file, ext } = posix.parse(normalizedFilename)

    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      file = file.slice(0, ext.length * -1)
    }

    // The file name might be URI-encoded which we want to decode to
    // the original file name.
    const decodedFile = decodeURIComponent(file)

    if (!dir) {
      // No dirname whatsoever
      dir = '.'
    }

    const n = dir.lastIndexOf('/node_modules')
    if (n > -1) {
      return `${dir.slice(n + 14).replace(/\//g, '.')}:${decodedFile}`
    }

    // Let's see if it's a part of the main module
    // To be a part of main module, it has to share the same base
    if (dir.startsWith(normalizedBase)) {
      const moduleName = dir.slice(normalizedBase.length + 1).replace(/\//g, '.')
      return moduleName ? `${moduleName}:${decodedFile}` : decodedFile
    }

    return decodedFile
  }
}

/** normalizes Windows paths */
function normalizeWindowsPath(path: string): string {
  return path
    .replace(/^[A-Z]:/, '') // remove Windows-style prefix
    .replace(/\\/g, '/') // replace all `\` instances with `/`
}
