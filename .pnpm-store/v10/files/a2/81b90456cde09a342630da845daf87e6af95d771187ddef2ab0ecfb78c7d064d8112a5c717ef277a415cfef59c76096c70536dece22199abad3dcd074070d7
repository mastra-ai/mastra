import { JsonType, PostHogCoreStateless, PostHogFetchOptions, PostHogFetchResponse, PostHogFlagsAndPayloadsResponse, PostHogPersistedProperty, PostHogCaptureOptions } from '@posthog/core';
import { EventMessage, GroupIdentifyMessage, IdentifyMessage, IPostHog, PostHogOptions } from './types';
import { FeatureFlagValue } from '@posthog/core';
import ErrorTracking from './extensions/error-tracking';
import { PostHogEventProperties } from '@posthog/core';
export declare abstract class PostHogBackendClient extends PostHogCoreStateless implements IPostHog {
    private _memoryStorage;
    private featureFlagsPoller?;
    protected errorTracking: ErrorTracking;
    private maxCacheSize;
    readonly options: PostHogOptions;
    distinctIdHasSentFlagCalls: Record<string, string[]>;
    /**
     * Initialize a new PostHog client instance.
     *
     * @example
     * ```ts
     * // Basic initialization
     * const client = new PostHogBackendClient(
     *   'your-api-key',
     *   { host: 'https://app.posthog.com' }
     * )
     * ```
     *
     * @example
     * ```ts
     * // With personal API key
     * const client = new PostHogBackendClient(
     *   'your-api-key',
     *   {
     *     host: 'https://app.posthog.com',
     *     personalApiKey: 'your-personal-api-key'
     *   }
     * )
     * ```
     *
     * {@label Initialization}
     *
     * @param apiKey - Your PostHog project API key
     * @param options - Configuration options for the client
     */
    constructor(apiKey: string, options?: PostHogOptions);
    /**
     * Get a persisted property value from memory storage.
     *
     * @example
     * ```ts
     * // Get user ID
     * const userId = client.getPersistedProperty('userId')
     * ```
     *
     * @example
     * ```ts
     * // Get session ID
     * const sessionId = client.getPersistedProperty('sessionId')
     * ```
     *
     * {@label Initialization}
     *
     * @param key - The property key to retrieve
     * @returns The stored property value or undefined if not found
     */
    getPersistedProperty(key: PostHogPersistedProperty): any | undefined;
    /**
     * Set a persisted property value in memory storage.
     *
     * @example
     * ```ts
     * // Set user ID
     * client.setPersistedProperty('userId', 'user_123')
     * ```
     *
     * @example
     * ```ts
     * // Set session ID
     * client.setPersistedProperty('sessionId', 'session_456')
     * ```
     *
     * {@label Initialization}
     *
     * @param key - The property key to set
     * @param value - The value to store (null to remove)
     */
    setPersistedProperty(key: PostHogPersistedProperty, value: any | null): void;
    /**
     * Make an HTTP request using the configured fetch function or default fetch.
     *
     * @example
     * ```ts
     * // POST request
     * const response = await client.fetch('/api/endpoint', {
     *   method: 'POST',
     *   headers: { 'Content-Type': 'application/json' },
     *   body: JSON.stringify(data)
     * })
     * ```
     *
     * @internal
     *
     * {@label Initialization}
     *
     * @param url - The URL to fetch
     * @param options - Fetch options
     * @returns Promise resolving to the fetch response
     */
    fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse>;
    /**
     * Get the library version from package.json.
     *
     * @example
     * ```ts
     * // Get version
     * const version = client.getLibraryVersion()
     * console.log(`Using PostHog SDK version: ${version}`)
     * ```
     *
     * {@label Initialization}
     *
     * @returns The current library version string
     */
    getLibraryVersion(): string;
    /**
     * Get the custom user agent string for this client.
     *
     * @example
     * ```ts
     * // Get user agent
     * const userAgent = client.getCustomUserAgent()
     * // Returns: "posthog-node/5.7.0"
     * ```
     *
     * {@label Identification}
     *
     * @returns The formatted user agent string
     */
    getCustomUserAgent(): string;
    /**
     * Enable the PostHog client (opt-in).
     *
     * @example
     * ```ts
     * // Enable client
     * await client.enable()
     * // Client is now enabled and will capture events
     * ```
     *
     * {@label Privacy}
     *
     * @returns Promise that resolves when the client is enabled
     */
    enable(): Promise<void>;
    /**
     * Disable the PostHog client (opt-out).
     *
     * @example
     * ```ts
     * // Disable client
     * await client.disable()
     * // Client is now disabled and will not capture events
     * ```
     *
     * {@label Privacy}
     *
     * @returns Promise that resolves when the client is disabled
     */
    disable(): Promise<void>;
    /**
     * Enable or disable debug logging.
     *
     * @example
     * ```ts
     * // Enable debug logging
     * client.debug(true)
     * ```
     *
     * @example
     * ```ts
     * // Disable debug logging
     * client.debug(false)
     * ```
     *
     * {@label Initialization}
     *
     * @param enabled - Whether to enable debug logging
     */
    debug(enabled?: boolean): void;
    /**
     * Capture an event manually.
     *
     * @example
     * ```ts
     * // Basic capture
     * client.capture({
     *   distinctId: 'user_123',
     *   event: 'button_clicked',
     *   properties: { button_color: 'red' }
     * })
     * ```
     *
     * {@label Capture}
     *
     * @param props - The event properties
     * @returns void
     */
    capture(props: EventMessage): void;
    /**
     * Capture an event immediately (synchronously).
     *
     * @example
     * ```ts
     * // Basic immediate capture
     * await client.captureImmediate({
     *   distinctId: 'user_123',
     *   event: 'button_clicked',
     *   properties: { button_color: 'red' }
     * })
     * ```
     *
     * @example
     * ```ts
     * // With feature flags
     * await client.captureImmediate({
     *   distinctId: 'user_123',
     *   event: 'user_action',
     *   sendFeatureFlags: true
     * })
     * ```
     *
     * @example
     * ```ts
     * // With custom feature flags options
     * await client.captureImmediate({
     *   distinctId: 'user_123',
     *   event: 'user_action',
     *   sendFeatureFlags: {
     *     onlyEvaluateLocally: true,
     *     personProperties: { plan: 'premium' },
     *     groupProperties: { org: { tier: 'enterprise' } }
     *     flagKeys: ['flag1', 'flag2']
     *   }
     * })
     * ```
     *
     * {@label Capture}
     *
     * @param props - The event properties
     * @returns Promise that resolves when the event is captured
     */
    captureImmediate(props: EventMessage): Promise<void>;
    /**
     * Identify a user and set their properties.
     *
     * @example
     * ```ts
     * // Basic identify with properties
     * client.identify({
     *   distinctId: 'user_123',
     *   properties: {
     *     name: 'John Doe',
     *     email: 'john@example.com',
     *     plan: 'premium'
     *   }
     * })
     * ```
     *
     * @example
     * ```ts
     * // Using $set and $set_once
     * client.identify({
     *   distinctId: 'user_123',
     *   properties: {
     *     $set: { name: 'John Doe', email: 'john@example.com' },
     *     $set_once: { first_login: new Date().toISOString() }
     *   }
     * })
     * ```
     *
     * {@label Identification}
     *
     * @param data - The identify data containing distinctId and properties
     */
    identify({ distinctId, properties, disableGeoip }: IdentifyMessage): void;
    /**
     * Identify a user and set their properties immediately (synchronously).
     *
     * @example
     * ```ts
     * // Basic immediate identify
     * await client.identifyImmediate({
     *   distinctId: 'user_123',
     *   properties: {
     *     name: 'John Doe',
     *     email: 'john@example.com'
     *   }
     * })
     * ```
     *
     * {@label Identification}
     *
     * @param data - The identify data containing distinctId and properties
     * @returns Promise that resolves when the identify is processed
     */
    identifyImmediate({ distinctId, properties, disableGeoip }: IdentifyMessage): Promise<void>;
    /**
     * Create an alias to link two distinct IDs together.
     *
     * @example
     * ```ts
     * // Link an anonymous user to an identified user
     * client.alias({
     *   distinctId: 'anonymous_123',
     *   alias: 'user_456'
     * })
     * ```
     *
     * {@label Identification}
     *
     * @param data - The alias data containing distinctId and alias
     */
    alias(data: {
        distinctId: string;
        alias: string;
        disableGeoip?: boolean;
    }): void;
    /**
     * Create an alias to link two distinct IDs together immediately (synchronously).
     *
     * @example
     * ```ts
     * // Link an anonymous user to an identified user immediately
     * await client.aliasImmediate({
     *   distinctId: 'anonymous_123',
     *   alias: 'user_456'
     * })
     * ```
     *
     * {@label Identification}
     *
     * @param data - The alias data containing distinctId and alias
     * @returns Promise that resolves when the alias is processed
     */
    aliasImmediate(data: {
        distinctId: string;
        alias: string;
        disableGeoip?: boolean;
    }): Promise<void>;
    /**
     * Check if local evaluation of feature flags is ready.
     *
     * @example
     * ```ts
     * // Check if ready
     * if (client.isLocalEvaluationReady()) {
     *   // Local evaluation is ready, can evaluate flags locally
     *   const flag = await client.getFeatureFlag('flag-key', 'user_123')
     * } else {
     *   // Local evaluation not ready, will use remote evaluation
     *   const flag = await client.getFeatureFlag('flag-key', 'user_123')
     * }
     * ```
     *
     * {@label Feature flags}
     *
     * @returns true if local evaluation is ready, false otherwise
     */
    isLocalEvaluationReady(): boolean;
    /**
     * Wait for local evaluation of feature flags to be ready.
     *
     * @example
     * ```ts
     * // Wait for local evaluation
     * const isReady = await client.waitForLocalEvaluationReady()
     * if (isReady) {
     *   console.log('Local evaluation is ready')
     * } else {
     *   console.log('Local evaluation timed out')
     * }
     * ```
     *
     * @example
     * ```ts
     * // Wait with custom timeout
     * const isReady = await client.waitForLocalEvaluationReady(10000) // 10 seconds
     * ```
     *
     * {@label Feature flags}
     *
     * @param timeoutMs - Timeout in milliseconds (default: 30000)
     * @returns Promise that resolves to true if ready, false if timed out
     */
    waitForLocalEvaluationReady(timeoutMs?: number): Promise<boolean>;
    /**
     * Get the value of a feature flag for a specific user.
     *
     * @example
     * ```ts
     * // Basic feature flag check
     * const flagValue = await client.getFeatureFlag('new-feature', 'user_123')
     * if (flagValue === 'variant-a') {
     *   // Show variant A
     * } else if (flagValue === 'variant-b') {
     *   // Show variant B
     * } else {
     *   // Flag is disabled or not found
     * }
     * ```
     *
     * @example
     * ```ts
     * // With groups and properties
     * const flagValue = await client.getFeatureFlag('org-feature', 'user_123', {
     *   groups: { organization: 'acme-corp' },
     *   personProperties: { plan: 'enterprise' },
     *   groupProperties: { organization: { tier: 'premium' } }
     * })
     * ```
     *
     * @example
     * ```ts
     * // Only evaluate locally
     * const flagValue = await client.getFeatureFlag('local-flag', 'user_123', {
     *   onlyEvaluateLocally: true
     * })
     * ```
     *
     * {@label Feature flags}
     *
     * @param key - The feature flag key
     * @param distinctId - The user's distinct ID
     * @param options - Optional configuration for flag evaluation
     * @returns Promise that resolves to the flag value or undefined
     */
    getFeatureFlag(key: string, distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        sendFeatureFlagEvents?: boolean;
        disableGeoip?: boolean;
    }): Promise<FeatureFlagValue | undefined>;
    /**
     * Get the payload for a feature flag.
     *
     * @example
     * ```ts
     * // Get payload for a feature flag
     * const payload = await client.getFeatureFlagPayload('flag-key', 'user_123')
     * if (payload) {
     *   console.log('Flag payload:', payload)
     * }
     * ```
     *
     * @example
     * ```ts
     * // Get payload with specific match value
     * const payload = await client.getFeatureFlagPayload('flag-key', 'user_123', 'variant-a')
     * ```
     *
     * @example
     * ```ts
     * // With groups and properties
     * const payload = await client.getFeatureFlagPayload('org-flag', 'user_123', undefined, {
     *   groups: { organization: 'acme-corp' },
     *   personProperties: { plan: 'enterprise' }
     * })
     * ```
     *
     * {@label Feature flags}
     *
     * @param key - The feature flag key
     * @param distinctId - The user's distinct ID
     * @param matchValue - Optional match value to get payload for
     * @param options - Optional configuration for flag evaluation
     * @returns Promise that resolves to the flag payload or undefined
     */
    getFeatureFlagPayload(key: string, distinctId: string, matchValue?: FeatureFlagValue, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        /** @deprecated THIS OPTION HAS NO EFFECT, kept here for backwards compatibility reasons. */
        sendFeatureFlagEvents?: boolean;
        disableGeoip?: boolean;
    }): Promise<JsonType | undefined>;
    /**
     * Get the remote config payload for a feature flag.
     *
     * @example
     * ```ts
     * // Get remote config payload
     * const payload = await client.getRemoteConfigPayload('flag-key')
     * if (payload) {
     *   console.log('Remote config payload:', payload)
     * }
     * ```
     *
     * {@label Feature flags}
     *
     * @param flagKey - The feature flag key
     * @returns Promise that resolves to the remote config payload or undefined
     * @throws Error if personal API key is not provided
     */
    getRemoteConfigPayload(flagKey: string): Promise<JsonType | undefined>;
    /**
     * Check if a feature flag is enabled for a specific user.
     *
     * @example
     * ```ts
     * // Basic feature flag check
     * const isEnabled = await client.isFeatureEnabled('new-feature', 'user_123')
     * if (isEnabled) {
     *   // Feature is enabled
     *   console.log('New feature is active')
     * } else {
     *   // Feature is disabled
     *   console.log('New feature is not active')
     * }
     * ```
     *
     * @example
     * ```ts
     * // With groups and properties
     * const isEnabled = await client.isFeatureEnabled('org-feature', 'user_123', {
     *   groups: { organization: 'acme-corp' },
     *   personProperties: { plan: 'enterprise' }
     * })
     * ```
     *
     * {@label Feature flags}
     *
     * @param key - The feature flag key
     * @param distinctId - The user's distinct ID
     * @param options - Optional configuration for flag evaluation
     * @returns Promise that resolves to true if enabled, false if disabled, undefined if not found
     */
    isFeatureEnabled(key: string, distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        sendFeatureFlagEvents?: boolean;
        disableGeoip?: boolean;
    }): Promise<boolean | undefined>;
    /**
     * Get all feature flag values for a specific user.
     *
     * @example
     * ```ts
     * // Get all flags for a user
     * const allFlags = await client.getAllFlags('user_123')
     * console.log('User flags:', allFlags)
     * // Output: { 'flag-1': 'variant-a', 'flag-2': false, 'flag-3': 'variant-b' }
     * ```
     *
     * @example
     * ```ts
     * // With specific flag keys
     * const specificFlags = await client.getAllFlags('user_123', {
     *   flagKeys: ['flag-1', 'flag-2']
     * })
     * ```
     *
     * @example
     * ```ts
     * // With groups and properties
     * const orgFlags = await client.getAllFlags('user_123', {
     *   groups: { organization: 'acme-corp' },
     *   personProperties: { plan: 'enterprise' }
     * })
     * ```
     *
     * {@label Feature flags}
     *
     * @param distinctId - The user's distinct ID
     * @param options - Optional configuration for flag evaluation
     * @returns Promise that resolves to a record of flag keys and their values
     */
    getAllFlags(distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        disableGeoip?: boolean;
        flagKeys?: string[];
    }): Promise<Record<string, FeatureFlagValue>>;
    /**
     * Get all feature flag values and payloads for a specific user.
     *
     * @example
     * ```ts
     * // Get all flags and payloads for a user
     * const result = await client.getAllFlagsAndPayloads('user_123')
     * console.log('Flags:', result.featureFlags)
     * console.log('Payloads:', result.featureFlagPayloads)
     * ```
     *
     * @example
     * ```ts
     * // With specific flag keys
     * const result = await client.getAllFlagsAndPayloads('user_123', {
     *   flagKeys: ['flag-1', 'flag-2']
     * })
     * ```
     *
     * @example
     * ```ts
     * // Only evaluate locally
     * const result = await client.getAllFlagsAndPayloads('user_123', {
     *   onlyEvaluateLocally: true
     * })
     * ```
     *
     * {@label Feature flags}
     *
     * @param distinctId - The user's distinct ID
     * @param options - Optional configuration for flag evaluation
     * @returns Promise that resolves to flags and payloads
     */
    getAllFlagsAndPayloads(distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        disableGeoip?: boolean;
        flagKeys?: string[];
    }): Promise<PostHogFlagsAndPayloadsResponse>;
    /**
     * Create or update a group and its properties.
     *
     * @example
     * ```ts
     * // Create a company group
     * client.groupIdentify({
     *   groupType: 'company',
     *   groupKey: 'acme-corp',
     *   properties: {
     *     name: 'Acme Corporation',
     *     industry: 'Technology',
     *     employee_count: 500
     *   },
     *   distinctId: 'user_123'
     * })
     * ```
     *
     * @example
     * ```ts
     * // Update organization properties
     * client.groupIdentify({
     *   groupType: 'organization',
     *   groupKey: 'org-456',
     *   properties: {
     *     plan: 'enterprise',
     *     region: 'US-West'
     *   }
     * })
     * ```
     *
     * {@label Identification}
     *
     * @param data - The group identify data
     */
    groupIdentify({ groupType, groupKey, properties, distinctId, disableGeoip }: GroupIdentifyMessage): void;
    /**
     * Reload feature flag definitions from the server for local evaluation.
     *
     * @example
     * ```ts
     * // Force reload of feature flags
     * await client.reloadFeatureFlags()
     * console.log('Feature flags reloaded')
     * ```
     *
     * @example
     * ```ts
     * // Reload before checking a specific flag
     * await client.reloadFeatureFlags()
     * const flag = await client.getFeatureFlag('flag-key', 'user_123')
     * ```
     *
     * {@label Feature flags}
     *
     * @returns Promise that resolves when flags are reloaded
     */
    reloadFeatureFlags(): Promise<void>;
    /**
     * Shutdown the PostHog client gracefully.
     *
     * @example
     * ```ts
     * // Shutdown with default timeout
     * await client._shutdown()
     * ```
     *
     * @example
     * ```ts
     * // Shutdown with custom timeout
     * await client._shutdown(5000) // 5 seconds
     * ```
     *
     * {@label Shutdown}
     *
     * @param shutdownTimeoutMs - Timeout in milliseconds for shutdown
     * @returns Promise that resolves when shutdown is complete
     */
    _shutdown(shutdownTimeoutMs?: number): Promise<void>;
    private _requestRemoteConfigPayload;
    private extractPropertiesFromEvent;
    private getFeatureFlagsForEvent;
    private addLocalPersonAndGroupProperties;
    /**
     * Capture an error exception as an event.
     *
     * @example
     * ```ts
     * // Capture an error with user ID
     * try {
     *   // Some risky operation
     *   riskyOperation()
     * } catch (error) {
     *   client.captureException(error, 'user_123')
     * }
     * ```
     *
     * @example
     * ```ts
     * // Capture with additional properties
     * try {
     *   apiCall()
     * } catch (error) {
     *   client.captureException(error, 'user_123', {
     *     endpoint: '/api/users',
     *     method: 'POST',
     *     status_code: 500
     *   })
     * }
     * ```
     *
     * {@label Error tracking}
     *
     * @param error - The error to capture
     * @param distinctId - Optional user distinct ID
     * @param additionalProperties - Optional additional properties to include
     */
    captureException(error: unknown, distinctId?: string, additionalProperties?: Record<string | number, any>): void;
    /**
     * Capture an error exception as an event immediately (synchronously).
     *
     * @example
     * ```ts
     * // Capture an error immediately with user ID
     * try {
     *   // Some risky operation
     *   riskyOperation()
     * } catch (error) {
     *   await client.captureExceptionImmediate(error, 'user_123')
     * }
     * ```
     *
     * @example
     * ```ts
     * // Capture with additional properties
     * try {
     *   apiCall()
     * } catch (error) {
     *   await client.captureExceptionImmediate(error, 'user_123', {
     *     endpoint: '/api/users',
     *     method: 'POST',
     *     status_code: 500
     *   })
     * }
     * ```
     *
     * {@label Error tracking}
     *
     * @param error - The error to capture
     * @param distinctId - Optional user distinct ID
     * @param additionalProperties - Optional additional properties to include
     * @returns Promise that resolves when the error is captured
     */
    captureExceptionImmediate(error: unknown, distinctId?: string, additionalProperties?: Record<string | number, any>): Promise<void>;
    prepareEventMessage(props: EventMessage): Promise<{
        distinctId: string;
        event: string;
        properties: PostHogEventProperties;
        options: PostHogCaptureOptions;
    }>;
    private _runBeforeSend;
}
//# sourceMappingURL=client.d.ts.map