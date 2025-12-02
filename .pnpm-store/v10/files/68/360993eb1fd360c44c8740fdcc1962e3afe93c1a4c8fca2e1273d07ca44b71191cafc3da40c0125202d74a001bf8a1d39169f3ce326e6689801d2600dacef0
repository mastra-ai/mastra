import spawn, { SubprocessError } from 'nano-spawn'

import { createDebug } from './debug.js'

const debugLog = createDebug('lint-staged:execGit')

/**
 * Explicitly never recurse commands into submodules, overriding local/global configuration.
 * @see https://git-scm.com/docs/git-config#Documentation/git-config.txt-submodulerecurse
 */
const NO_SUBMODULE_RECURSE = ['-c', 'submodule.recurse=false']

// exported for tests
export const GIT_GLOBAL_OPTIONS = [...NO_SUBMODULE_RECURSE]

/** @type {(cmd: string[], options?: import('nano-spawn').Options) => Promise<string>} */
export const execGit = async (cmd, options) => {
  debugLog('Running git command', cmd)
  try {
    const result = await spawn('git', [...NO_SUBMODULE_RECURSE, ...cmd], {
      ...options,
      cwd: options?.cwd ?? process.cwd(),
      stdin: 'ignore',
    })

    return result.stdout
  } catch (error) {
    if (error instanceof SubprocessError) {
      throw new Error(error.output, { cause: error })
    }

    throw error
  }
}
