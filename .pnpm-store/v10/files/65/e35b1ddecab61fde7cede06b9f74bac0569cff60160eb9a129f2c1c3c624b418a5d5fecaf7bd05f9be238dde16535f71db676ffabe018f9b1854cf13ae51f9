import { addUncaughtExceptionListener, addUnhandledRejectionListener } from "./autocapture.mjs";
import { BucketedRateLimiter, uuidv7 } from "@posthog/core";
const SHUTDOWN_TIMEOUT = 2000;
class ErrorTracking {
    constructor(client, options, _logger){
        this.client = client;
        this._exceptionAutocaptureEnabled = options.enableExceptionAutocapture || false;
        this._logger = _logger;
        this._rateLimiter = new BucketedRateLimiter({
            refillRate: 1,
            bucketSize: 10,
            refillInterval: 10000,
            _logger: this._logger
        });
        this.startAutocaptureIfEnabled();
    }
    static async buildEventMessage(error, hint, distinctId, additionalProperties) {
        const properties = {
            ...additionalProperties
        };
        if (!distinctId) properties.$process_person_profile = false;
        const exceptionProperties = this.errorPropertiesBuilder.buildFromUnknown(error, hint);
        exceptionProperties.$exception_list = await this.errorPropertiesBuilder.modifyFrames(exceptionProperties.$exception_list);
        return {
            event: '$exception',
            distinctId: distinctId || uuidv7(),
            properties: {
                ...exceptionProperties,
                ...properties
            }
        };
    }
    startAutocaptureIfEnabled() {
        if (this.isEnabled()) {
            addUncaughtExceptionListener(this.onException.bind(this), this.onFatalError.bind(this));
            addUnhandledRejectionListener(this.onException.bind(this));
        }
    }
    onException(exception, hint) {
        this.client.addPendingPromise((async ()=>{
            const eventMessage = await ErrorTracking.buildEventMessage(exception, hint);
            const exceptionProperties = eventMessage.properties;
            const exceptionType = exceptionProperties?.$exception_list[0]?.type ?? 'Exception';
            const isRateLimited = this._rateLimiter.consumeRateLimit(exceptionType);
            if (isRateLimited) return void this._logger.info('Skipping exception capture because of client rate limiting.', {
                exception: exceptionType
            });
            return this.client.capture(eventMessage);
        })());
    }
    async onFatalError(exception) {
        console.error(exception);
        await this.client.shutdown(SHUTDOWN_TIMEOUT);
        process.exit(1);
    }
    isEnabled() {
        return !this.client.isDisabled && this._exceptionAutocaptureEnabled;
    }
    shutdown() {
        this._rateLimiter.stop();
    }
}
export { ErrorTracking as default };
