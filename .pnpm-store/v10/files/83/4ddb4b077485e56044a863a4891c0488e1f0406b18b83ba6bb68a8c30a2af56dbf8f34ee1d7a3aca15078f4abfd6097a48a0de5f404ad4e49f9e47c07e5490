import type * as http from 'node:http'
import { uuidv7 } from '@posthog/core'
import ErrorTracking from './error-tracking'
import { PostHogBackendClient } from '../client'
import { ErrorTracking as CoreErrorTracking } from '@posthog/core'

type ExpressMiddleware = (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void

type ExpressErrorMiddleware = (
  error: MiddlewareError,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  next: (error: MiddlewareError) => void
) => void

interface MiddlewareError extends Error {
  status?: number | string
  statusCode?: number | string
  status_code?: number | string
  output?: {
    statusCode?: number | string
  }
}

export function setupExpressErrorHandler(
  _posthog: PostHogBackendClient,
  app: {
    use: (middleware: ExpressMiddleware | ExpressErrorMiddleware) => unknown
  }
): void {
  app.use((error: MiddlewareError, _, __, next: (error: MiddlewareError) => void): void => {
    const hint: CoreErrorTracking.EventHint = { mechanism: { type: 'middleware', handled: false } }
    // Given stateless nature of Node SDK we capture exceptions using personless processing
    // when no user can be determined e.g. in the case of exception autocapture
    ErrorTracking.buildEventMessage(error, hint, uuidv7(), { $process_person_profile: false }).then((msg) =>
      _posthog.capture(msg)
    )
    next(error)
  })
}
