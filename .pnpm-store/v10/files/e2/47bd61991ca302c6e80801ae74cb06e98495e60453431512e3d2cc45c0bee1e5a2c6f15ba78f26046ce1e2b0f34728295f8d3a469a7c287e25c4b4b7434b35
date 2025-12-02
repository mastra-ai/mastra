import { addUncaughtExceptionListener, addUnhandledRejectionListener } from './autocapture'
import { PostHogBackendClient } from '@/client'
import { uuidv7 } from '@posthog/core'
import { EventMessage, PostHogOptions } from '@/types'
import type { Logger } from '@posthog/core'
import { BucketedRateLimiter } from '@posthog/core'
import { ErrorTracking as CoreErrorTracking } from '@posthog/core'

const SHUTDOWN_TIMEOUT = 2000

export default class ErrorTracking {
  private client: PostHogBackendClient
  private _exceptionAutocaptureEnabled: boolean
  private _rateLimiter: BucketedRateLimiter<string>
  private _logger: Logger

  static errorPropertiesBuilder: CoreErrorTracking.ErrorPropertiesBuilder

  constructor(client: PostHogBackendClient, options: PostHogOptions, _logger: Logger) {
    this.client = client
    this._exceptionAutocaptureEnabled = options.enableExceptionAutocapture || false
    this._logger = _logger

    // by default captures ten exceptions before rate limiting by exception type
    // refills at a rate of one token / 10 second period
    // e.g. will capture 1 exception rate limited exception every 10 seconds until burst ends
    this._rateLimiter = new BucketedRateLimiter({
      refillRate: 1,
      bucketSize: 10,
      refillInterval: 10000, // ten seconds in milliseconds
      _logger: this._logger,
    })

    this.startAutocaptureIfEnabled()
  }

  static async buildEventMessage(
    error: unknown,
    hint: CoreErrorTracking.EventHint,
    distinctId?: string,
    additionalProperties?: Record<string | number, any>
  ): Promise<EventMessage> {
    const properties: EventMessage['properties'] = { ...additionalProperties }

    // Given stateless nature of Node SDK we capture exceptions using personless processing when no
    // user can be determined because a distinct_id is not provided e.g. exception autocapture
    if (!distinctId) {
      properties.$process_person_profile = false
    }

    const exceptionProperties = this.errorPropertiesBuilder.buildFromUnknown(error, hint)
    exceptionProperties.$exception_list = await this.errorPropertiesBuilder.modifyFrames(
      exceptionProperties.$exception_list
    )

    return {
      event: '$exception',
      distinctId: distinctId || uuidv7(),
      properties: {
        ...exceptionProperties,
        ...properties,
      },
    }
  }

  private startAutocaptureIfEnabled(): void {
    if (this.isEnabled()) {
      addUncaughtExceptionListener(this.onException.bind(this), this.onFatalError.bind(this))
      addUnhandledRejectionListener(this.onException.bind(this))
    }
  }

  private onException(exception: unknown, hint: CoreErrorTracking.EventHint): void {
    this.client.addPendingPromise(
      (async () => {
        const eventMessage = await ErrorTracking.buildEventMessage(exception, hint)
        const exceptionProperties = eventMessage.properties
        const exceptionType = exceptionProperties?.$exception_list[0]?.type ?? 'Exception'
        const isRateLimited = this._rateLimiter.consumeRateLimit(exceptionType)
        if (isRateLimited) {
          this._logger.info('Skipping exception capture because of client rate limiting.', {
            exception: exceptionType,
          })
          return
        }
        return this.client.capture(eventMessage)
      })()
    )
  }

  private async onFatalError(exception: Error): Promise<void> {
    console.error(exception)
    await this.client.shutdown(SHUTDOWN_TIMEOUT)
    process.exit(1)
  }

  isEnabled(): boolean {
    return !this.client.isDisabled && this._exceptionAutocaptureEnabled
  }

  shutdown(): void {
    this._rateLimiter.stop()
  }
}
