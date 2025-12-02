import { Logger } from './types'

// We want to make sure to get the original console methods as soon as possible
type ConsoleLike = {
  log: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
  debug: (...args: any[]) => void
}

function createConsole(consoleLike: ConsoleLike = console): ConsoleLike {
  const lockedMethods = {
    log: consoleLike.log.bind(consoleLike),
    warn: consoleLike.warn.bind(consoleLike),
    error: consoleLike.error.bind(consoleLike),
    debug: consoleLike.debug.bind(consoleLike),
  }
  return lockedMethods
}

export const _createLogger = (
  prefix: string,
  maybeCall: (fn: () => void) => void,
  consoleLike: ConsoleLike
): Logger => {
  function _log(level: 'log' | 'warn' | 'error', ...args: any[]) {
    maybeCall(() => {
      const consoleMethod = consoleLike[level]
      consoleMethod(prefix, ...args)
    })
  }

  const logger: Logger = {
    info: (...args: any[]) => {
      _log('log', ...args)
    },

    warn: (...args: any[]) => {
      _log('warn', ...args)
    },

    error: (...args: any[]) => {
      _log('error', ...args)
    },

    critical: (...args: any[]) => {
      // Critical errors are always logged to the console
      consoleLike['error'](prefix, ...args)
    },

    createLogger: (additionalPrefix: string) => _createLogger(`${prefix} ${additionalPrefix}`, maybeCall, consoleLike),
  }
  return logger
}

export function createLogger(prefix: string, maybeCall: (fn: () => void) => void) {
  return _createLogger(prefix, maybeCall, createConsole())
}
