import type { PostHogAutocaptureElement, PostHogFlagsResponse, PostHogCoreOptions, PostHogEventProperties, PostHogCaptureOptions, JsonType, PostHogRemoteConfig, FeatureFlagValue, PostHogFeatureFlagDetails, PostHogGroupProperties } from './types';
import { PostHogPersistedProperty } from './types';
import { PostHogCoreStateless } from './posthog-core-stateless';
export declare abstract class PostHogCore extends PostHogCoreStateless {
    private sendFeatureFlagEvent;
    private flagCallReported;
    protected _flagsResponsePromise?: Promise<PostHogFlagsResponse | undefined>;
    protected _sessionExpirationTimeSeconds: number;
    private _sessionMaxLengthSeconds;
    protected sessionProps: PostHogEventProperties;
    constructor(apiKey: string, options?: PostHogCoreOptions);
    protected setupBootstrap(options?: Partial<PostHogCoreOptions>): void;
    private clearProps;
    on(event: string, cb: (...args: any[]) => void): () => void;
    reset(propertiesToKeep?: PostHogPersistedProperty[]): void;
    protected getCommonEventProperties(): PostHogEventProperties;
    private enrichProperties;
    /**
     * Returns the current session_id.
     *
     * @remarks
     * This should only be used for informative purposes.
     * Any actual internal use case for the session_id should be handled by the sessionManager.
     *
     * @public
     *
     * @returns The stored session ID for the current session. This may be an empty string if the client is not yet fully initialized.
     */
    getSessionId(): string;
    resetSessionId(): void;
    /**
     * Returns the current anonymous ID.
     *
     * This is the ID assigned to users before they are identified. It's used to track
     * anonymous users and link them to identified users when they sign up.
     *
     * {@label Identification}
     *
     * @example
     * ```js
     * // get the anonymous ID
     * const anonId = posthog.getAnonymousId()
     * console.log('Anonymous ID:', anonId)
     * ```
     *
     * @public
     *
     * @returns {string} The stored anonymous ID. This may be an empty string if the client is not yet fully initialized.
     */
    getAnonymousId(): string;
    /**
     * * @returns {string} The stored distinct ID. This may be an empty string if the client is not yet fully initialized.
     */
    getDistinctId(): string;
    registerForSession(properties: PostHogEventProperties): void;
    unregisterForSession(property: string): void;
    /***
     *** TRACKING
     ***/
    identify(distinctId?: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    capture(event: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    alias(alias: string): void;
    autocapture(eventType: string, elements: PostHogAutocaptureElement[], properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    /***
     *** GROUPS
     ***/
    groups(groups: PostHogGroupProperties): void;
    group(groupType: string, groupKey: string | number, groupProperties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    groupIdentify(groupType: string, groupKey: string | number, groupProperties?: PostHogEventProperties, options?: PostHogCaptureOptions): void;
    /***
     * PROPERTIES
     ***/
    setPersonPropertiesForFlags(properties: {
        [type: string]: string;
    }): void;
    resetPersonPropertiesForFlags(): void;
    setGroupPropertiesForFlags(properties: {
        [type: string]: Record<string, string>;
    }): void;
    resetGroupPropertiesForFlags(): void;
    private remoteConfigAsync;
    /***
     *** FEATURE FLAGS
     ***/
    private flagsAsync;
    private cacheSessionReplay;
    private _remoteConfigAsync;
    private _flagsAsync;
    private setKnownFeatureFlagDetails;
    private getKnownFeatureFlagDetails;
    protected getKnownFeatureFlags(): PostHogFlagsResponse['featureFlags'] | undefined;
    private getKnownFeatureFlagPayloads;
    private getBootstrappedFeatureFlagDetails;
    private setBootstrappedFeatureFlagDetails;
    private getBootstrappedFeatureFlags;
    private getBootstrappedFeatureFlagPayloads;
    getFeatureFlag(key: string): FeatureFlagValue | undefined;
    getFeatureFlagPayload(key: string): JsonType | undefined;
    getFeatureFlagPayloads(): PostHogFlagsResponse['featureFlagPayloads'] | undefined;
    getFeatureFlags(): PostHogFlagsResponse['featureFlags'] | undefined;
    getFeatureFlagDetails(): PostHogFeatureFlagDetails | undefined;
    getFeatureFlagsAndPayloads(): {
        flags: PostHogFlagsResponse['featureFlags'] | undefined;
        payloads: PostHogFlagsResponse['featureFlagPayloads'] | undefined;
    };
    isFeatureEnabled(key: string): boolean | undefined;
    reloadFeatureFlags(options?: {
        cb?: (err?: Error, flags?: PostHogFlagsResponse['featureFlags']) => void;
    }): void;
    reloadRemoteConfigAsync(): Promise<PostHogRemoteConfig | undefined>;
    reloadFeatureFlagsAsync(sendAnonDistinctId?: boolean): Promise<PostHogFlagsResponse['featureFlags'] | undefined>;
    onFeatureFlags(cb: (flags: PostHogFlagsResponse['featureFlags']) => void): () => void;
    onFeatureFlag(key: string, cb: (value: FeatureFlagValue) => void): () => void;
    overrideFeatureFlag(flags: PostHogFlagsResponse['featureFlags'] | null): Promise<void>;
    /**
     * Capture a caught exception manually
     *
     * {@label Error tracking}
     *
     * @public
     *
     * @example
     * ```js
     * // Capture a caught exception
     * try {
     *   // something that might throw
     * } catch (error) {
     *   posthog.captureException(error)
     * }
     * ```
     *
     * @example
     * ```js
     * // With additional properties
     * posthog.captureException(error, {
     *   customProperty: 'value',
     *   anotherProperty: ['I', 'can be a list'],
     *   ...
     * })
     * ```
     *
     * @param {Error} error The error to capture
     * @param {Object} [additionalProperties] Any additional properties to add to the error event
     * @returns {CaptureResult} The result of the capture
     */
    captureException(error: unknown, additionalProperties?: PostHogEventProperties): void;
    /**
     * Capture written user feedback for a LLM trace. Numeric values are converted to strings.
     *
     * {@label LLM analytics}
     *
     * @public
     *
     * @param traceId The trace ID to capture feedback for.
     * @param userFeedback The feedback to capture.
     */
    captureTraceFeedback(traceId: string | number, userFeedback: string): void;
    /**
     * Capture a metric for a LLM trace. Numeric values are converted to strings.
     *
     * {@label LLM analytics}
     *
     * @public
     *
     * @param traceId The trace ID to capture the metric for.
     * @param metricName The name of the metric to capture.
     * @param metricValue The value of the metric to capture.
     */
    captureTraceMetric(traceId: string | number, metricName: string, metricValue: string | number | boolean): void;
}
//# sourceMappingURL=posthog-core.d.ts.map