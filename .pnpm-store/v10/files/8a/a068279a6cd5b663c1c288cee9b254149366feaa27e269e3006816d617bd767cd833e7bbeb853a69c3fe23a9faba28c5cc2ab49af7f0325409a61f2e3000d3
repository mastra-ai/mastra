import path from 'node:path'

import micromatch from 'micromatch'

import { createDebug } from './debug.js'
import { normalizePath } from './normalizePath.js'

const debugLog = createDebug('lint-staged:generateTasks')

/**
 * Generates all task commands, and filelist
 *
 * @param {object} options
 * @param {Object} [options.config] - Task configuration
 * @param {Object} [options.cwd] - Current working directory
 * @param {import('./getStagedFiles.js').StagedFile[]} [options.files] - Staged filepaths
 * @param {boolean} [options.relative] - Whether filepaths to should be relative to cwd
 */
export const generateTasks = ({ config, cwd = process.cwd(), files, relative = false }) => {
  debugLog('Generating linter tasks')

  /** @type {StagedFile[]} */
  const relativeFiles = files.map((file) => ({
    filepath: normalizePath(path.relative(cwd, file.filepath)),
    status: file.status,
  }))

  return Object.entries(config).map(([pattern, commands]) => {
    const isParentDirPattern = pattern.startsWith('../')

    // Only worry about children of the CWD unless the pattern explicitly
    // specifies that it concerns a parent directory.
    const filteredFiles = relativeFiles.filter((file) => {
      if (isParentDirPattern) return true
      return !file.filepath.startsWith('..') && !path.isAbsolute(file.filepath)
    })

    const matches = micromatch(
      filteredFiles.map((file) => file.filepath),
      pattern,
      {
        cwd,
        dot: true,
        // If the pattern doesn't look like a path, enable `matchBase` to
        // match against filenames in every directory. This makes `*.js`
        // match both `test.js` and `subdirectory/test.js`.
        matchBase: !pattern.includes('/'),
        posixSlashes: true,
        strictBrackets: true,
      }
    )

    const fileList = filteredFiles.flatMap((file) =>
      matches.includes(file.filepath)
        ? [
            {
              filepath: normalizePath(relative ? file.filepath : path.resolve(cwd, file.filepath)),
              status: file.status,
            },
          ]
        : []
    )

    const task = { pattern, commands, fileList }
    debugLog('Generated task: \n%O', task)

    return task
  })
}
