import { SimpleEventEmitter } from './eventemitter';
import { PostHogFlagsResponse, PostHogCoreOptions, PostHogEventProperties, PostHogCaptureOptions, JsonType, PostHogRemoteConfig, FeatureFlagValue, PostHogFeatureFlagDetails, FeatureFlagDetail, SurveyResponse, PostHogFetchResponse, PostHogFetchOptions, PostHogPersistedProperty, Logger } from './types';
import { RetriableOptions } from './utils';
export declare const maybeAdd: (key: string, value: JsonType | undefined) => Record<string, JsonType>;
export declare function logFlushError(err: any): Promise<void>;
export declare enum QuotaLimitedFeature {
    FeatureFlags = "feature_flags",
    Recordings = "recordings"
}
export declare abstract class PostHogCoreStateless {
    readonly apiKey: string;
    readonly host: string;
    readonly flushAt: number;
    readonly preloadFeatureFlags: boolean;
    readonly disableSurveys: boolean;
    private maxBatchSize;
    private maxQueueSize;
    private flushInterval;
    private flushPromise;
    private shutdownPromise;
    private requestTimeout;
    private featureFlagsRequestTimeoutMs;
    private remoteConfigRequestTimeoutMs;
    private removeDebugCallback?;
    private disableGeoip;
    private historicalMigration;
    private evaluationEnvironments?;
    protected disabled: boolean;
    protected disableCompression: boolean;
    private defaultOptIn;
    private promiseQueue;
    protected _events: SimpleEventEmitter;
    protected _flushTimer?: any;
    protected _retryOptions: RetriableOptions;
    protected _initPromise: Promise<void>;
    protected _isInitialized: boolean;
    protected _remoteConfigResponsePromise?: Promise<PostHogRemoteConfig | undefined>;
    protected _logger: Logger;
    abstract fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse>;
    abstract getLibraryId(): string;
    abstract getLibraryVersion(): string;
    abstract getCustomUserAgent(): string | void;
    abstract getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined;
    abstract setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void;
    constructor(apiKey: string, options?: PostHogCoreOptions);
    protected logMsgIfDebug(fn: () => void): void;
    protected wrap(fn: () => void): void;
    protected getCommonEventProperties(): PostHogEventProperties;
    get optedOut(): boolean;
    optIn(): Promise<void>;
    optOut(): Promise<void>;
    on(event: string, cb: (...args: any[]) => void): () => void;
    /**
     * Enables or disables debug mode for detailed logging.
     *
     * @remarks
     * Debug mode logs all PostHog calls to the console for troubleshooting.
     * This is useful during development to understand what data is being sent.
     *
     * {@label Initialization}
     *
     * @example
     * ```js
     * // enable debug mode
     * posthog.debug(true)
     * ```
     *
     * @example
     * ```js
     * // disable debug mode
     * posthog.debug(false)
     * ```
     *
     * @public
     *
     * @param {boolean} [debug] If true, will enable debug mode.
     */
    debug(enabled?: boolean): void;
    get isDebug(): boolean;
    get isDisabled(): boolean;
    private buildPayload;
    addPendingPromise<T>(promise: Promise<T>): Promise<T>;
    /***
     *** TRACKING
     ***/
    protected identifyStateless(distinctId: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    protected identifyStatelessImmediate(distinctId: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): Promise<void>;
    protected captureStateless(distinctId: string, event: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    protected captureStatelessImmediate(distinctId: string, event: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): Promise<void>;
    protected aliasStateless(alias: string, distinctId: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    protected aliasStatelessImmediate(alias: string, distinctId: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): Promise<void>;
    /***
     *** GROUPS
     ***/
    protected groupIdentifyStateless(groupType: string, groupKey: string | number, groupProperties?: PostHogEventProperties, options?: PostHogCaptureOptions, distinctId?: string, eventProperties?: PostHogEventProperties): void;
    protected getRemoteConfig(): Promise<PostHogRemoteConfig | undefined>;
    /***
     *** FEATURE FLAGS
     ***/
    protected getFlags(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, extraPayload?: Record<string, any>): Promise<PostHogFlagsResponse | undefined>;
    protected getFeatureFlagStateless(key: string, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean): Promise<{
        response: FeatureFlagValue | undefined;
        requestId: string | undefined;
    }>;
    protected getFeatureFlagDetailStateless(key: string, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean): Promise<{
        response: FeatureFlagDetail | undefined;
        requestId: string | undefined;
    } | undefined>;
    protected getFeatureFlagPayloadStateless(key: string, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean): Promise<JsonType | undefined>;
    protected getFeatureFlagPayloadsStateless(distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<PostHogFlagsResponse['featureFlagPayloads'] | undefined>;
    protected getFeatureFlagsStateless(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<{
        flags: PostHogFlagsResponse['featureFlags'] | undefined;
        payloads: PostHogFlagsResponse['featureFlagPayloads'] | undefined;
        requestId: PostHogFlagsResponse['requestId'] | undefined;
    }>;
    protected getFeatureFlagsAndPayloadsStateless(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<{
        flags: PostHogFlagsResponse['featureFlags'] | undefined;
        payloads: PostHogFlagsResponse['featureFlagPayloads'] | undefined;
        requestId: PostHogFlagsResponse['requestId'] | undefined;
    }>;
    protected getFeatureFlagDetailsStateless(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<PostHogFeatureFlagDetails | undefined>;
    /***
     *** SURVEYS
     ***/
    getSurveysStateless(): Promise<SurveyResponse['surveys']>;
    /***
     *** SUPER PROPERTIES
     ***/
    private _props;
    protected get props(): PostHogEventProperties;
    protected set props(val: PostHogEventProperties | undefined);
    register(properties: PostHogEventProperties): Promise<void>;
    unregister(property: string): Promise<void>;
    /***
     *** QUEUEING AND FLUSHING
     ***/
    protected enqueue(type: string, _message: any, options?: PostHogCaptureOptions): void;
    protected sendImmediate(type: string, _message: any, options?: PostHogCaptureOptions): Promise<void>;
    private prepareMessage;
    private clearFlushTimer;
    /**
     * Helper for flushing the queue in the background
     * Avoids unnecessary promise errors
     */
    private flushBackground;
    /**
     * Flushes the queue of pending events.
     *
     * This function will return a promise that will resolve when the flush is complete,
     * or reject if there was an error (for example if the server or network is down).
     *
     * If there is already a flush in progress, this function will wait for that flush to complete.
     *
     * It's recommended to do error handling in the callback of the promise.
     *
     * {@label Initialization}
     *
     * @example
     * ```js
     * // flush with error handling
     * posthog.flush().then(() => {
     *   console.log('Flush complete')
     * }).catch((err) => {
     *   console.error('Flush failed', err)
     * })
     * ```
     *
     * @public
     *
     * @throws PostHogFetchHttpError
     * @throws PostHogFetchNetworkError
     * @throws Error
     */
    flush(): Promise<void>;
    protected getCustomHeaders(): {
        [key: string]: string;
    };
    private _flush;
    private fetchWithRetry;
    _shutdown(shutdownTimeoutMs?: number): Promise<void>;
    /**
     * Shuts down the PostHog instance and ensures all events are sent.
     *
     * Call shutdown() once before the process exits to ensure that all events have been sent and all promises
     * have resolved. Do not use this function if you intend to keep using this PostHog instance after calling it.
     * Use flush() for per-request cleanup instead.
     *
     * {@label Initialization}
     *
     * @example
     * ```js
     * // shutdown before process exit
     * process.on('SIGINT', async () => {
     *   await posthog.shutdown()
     *   process.exit(0)
     * })
     * ```
     *
     * @public
     *
     * @param {number} [shutdownTimeoutMs=30000] Maximum time to wait for shutdown in milliseconds
     * @returns {Promise<void>} A promise that resolves when shutdown is complete
     */
    shutdown(shutdownTimeoutMs?: number): Promise<void>;
}
//# sourceMappingURL=posthog-core-stateless.d.ts.map