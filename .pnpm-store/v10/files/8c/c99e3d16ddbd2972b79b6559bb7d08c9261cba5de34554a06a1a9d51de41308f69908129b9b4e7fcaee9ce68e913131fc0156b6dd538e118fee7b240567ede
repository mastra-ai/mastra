import * as http from 'node:http';

type PostHogCoreOptions = {
    /** PostHog API host, usually 'https://us.i.posthog.com' or 'https://eu.i.posthog.com' */
    host?: string;
    /** The number of events to queue before sending to PostHog (flushing) */
    flushAt?: number;
    /** The interval in milliseconds between periodic flushes */
    flushInterval?: number;
    /** The maximum number of queued messages to be flushed as part of a single batch (must be higher than `flushAt`) */
    maxBatchSize?: number;
    /** The maximum number of cached messages either in memory or on the local storage.
     * Defaults to 1000, (must be higher than `flushAt`)
     */
    maxQueueSize?: number;
    /** If set to true the SDK is essentially disabled (useful for local environments where you don't want to track anything) */
    disabled?: boolean;
    /** If set to false the SDK will not track until the `optIn` function is called. */
    defaultOptIn?: boolean;
    /** Whether to track that `getFeatureFlag` was called (used by Experiments) */
    sendFeatureFlagEvent?: boolean;
    /** Whether to load feature flags when initialized or not */
    preloadFeatureFlags?: boolean;
    /**
     * Whether to load remote config when initialized or not
     * Experimental support
     * Default: false - Remote config is loaded by default
     */
    disableRemoteConfig?: boolean;
    /**
     * Whether to load surveys when initialized or not
     * Experimental support
     * Default: false - Surveys are loaded by default, but requires the `PostHogSurveyProvider` to be used
     */
    disableSurveys?: boolean;
    /** Option to bootstrap the library with given distinctId and feature flags */
    bootstrap?: {
        distinctId?: string;
        isIdentifiedId?: boolean;
        featureFlags?: Record<string, FeatureFlagValue>;
        featureFlagPayloads?: Record<string, JsonType>;
    };
    /** How many times we will retry HTTP requests. Defaults to 3. */
    fetchRetryCount?: number;
    /** The delay between HTTP request retries, Defaults to 3 seconds. */
    fetchRetryDelay?: number;
    /** Timeout in milliseconds for any calls. Defaults to 10 seconds. */
    requestTimeout?: number;
    /** Timeout in milliseconds for feature flag calls. Defaults to 10 seconds for stateful clients, and 3 seconds for stateless. */
    featureFlagsRequestTimeoutMs?: number;
    /** Timeout in milliseconds for remote config calls. Defaults to 3 seconds. */
    remoteConfigRequestTimeoutMs?: number;
    /** For Session Analysis how long before we expire a session (defaults to 30 mins) */
    sessionExpirationTimeSeconds?: number;
    /** Whether to post events to PostHog in JSON or compressed format. Defaults to 'json' */
    captureMode?: 'json' | 'form';
    disableGeoip?: boolean;
    /** Special flag to indicate ingested data is for a historical migration. */
    historicalMigration?: boolean;
};
declare enum PostHogPersistedProperty {
    AnonymousId = "anonymous_id",
    DistinctId = "distinct_id",
    Props = "props",
    FeatureFlagDetails = "feature_flag_details",
    FeatureFlags = "feature_flags",
    FeatureFlagPayloads = "feature_flag_payloads",
    BootstrapFeatureFlagDetails = "bootstrap_feature_flag_details",
    BootstrapFeatureFlags = "bootstrap_feature_flags",
    BootstrapFeatureFlagPayloads = "bootstrap_feature_flag_payloads",
    OverrideFeatureFlags = "override_feature_flags",
    Queue = "queue",
    OptedOut = "opted_out",
    SessionId = "session_id",
    SessionStartTimestamp = "session_start_timestamp",
    SessionLastTimestamp = "session_timestamp",
    PersonProperties = "person_properties",
    GroupProperties = "group_properties",
    InstalledAppBuild = "installed_app_build",
    InstalledAppVersion = "installed_app_version",
    SessionReplay = "session_replay",
    DecideEndpointWasHit = "decide_endpoint_was_hit",
    SurveyLastSeenDate = "survey_last_seen_date",
    SurveysSeen = "surveys_seen",
    Surveys = "surveys",
    RemoteConfig = "remote_config"
}
type PostHogFetchOptions = {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    mode?: 'no-cors';
    credentials?: 'omit';
    headers: {
        [key: string]: string;
    };
    body?: string;
    signal?: AbortSignal;
};
type PostHogCaptureOptions = {
    /** If provided overrides the auto-generated event ID */
    uuid?: string;
    /** If provided overrides the auto-generated timestamp */
    timestamp?: Date;
    disableGeoip?: boolean;
};
type PostHogFetchResponse = {
    status: number;
    text: () => Promise<string>;
    json: () => Promise<any>;
};
type PostHogEventProperties = {
    [key: string]: JsonType;
};
type PostHogRemoteConfig = {
    sessionRecording?: boolean | {
        [key: string]: JsonType;
    };
    /**
     * Whether surveys are enabled
     */
    surveys?: boolean | Survey[];
    /**
     * Indicates if the team has any flags enabled (if not we don't need to load them)
     */
    hasFeatureFlags?: boolean;
};
type FeatureFlagValue = string | boolean;
type PostHogDecideResponse = Omit<PostHogRemoteConfig, 'surveys' | 'hasFeatureFlags'> & {
    featureFlags: {
        [key: string]: FeatureFlagValue;
    };
    featureFlagPayloads: {
        [key: string]: JsonType;
    };
    flags: {
        [key: string]: FeatureFlagDetail;
    };
    errorsWhileComputingFlags: boolean;
    sessionRecording?: boolean | {
        [key: string]: JsonType;
    };
    quotaLimited?: string[];
    requestId?: string;
};
/**
 * Creates a type with all properties of T, but makes only K properties required while the rest remain optional.
 *
 * @template T - The base type containing all properties
 * @template K - Union type of keys from T that should be required
 *
 * @example
 * interface User {
 *   id: number;
 *   name: string;
 *   email?: string;
 *   age?: number;
 * }
 *
 * // Makes 'id' and 'name' required, but 'email' and 'age' optional
 * type RequiredUser = PartialWithRequired<User, 'id' | 'name'>;
 *
 * const user: RequiredUser = {
 *   id: 1,      // Must be provided
 *   name: "John" // Must be provided
 *   // email and age are optional
 * };
 */
type PartialWithRequired<T, K extends keyof T> = {
    [P in K]: T[P];
} & {
    [P in Exclude<keyof T, K>]?: T[P];
};
/**
 * These are the fields we care about from PostHogDecideResponse for feature flags.
 */
type PostHogFeatureFlagDetails = PartialWithRequired<PostHogDecideResponse, 'flags' | 'featureFlags' | 'featureFlagPayloads' | 'requestId'>;
/**
 * Models legacy flags and payloads return type for many public methods.
 */
type PostHogFlagsAndPayloadsResponse = Partial<Pick<PostHogDecideResponse, 'featureFlags' | 'featureFlagPayloads'>>;
type JsonType = string | number | boolean | null | {
    [key: string]: JsonType;
} | Array<JsonType> | JsonType[];
type FeatureFlagDetail = {
    key: string;
    enabled: boolean;
    variant: string | undefined;
    reason: EvaluationReason | undefined;
    metadata: FeatureFlagMetadata | undefined;
};
type FeatureFlagMetadata = {
    id: number | undefined;
    version: number | undefined;
    description: string | undefined;
    payload: string | undefined;
};
type EvaluationReason = {
    code: string | undefined;
    condition_index: number | undefined;
    description: string | undefined;
};
type SurveyAppearance = {
    backgroundColor?: string;
    submitButtonColor?: string;
    submitButtonText?: string;
    submitButtonTextColor?: string;
    ratingButtonColor?: string;
    ratingButtonActiveColor?: string;
    autoDisappear?: boolean;
    displayThankYouMessage?: boolean;
    thankYouMessageHeader?: string;
    thankYouMessageDescription?: string;
    thankYouMessageDescriptionContentType?: SurveyQuestionDescriptionContentType;
    thankYouMessageCloseButtonText?: string;
    borderColor?: string;
    position?: SurveyPosition;
    placeholder?: string;
    shuffleQuestions?: boolean;
    surveyPopupDelaySeconds?: number;
    widgetType?: SurveyWidgetType;
    widgetSelector?: string;
    widgetLabel?: string;
    widgetColor?: string;
};
declare enum SurveyPosition {
    Left = "left",
    Right = "right",
    Center = "center"
}
declare enum SurveyWidgetType {
    Button = "button",
    Tab = "tab",
    Selector = "selector"
}
declare enum SurveyType {
    Popover = "popover",
    API = "api",
    Widget = "widget"
}
type SurveyQuestion = BasicSurveyQuestion | LinkSurveyQuestion | RatingSurveyQuestion | MultipleSurveyQuestion;
declare enum SurveyQuestionDescriptionContentType {
    Html = "html",
    Text = "text"
}
type SurveyQuestionBase = {
    question: string;
    id?: string;
    description?: string;
    descriptionContentType?: SurveyQuestionDescriptionContentType;
    optional?: boolean;
    buttonText?: string;
    originalQuestionIndex: number;
    branching?: NextQuestionBranching | EndBranching | ResponseBasedBranching | SpecificQuestionBranching;
};
type BasicSurveyQuestion = SurveyQuestionBase & {
    type: SurveyQuestionType.Open;
};
type LinkSurveyQuestion = SurveyQuestionBase & {
    type: SurveyQuestionType.Link;
    link?: string;
};
type RatingSurveyQuestion = SurveyQuestionBase & {
    type: SurveyQuestionType.Rating;
    display: SurveyRatingDisplay;
    scale: 3 | 5 | 7 | 10;
    lowerBoundLabel: string;
    upperBoundLabel: string;
};
declare enum SurveyRatingDisplay {
    Number = "number",
    Emoji = "emoji"
}
type MultipleSurveyQuestion = SurveyQuestionBase & {
    type: SurveyQuestionType.SingleChoice | SurveyQuestionType.MultipleChoice;
    choices: string[];
    hasOpenChoice?: boolean;
    shuffleOptions?: boolean;
};
declare enum SurveyQuestionType {
    Open = "open",
    MultipleChoice = "multiple_choice",
    SingleChoice = "single_choice",
    Rating = "rating",
    Link = "link"
}
declare enum SurveyQuestionBranchingType {
    NextQuestion = "next_question",
    End = "end",
    ResponseBased = "response_based",
    SpecificQuestion = "specific_question"
}
type NextQuestionBranching = {
    type: SurveyQuestionBranchingType.NextQuestion;
};
type EndBranching = {
    type: SurveyQuestionBranchingType.End;
};
type ResponseBasedBranching = {
    type: SurveyQuestionBranchingType.ResponseBased;
    responseValues: Record<string, any>;
};
type SpecificQuestionBranching = {
    type: SurveyQuestionBranchingType.SpecificQuestion;
    index: number;
};
type SurveyResponse = {
    surveys: Survey[];
};
declare enum SurveyMatchType {
    Regex = "regex",
    NotRegex = "not_regex",
    Exact = "exact",
    IsNot = "is_not",
    Icontains = "icontains",
    NotIcontains = "not_icontains"
}
type Survey = {
    id: string;
    name: string;
    description?: string;
    type: SurveyType;
    feature_flag_keys?: {
        key: string;
        value?: string;
    }[];
    linked_flag_key?: string;
    targeting_flag_key?: string;
    internal_targeting_flag_key?: string;
    questions: SurveyQuestion[];
    appearance?: SurveyAppearance;
    conditions?: {
        url?: string;
        selector?: string;
        seenSurveyWaitPeriodInDays?: number;
        urlMatchType?: SurveyMatchType;
        events?: {
            repeatedActivation?: boolean;
            values?: {
                name: string;
            }[];
        };
        actions?: {
            values: SurveyActionType[];
        };
        deviceTypes?: string[];
        deviceTypesMatchType?: SurveyMatchType;
    };
    start_date?: string;
    end_date?: string;
    current_iteration?: number;
    current_iteration_start_date?: string;
};
type SurveyActionType = {
    id: number;
    name?: string;
    steps?: ActionStepType[];
};
/** Sync with plugin-server/src/types.ts */
declare enum ActionStepStringMatching {
    Contains = "contains",
    Exact = "exact",
    Regex = "regex"
}
type ActionStepType = {
    event?: string;
    selector?: string;
    /** @deprecated Only `selector` should be used now. */
    tag_name?: string;
    text?: string;
    /** @default StringMatching.Exact */
    text_matching?: ActionStepStringMatching;
    href?: string;
    /** @default ActionStepStringMatching.Exact */
    href_matching?: ActionStepStringMatching;
    url?: string;
    /** @default StringMatching.Contains */
    url_matching?: ActionStepStringMatching;
};

declare const severityLevels: readonly ["fatal", "error", "warning", "log", "info", "debug"];
declare type SeverityLevel = (typeof severityLevels)[number];
interface EventHint {
    mechanism?: Partial<Mechanism>;
    syntheticException?: Error | null;
}
interface Mechanism {
    handled?: boolean;
    type?: string;
    source?: string;
    synthetic?: boolean;
}
type StackParser = (stack: string, skipFirstLines?: number) => StackFrame[];
type StackFrameModifierFn = (frames: StackFrame[]) => Promise<StackFrame[]>;
interface StackFrame {
    platform: string;
    filename?: string;
    function?: string;
    module?: string;
    lineno?: number;
    colno?: number;
    abs_path?: string;
    context_line?: string;
    pre_context?: string[];
    post_context?: string[];
    in_app?: boolean;
    instruction_addr?: string;
    addr_mode?: string;
    vars?: {
        [key: string]: JsonType;
    };
    chunk_id?: string;
}

interface RetriableOptions {
    retryCount: number;
    retryDelay: number;
    retryCheck: (err: unknown) => boolean;
}

declare class SimpleEventEmitter {
    events: {
        [key: string]: ((...args: any[]) => void)[];
    };
    constructor();
    on(event: string, listener: (...args: any[]) => void): () => void;
    emit(event: string, payload: any): void;
}

declare abstract class PostHogCoreStateless {
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
    private captureMode;
    private removeDebugCallback?;
    private disableGeoip;
    private historicalMigration;
    protected disabled: boolean;
    private defaultOptIn;
    private pendingPromises;
    protected _events: SimpleEventEmitter;
    protected _flushTimer?: any;
    protected _retryOptions: RetriableOptions;
    protected _initPromise: Promise<void>;
    protected _isInitialized: boolean;
    protected _remoteConfigResponsePromise?: Promise<PostHogRemoteConfig | undefined>;
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
    debug(enabled?: boolean): void;
    get isDebug(): boolean;
    get isDisabled(): boolean;
    private buildPayload;
    protected addPendingPromise<T>(promise: Promise<T>): Promise<T>;
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
    protected getDecide(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, extraPayload?: Record<string, any>): Promise<PostHogDecideResponse | undefined>;
    protected getFeatureFlagStateless(key: string, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean): Promise<{
        response: FeatureFlagValue | undefined;
        requestId: string | undefined;
    }>;
    protected getFeatureFlagDetailStateless(key: string, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean): Promise<{
        response: FeatureFlagDetail | undefined;
        requestId: string | undefined;
    } | undefined>;
    protected getFeatureFlagPayloadStateless(key: string, distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean): Promise<JsonType | undefined>;
    protected getFeatureFlagPayloadsStateless(distinctId: string, groups?: Record<string, string>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<PostHogDecideResponse['featureFlagPayloads'] | undefined>;
    protected getFeatureFlagsStateless(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<{
        flags: PostHogDecideResponse['featureFlags'] | undefined;
        payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined;
        requestId: PostHogDecideResponse['requestId'] | undefined;
    }>;
    protected getFeatureFlagsAndPayloadsStateless(distinctId: string, groups?: Record<string, string | number>, personProperties?: Record<string, string>, groupProperties?: Record<string, Record<string, string>>, disableGeoip?: boolean, flagKeysToEvaluate?: string[]): Promise<{
        flags: PostHogDecideResponse['featureFlags'] | undefined;
        payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined;
        requestId: PostHogDecideResponse['requestId'] | undefined;
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
     * Flushes the queue
     *
     * This function will return a promise that will resolve when the flush is complete,
     * or reject if there was an error (for example if the server or network is down).
     *
     * If there is already a flush in progress, this function will wait for that flush to complete.
     *
     * It's recommended to do error handling in the callback of the promise.
     *
     * @example
     * posthog.flush().then(() => {
     *   console.log('Flush complete')
     * }).catch((err) => {
     *   console.error('Flush failed', err)
     * })
     *
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
     *  Call shutdown() once before the node process exits, so ensure that all events have been sent and all promises
     *  have resolved. Do not use this function if you intend to keep using this PostHog instance after calling it.
     * @param shutdownTimeoutMs
     */
    shutdown(shutdownTimeoutMs?: number): Promise<void>;
}

interface IdentifyMessage {
    distinctId: string;
    properties?: Record<string | number, any>;
    disableGeoip?: boolean;
}
interface EventMessage extends IdentifyMessage {
    event: string;
    groups?: Record<string, string | number>;
    sendFeatureFlags?: boolean;
    timestamp?: Date;
    uuid?: string;
}
interface GroupIdentifyMessage {
    groupType: string;
    groupKey: string;
    properties?: Record<string | number, any>;
    distinctId?: string;
    disableGeoip?: boolean;
}
type PropertyGroup = {
    type: 'AND' | 'OR';
    values: PropertyGroup[] | FlagProperty[];
};
type FlagProperty = {
    key: string;
    type?: string;
    value: string | number | (string | number)[];
    operator?: string;
    negation?: boolean;
};
type FeatureFlagCondition = {
    properties: FlagProperty[];
    rollout_percentage?: number;
    variant?: string;
};
type PostHogOptions = PostHogCoreOptions & {
    persistence?: 'memory';
    personalApiKey?: string;
    privacyMode?: boolean;
    enableExceptionAutocapture?: boolean;
    featureFlagsPollingInterval?: number;
    maxCacheSize?: number;
    fetch?: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>;
};
type PostHogFeatureFlag = {
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
    /** @deprecated This field will be removed in a future version. **/
    is_simple_flag: boolean;
    rollout_percentage: null | number;
    ensure_experience_continuity: boolean;
    experiment_set: number[];
};
interface IPostHog {
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

declare class ErrorTracking {
    private client;
    private _exceptionAutocaptureEnabled;
    static stackParser: StackParser;
    static frameModifiers: StackFrameModifierFn[];
    static captureException(client: PostHogBackendClient, error: unknown, hint: EventHint, distinctId?: string, additionalProperties?: Record<string | number, any>): Promise<void>;
    constructor(client: PostHogBackendClient, options: PostHogOptions);
    private startAutocaptureIfEnabled;
    private onException;
    private onFatalError;
    isEnabled(): boolean;
}

declare abstract class PostHogBackendClient extends PostHogCoreStateless implements IPostHog {
    private _memoryStorage;
    private featureFlagsPoller?;
    protected errorTracking: ErrorTracking;
    private maxCacheSize;
    readonly options: PostHogOptions;
    distinctIdHasSentFlagCalls: Record<string, string[]>;
    constructor(apiKey: string, options?: PostHogOptions);
    getPersistedProperty(key: PostHogPersistedProperty): any | undefined;
    setPersistedProperty(key: PostHogPersistedProperty, value: any | null): void;
    fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse>;
    getLibraryVersion(): string;
    getCustomUserAgent(): string;
    enable(): Promise<void>;
    disable(): Promise<void>;
    debug(enabled?: boolean): void;
    capture(props: EventMessage): void;
    captureImmediate(props: EventMessage): Promise<void>;
    identify({ distinctId, properties, disableGeoip }: IdentifyMessage): void;
    identifyImmediate({ distinctId, properties, disableGeoip }: IdentifyMessage): Promise<void>;
    alias(data: {
        distinctId: string;
        alias: string;
        disableGeoip?: boolean;
    }): void;
    aliasImmediate(data: {
        distinctId: string;
        alias: string;
        disableGeoip?: boolean;
    }): Promise<void>;
    isLocalEvaluationReady(): boolean;
    waitForLocalEvaluationReady(timeoutMs?: number): Promise<boolean>;
    getFeatureFlag(key: string, distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        sendFeatureFlagEvents?: boolean;
        disableGeoip?: boolean;
    }): Promise<FeatureFlagValue | undefined>;
    getFeatureFlagPayload(key: string, distinctId: string, matchValue?: FeatureFlagValue, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        sendFeatureFlagEvents?: boolean;
        disableGeoip?: boolean;
    }): Promise<JsonType | undefined>;
    getRemoteConfigPayload(flagKey: string): Promise<JsonType | undefined>;
    isFeatureEnabled(key: string, distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        sendFeatureFlagEvents?: boolean;
        disableGeoip?: boolean;
    }): Promise<boolean | undefined>;
    getAllFlags(distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        disableGeoip?: boolean;
    }): Promise<Record<string, FeatureFlagValue>>;
    getAllFlagsAndPayloads(distinctId: string, options?: {
        groups?: Record<string, string>;
        personProperties?: Record<string, string>;
        groupProperties?: Record<string, Record<string, string>>;
        onlyEvaluateLocally?: boolean;
        disableGeoip?: boolean;
    }): Promise<PostHogFlagsAndPayloadsResponse>;
    groupIdentify({ groupType, groupKey, properties, distinctId, disableGeoip }: GroupIdentifyMessage): void;
    /**
     * Reloads the feature flag definitions from the server for local evaluation.
     * This is useful to call if you want to ensure that the feature flags are up to date before calling getFeatureFlag.
     */
    reloadFeatureFlags(): Promise<void>;
    _shutdown(shutdownTimeoutMs?: number): Promise<void>;
    private addLocalPersonAndGroupProperties;
    captureException(error: unknown, distinctId?: string, additionalProperties?: Record<string | number, any>): void;
}

/**
 * @file Adapted from [posthog-js](https://github.com/PostHog/posthog-js/blob/8157df935a4d0e71d2fefef7127aa85ee51c82d1/src/extensions/sentry-integration.ts) with modifications for the Node SDK.
 */

type _SentryEvent = any;
type _SentryEventProcessor = any;
type _SentryHub = any;
interface _SentryIntegration {
    name: string;
    processEvent(event: _SentryEvent): _SentryEvent;
}
interface _SentryIntegrationClass {
    name: string;
    setupOnce(addGlobalEventProcessor: (callback: _SentryEventProcessor) => void, getCurrentHub: () => _SentryHub): void;
}
type SentryIntegrationOptions = {
    organization?: string;
    projectId?: number;
    prefix?: string;
    severityAllowList?: SeverityLevel[] | '*';
};
declare function createEventProcessor(_posthog: PostHogBackendClient, { organization, projectId, prefix, severityAllowList }?: SentryIntegrationOptions): (event: _SentryEvent) => _SentryEvent;
declare function sentryIntegration(_posthog: PostHogBackendClient, options?: SentryIntegrationOptions): _SentryIntegration;
declare class PostHogSentryIntegration implements _SentryIntegrationClass {
    readonly name = "posthog-node";
    static readonly POSTHOG_ID_TAG = "posthog_distinct_id";
    setupOnce: (addGlobalEventProcessor: (callback: _SentryEventProcessor) => void, getCurrentHub: () => _SentryHub) => void;
    constructor(_posthog: PostHogBackendClient, organization?: string, prefix?: string, severityAllowList?: SeverityLevel[] | '*');
}

type ExpressMiddleware = (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;
type ExpressErrorMiddleware = (error: MiddlewareError, req: http.IncomingMessage, res: http.ServerResponse, next: (error: MiddlewareError) => void) => void;
interface MiddlewareError extends Error {
    status?: number | string;
    statusCode?: number | string;
    status_code?: number | string;
    output?: {
        statusCode?: number | string;
    };
}
declare function setupExpressErrorHandler(_posthog: PostHogBackendClient, app: {
    use: (middleware: ExpressMiddleware | ExpressErrorMiddleware) => unknown;
}): void;

declare class PostHog extends PostHogBackendClient {
    getLibraryId(): string;
}

export { EventMessage, FeatureFlagCondition, FlagProperty, GroupIdentifyMessage, IPostHog, IdentifyMessage, PostHog, PostHogFeatureFlag, PostHogOptions, PostHogSentryIntegration, PropertyGroup, SentryIntegrationOptions, createEventProcessor, sentryIntegration, setupExpressErrorHandler };
