// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License

import { ErrorTracking as CoreErrorTracking } from '@posthog/core'

type ErrorHandler = { _posthogErrorHandler: boolean } & ((error: Error) => void)

function makeUncaughtExceptionHandler(
  captureFn: (exception: Error, hint: CoreErrorTracking.EventHint) => void,
  onFatalFn: (exception: Error) => void
): ErrorHandler {
  let calledFatalError: boolean = false

  return Object.assign(
    (error: Error): void => {
      // Attaching a listener to `uncaughtException` will prevent the node process from exiting. We generally do not
      // want to alter this behaviour so we check for other listeners that users may have attached themselves and adjust
      // exit behaviour of the SDK accordingly:
      // - If other listeners are attached, do not exit.
      // - If the only listener attached is ours, exit.
      const userProvidedListenersCount = global.process.listeners('uncaughtException').filter((listener) => {
        // There are 2 listeners we ignore:
        return (
          // as soon as we're using domains this listener is attached by node itself
          listener.name !== 'domainUncaughtExceptionClear' &&
          // the handler we register in this integration
          (listener as ErrorHandler)._posthogErrorHandler !== true
        )
      }).length

      const processWouldExit = userProvidedListenersCount === 0

      captureFn(error, {
        mechanism: {
          type: 'onuncaughtexception',
          handled: false,
        },
      })

      if (!calledFatalError && processWouldExit) {
        calledFatalError = true
        onFatalFn(error)
      }
    },
    { _posthogErrorHandler: true }
  )
}

export function addUncaughtExceptionListener(
  captureFn: (exception: Error, hint: CoreErrorTracking.EventHint) => void,
  onFatalFn: (exception: Error) => void
): void {
  global.process.on('uncaughtException', makeUncaughtExceptionHandler(captureFn, onFatalFn))
}

export function addUnhandledRejectionListener(
  captureFn: (exception: unknown, hint: CoreErrorTracking.EventHint) => void
): void {
  global.process.on('unhandledRejection', (reason: unknown) => {
    return captureFn(reason, {
      mechanism: {
        type: 'onunhandledrejection',
        handled: false,
      },
    })
  })
}
