export * from '../exports'

import ErrorTracking from '../extensions/error-tracking'
import { PostHogBackendClient } from '../client'
import { ErrorTracking as CoreErrorTracking } from '@posthog/core'

ErrorTracking.errorPropertiesBuilder = new CoreErrorTracking.ErrorPropertiesBuilder(
  [
    new CoreErrorTracking.EventCoercer(),
    new CoreErrorTracking.ErrorCoercer(),
    new CoreErrorTracking.ObjectCoercer(),
    new CoreErrorTracking.StringCoercer(),
    new CoreErrorTracking.PrimitiveCoercer(),
  ],
  [CoreErrorTracking.nodeStackLineParser]
)

export class PostHog extends PostHogBackendClient {
  getLibraryId(): string {
    return 'posthog-edge'
  }
}
