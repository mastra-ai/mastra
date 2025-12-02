import type { PostHogCoreOptions, FeatureFlagValue, JsonType, PostHogFetchOptions, PostHogFetchResponse } from '@posthog/core';
export interface IdentifyMessage {
    distinctId: string;
    properties?: Record<string | number, any>;
    disableGeoip?: boolean;
}
export interface SendFeatureFlagsOptions {
    onlyEvaluateLocally?: boolean;
    personProperties?: Record<string, any>;
    groupProperties?: Record<string, Record<string, any>>;
    flagKeys?: string[];
}
export interface EventMessage extends IdentifyMessage {
    event: string;
    groups?: Record<string, string | number>;
    sendFeatureFlags?: boolean | SendFeatureFlagsOptions;
    timestamp?: Date;
    uuid?: string;
}
export interface GroupIdentifyMessage {
    groupType: string;
    groupKey: string;
    properties?: Record<string | number, any>;
    distinctId?: string;
    disableGeoip?: boolean;
}
export type PropertyGroup = {
    type: 'AND' | 'OR';
    values: PropertyGroup[] | FlagProperty[];
};
export type FlagProperty = {
    key: string;
    type?: string;
    value: FlagPropertyValue;
    operator?: string;
    negation?: boolean;
    dependency_chain?: string[];
};
export type FlagPropertyValue = string | number | (string | number)[] | boolean;
export type FeatureFlagCondition = {
    properties: FlagProperty[];
    rollout_percentage?: number;
    variant?: string;
};
export type BeforeSendFn = (event: EventMessage | null) => EventMessage | null;
export type PostHogOptions = PostHogCoreOptions & {
    persistence?: 'memory';
    personalApiKey?: string;
    privacyMode?: boolean;
    enableExceptionAutocapture?: boolean;
    featureFlagsPollingInterval?: number;
    maxCacheSize?: number;
    fetch?: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>;
    enableLocalEvaluation?: boolean;
    /**
     * Allows modification or dropping of events before they're sent to PostHog.
     * If an array is provided, the functions are run in order.
     * If a function returns null, the event will be dropped.
     */
    before_send?: BeforeSendFn | BeforeSendFn[];
    /**
     * Evaluation environments for feature flags.
     * When set, only feature flags that have at least one matching evaluation tag
     * will be evaluated for this SDK instance. Feature flags with no evaluation tags
     * will always be evaluated.
     *
     * Examples: ['production', 'backend', 'api']
     *
     * @default undefined
     */
    evaluationEnvironments?: readonly string[];
    /**
     * Additional user agent strings to block from being tracked.
     * These are combined with the default list of blocked user agents.
     *
     * @default []
     */
    custom_blocked_useragents?: string[];
    /**
     * PREVIEW - MAY CHANGE WITHOUT WARNING - DO NOT USE IN PRODUCTION
     * Enables collection of bot traffic as $bot_pageview events instead of dropping them.
     * When enabled, events with a $raw_user_agent property that matches the bot detection list
     * will have their $pageview event renamed to $bot_pageview.
     *
     * To use this feature, pass the user agent in event properties:
     * ```ts
     * client.capture({
     *   distinctId: 'user_123',
     *   event: '$pageview',
     *   properties: {
     *     $raw_user_agent: req.headers['user-agent']
     *   }
     * })
     * ```
     */
    __preview_capture_bot_pageviews?: boolean;
};
export type PostHogFeatureFlag = {
    id: number;
    name: string;
    key: string;
    filters?: {
        aggregation_group_type_index?: number;
        groups?: FeatureFlagCondition[];
        multivariate?: {
            variants: {
                key: string;
                rollout_percentage: number;
            }[];
        };
        payloads?: Record<string, string>;
    };
    deleted: boolean;
    active: boolean;
    rollout_percentage: null | number;
    ensure_experience_continuity: boolean;
    experiment_set: number[];
};
export interface IPostHog {
    /**
     * @description Capture allows you to capture anything a user does within your system,
     * which you can later use in PostHog to find patterns in usage,
     * work out which features to improve or where people are giving up.
     * A capture call requires:
     * @param distinctId which uniquely identifies your user
     * @param event We recommend using [verb] [noun], like movie played or movie updated to easily identify what your events mean later on.
     * @param properties OPTIONAL | which can be a object with any information you'd like to add
     * @param groups OPTIONAL | object of what groups are related to this event, example: { company: 'id:5' }. Can be used to analyze companies instead of users.
     * @param sendFeatureFlags OPTIONAL | Used with experiments. Determines whether to send feature flag values with the event.
     */
    capture({ distinctId, event, properties, groups, sendFeatureFlags }: EventMessage): void;
    /**
     * @description Capture an event immediately. Useful for edge environments where the usual queue-based sending is not preferable. Do not mix immediate and non-immediate calls.
     * @param distinctId which uniquely identifies your user
     * @param event We recommend using [verb] [noun], like movie played or movie updated to easily identify what your events mean later on.
     * @param properties OPTIONAL | which can be a object with any information you'd like to add
     * @param groups OPTIONAL | object of what groups are related to this event, example: { company: 'id:5' }. Can be used to analyze companies instead of users.
     * @param sendFeatureFlags OPTIONAL | Used with experiments. Determines whether to send feature flag values with the event.
     */
    captureImmediate({ distinctId, event, properties, groups, sendFeatureFlags }: EventMessage): Promise<void>;
    /**
     * @description Identify lets you add metadata on your users so you can more easily identify who they are in PostHog,
     * and even do things like segment users by these properties.
     * An identify call requires:
     * @param distinctId which uniquely identifies your user
     * @param properties with a dict with any key: value pairs
     */
    identify({ distinctId, properties }: IdentifyMessage): void;
    /**
     * @description Identify lets you add metadata on your users so you can more easily identify who they are in PostHog.
     * Useful for edge environments where the usual queue-based sending is not preferable. Do not mix immediate and non-immediate calls.
     * @param distinctId which uniquely identifies your user
     * @param properties with a dict with any key: value pairs
     */
    identifyImmediate({ distinctId, properties }: IdentifyMessage): Promise<void>;
    /**
     * @description To marry up whatever a user does before they sign up or log in with what they do after you need to make an alias call.
     * This will allow you to answer questions like "Which marketing channels leads to users churning after a month?"
     * or "What do users do on our website before signing up?"
     * In a purely back-end implementation, this means whenever an anonymous user does something, you'll want to send a session ID with the capture call.
     * Then, when that users signs up, you want to do an alias call with the session ID and the newly created user ID.
     * The same concept applies for when a user logs in. If you're using PostHog in the front-end and back-end,
     *  doing the identify call in the frontend will be enough.:
     * @param distinctId the current unique id
     * @param alias the unique ID of the user before
     */
    alias(data: {
        distinctId: string;
        alias: string;
    }): void;
    /**
     * @description To marry up whatever a user does before they sign up or log in with what they do after you need to make an alias call.
     * Useful for edge environments where the usual queue-based sending is not preferable. Do not mix immediate and non-immediate calls.
     * @param distinctId the current unique id
     * @param alias the unique ID of the user before
     */
    aliasImmediate(data: {
        distinctId: string;
        alias: string;
    }): Promise<void>;
    /**
     * @description PostHog feature flags (https://posthog.com/docs/features/feature-flags)
     * allow you to safely deploy and roll back new features. Once you've created a feature flag in PostHog,
     * you can use this method to check if the flag is on for a given user, allowing you to create logic to turn
     * features on and off for different user groups or individual users.
     * @param key the unique key of your feature flag
     * @param distinctId the current unique id
     * @param options: dict with optional parameters below
     * @param groups optional - what groups are currently active (group analytics). Required if the flag depends on groups.
     * @param personProperties optional - what person properties are known. Used to compute flags locally, if personalApiKey is present.
     * @param groupProperties optional - what group properties are known. Used to compute flags locally, if personalApiKey is present.
     * @param onlyEvaluateLocally optional - whether to only evaluate the flag locally. Defaults to false.
     * @param sendFeatureFlagEvents optional - whether to send feature flag events. Used for Experiments. Defaults to true.
     *
     * @returns true if the flag is on, false if the flag is off, undefined if there was an error.
     */
    isFeatureEnabled(key: string, distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        sendFeatureFlagEvents?: boolean;
    }): Promise<boolean | undefined>;
    /**
     * @description PostHog feature flags (https://posthog.com/docs/features/feature-flags)
     * allow you to safely deploy and roll back new features. Once you've created a feature flag in PostHog,
     * you can use this method to check if the flag is on for a given user, allowing you to create logic to turn
     * features on and off for different user groups or individual users.
     * @param key the unique key of your feature flag
     * @param distinctId the current unique id
     * @param options: dict with optional parameters below
     * @param groups optional - what groups are currently active (group analytics). Required if the flag depends on groups.
     * @param personProperties optional - what person properties are known. Used to compute flags locally, if personalApiKey is present.
     * @param groupProperties optional - what group properties are known. Used to compute flags locally, if personalApiKey is present.
     * @param onlyEvaluateLocally optional - whether to only evaluate the flag locally. Defaults to false.
     * @param sendFeatureFlagEvents optional - whether to send feature flag events. Used for Experiments. Defaults to true.
     *
     * @returns true or string(for multivariates) if the flag is on, false if the flag is off, undefined if there was an error.
     */
    getFeatureFlag(key: string, distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        sendFeatureFlagEvents?: boolean;
    }): Promise<FeatureFlagValue | undefined>;
    /**
     * @description Retrieves payload associated with the specified flag and matched value that is passed in.
     *
     * IMPORTANT: The `matchValue` parameter should be the value you previously obtained from `getFeatureFlag()`.
     * If matchValue isn't passed (or is undefined), this method will automatically call `getFeatureFlag()`
     * internally to fetch the flag value, which could result in a network call to the PostHog server if this flag can
     * not be evaluated locally. This means that omitting `matchValue` will potentially:
     * - Bypass local evaluation
     * - Count as an additional flag evaluation against your quota
     * - Impact performance due to the extra network request
     *
     * Example usage:
     * ```js
     * const flagValue = await client.getFeatureFlag('my-flag', distinctId);
     * const payload = await client.getFeatureFlagPayload('my-flag', distinctId, flagValue);
     * ```
     *
     * @param key the unique key of your feature flag
     * @param distinctId the current unique id
     * @param matchValue The flag value previously obtained from calling `getFeatureFlag()`. Can be a string or boolean.
     *                   To avoid extra network calls, pass this parameter when you can.
     * @param options: dict with optional parameters below
     * @param onlyEvaluateLocally optional - whether to only evaluate the flag locally. Defaults to false.
     *
     * @returns payload of a json type object
     */
    getFeatureFlagPayload(key: string, distinctId: string, matchValue?: FeatureFlagValue, options?: {
        onlyEvaluateLocally?: boolean;
    }): Promise<JsonType | undefined>;
    /**
     * @description Sets a groups properties, which allows asking questions like "Who are the most active companies"
     * using my product in PostHog.
     *
     * @param groupType Type of group (ex: 'company'). Limited to 5 per project
     * @param groupKey Unique identifier for that type of group (ex: 'id:5')
     * @param properties OPTIONAL | which can be a object with any information you'd like to add
     */
    groupIdentify({ groupType, groupKey, properties }: GroupIdentifyMessage): void;
    /**
     * @description Force an immediate reload of the polled feature flags. Please note that they are
     * already polled automatically at a regular interval.
     */
    reloadFeatureFlags(): Promise<void>;
    /**
     * @description Flushes the events still in the queue and clears the feature flags poller to allow for
     * a clean shutdown.
     *
     * @param shutdownTimeoutMs The shutdown timeout, in milliseconds. Defaults to 30000 (30s).
     */
    shutdown(shutdownTimeoutMs?: number): void;
    /**
     * @description Waits for local evaluation to be ready, with an optional timeout.
     * @param timeoutMs - Maximum time to wait in milliseconds. Defaults to 30 seconds.
     * @returns A promise that resolves to true if local evaluation is ready, false if the timeout was reached.
     */
    waitForLocalEvaluationReady(timeoutMs?: number): Promise<boolean>;
    /**
     * @description Returns true if local evaluation is ready, false if it's not.
     * @returns true if local evaluation is ready, false if it's not.
     */
    isLocalEvaluationReady(): boolean;
}
//# sourceMappingURL=types.d.ts.map