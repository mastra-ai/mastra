import { LangfuseCoreOptions, LangfuseCore, LangfusePersistedProperty, LangfuseFetchOptions, LangfuseFetchResponse, LangfuseWebStateless, LangfuseTraceClient, LangfuseSpanClient, LangfuseGenerationClient, LangfusePromptClient, CreateLangfuseTraceBody, CreateLangfuseGenerationBody } from 'langfuse-core';
export { ChatPromptClient, LangfuseEventClient, LangfuseGenerationClient, LangfuseMedia, LangfusePromptClient, LangfusePromptRecord, LangfuseSpanClient, LangfuseTraceClient, TextPromptClient } from 'langfuse-core';
import OpenAI from 'openai';

/** AnnotationQueueStatus */
type ApiAnnotationQueueStatus = "PENDING" | "COMPLETED";
/** AnnotationQueueObjectType */
type ApiAnnotationQueueObjectType = "TRACE" | "OBSERVATION";
/** AnnotationQueue */
interface ApiAnnotationQueue {
    id: string;
    name: string;
    description?: string | null;
    scoreConfigIds: string[];
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    updatedAt: string;
}
/** AnnotationQueueItem */
interface ApiAnnotationQueueItem {
    id: string;
    queueId: string;
    objectId: string;
    objectType: ApiAnnotationQueueObjectType;
    status: ApiAnnotationQueueStatus;
    /** @format date-time */
    completedAt?: string | null;
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    updatedAt: string;
}
/** PaginatedAnnotationQueues */
interface ApiPaginatedAnnotationQueues {
    data: ApiAnnotationQueue[];
    meta: ApiUtilsMetaResponse;
}
/** PaginatedAnnotationQueueItems */
interface ApiPaginatedAnnotationQueueItems {
    data: ApiAnnotationQueueItem[];
    meta: ApiUtilsMetaResponse;
}
/** CreateAnnotationQueueItemRequest */
interface ApiCreateAnnotationQueueItemRequest {
    objectId: string;
    objectType: ApiAnnotationQueueObjectType;
    /** Defaults to PENDING for new queue items */
    status?: ApiAnnotationQueueStatus | null;
}
/** UpdateAnnotationQueueItemRequest */
interface ApiUpdateAnnotationQueueItemRequest {
    status?: ApiAnnotationQueueStatus | null;
}
/** DeleteAnnotationQueueItemResponse */
interface ApiDeleteAnnotationQueueItemResponse {
    success: boolean;
    message: string;
}
/** CreateCommentRequest */
interface ApiCreateCommentRequest {
    /** The id of the project to attach the comment to. */
    projectId: string;
    /** The type of the object to attach the comment to (trace, observation, session, prompt). */
    objectType: string;
    /** The id of the object to attach the comment to. If this does not reference a valid existing object, an error will be thrown. */
    objectId: string;
    /** The content of the comment. May include markdown. Currently limited to 3000 characters. */
    content: string;
    /** The id of the user who created the comment. */
    authorUserId?: string | null;
}
/** CreateCommentResponse */
interface ApiCreateCommentResponse {
    /** The id of the created object in Langfuse */
    id: string;
}
/** GetCommentsResponse */
interface ApiGetCommentsResponse {
    data: ApiComment[];
    meta: ApiUtilsMetaResponse;
}
/** Trace */
interface ApiTrace {
    /** The unique identifier of a trace */
    id: string;
    /**
     * The timestamp when the trace was created
     * @format date-time
     */
    timestamp: string;
    /** The name of the trace */
    name?: string | null;
    /** The input data of the trace. Can be any JSON. */
    input?: any;
    /** The output data of the trace. Can be any JSON. */
    output?: any;
    /** The session identifier associated with the trace */
    sessionId?: string | null;
    /** The release version of the application when the trace was created */
    release?: string | null;
    /** The version of the trace */
    version?: string | null;
    /** The user identifier associated with the trace */
    userId?: string | null;
    /** The metadata associated with the trace. Can be any JSON. */
    metadata?: any;
    /** The tags associated with the trace. Can be an array of strings or null. */
    tags?: string[] | null;
    /** Public traces are accessible via url without login */
    public?: boolean | null;
    /** The environment from which this trace originated. Can be any lowercase alphanumeric string with hyphens and underscores that does not start with 'langfuse'. */
    environment?: string | null;
}
/** TraceWithDetails */
type ApiTraceWithDetails = ApiTrace & {
    /** Path of trace in Langfuse UI */
    htmlPath: string;
    /**
     * Latency of trace in seconds
     * @format double
     */
    latency: number;
    /**
     * Cost of trace in USD
     * @format double
     */
    totalCost: number;
    /** List of observation ids */
    observations: string[];
    /** List of score ids */
    scores: string[];
};
/** TraceWithFullDetails */
type ApiTraceWithFullDetails = ApiTrace & {
    /** Path of trace in Langfuse UI */
    htmlPath: string;
    /**
     * Latency of trace in seconds
     * @format double
     */
    latency: number;
    /**
     * Cost of trace in USD
     * @format double
     */
    totalCost: number;
    /** List of observations */
    observations: ApiObservationsView[];
    /** List of scores */
    scores: ApiScoreV1[];
};
/** Session */
interface ApiSession {
    id: string;
    /** @format date-time */
    createdAt: string;
    projectId: string;
    /** The environment from which this session originated. */
    environment?: string | null;
}
/** SessionWithTraces */
type ApiSessionWithTraces = ApiSession & {
    traces: ApiTrace[];
};
/** Observation */
interface ApiObservation {
    /** The unique identifier of the observation */
    id: string;
    /** The trace ID associated with the observation */
    traceId?: string | null;
    /** The type of the observation */
    type: string;
    /** The name of the observation */
    name?: string | null;
    /**
     * The start time of the observation
     * @format date-time
     */
    startTime: string;
    /**
     * The end time of the observation.
     * @format date-time
     */
    endTime?: string | null;
    /**
     * The completion start time of the observation
     * @format date-time
     */
    completionStartTime?: string | null;
    /** The model used for the observation */
    model?: string | null;
    /** The parameters of the model used for the observation */
    modelParameters?: Record<string, ApiMapValue>;
    /** The input data of the observation */
    input?: any;
    /** The version of the observation */
    version?: string | null;
    /** Additional metadata of the observation */
    metadata?: any;
    /** The output data of the observation */
    output?: any;
    /** (Deprecated. Use usageDetails and costDetails instead.) The usage data of the observation */
    usage?: ApiUsage | null;
    /** The level of the observation */
    level: ApiObservationLevel;
    /** The status message of the observation */
    statusMessage?: string | null;
    /** The parent observation ID */
    parentObservationId?: string | null;
    /** The prompt ID associated with the observation */
    promptId?: string | null;
    /** The usage details of the observation. Key is the name of the usage metric, value is the number of units consumed. The total key is the sum of all (non-total) usage metrics or the total value ingested. */
    usageDetails?: Record<string, number>;
    /** The cost details of the observation. Key is the name of the cost metric, value is the cost in USD. The total key is the sum of all (non-total) cost metrics or the total value ingested. */
    costDetails?: Record<string, number>;
    /** The environment from which this observation originated. Can be any lowercase alphanumeric string with hyphens and underscores that does not start with 'langfuse'. */
    environment?: string | null;
}
/** ObservationsView */
type ApiObservationsView = ApiObservation & {
    /** The name of the prompt associated with the observation */
    promptName?: string | null;
    /** The version of the prompt associated with the observation */
    promptVersion?: number | null;
    /** The unique identifier of the model */
    modelId?: string | null;
    /**
     * The price of the input in USD
     * @format double
     */
    inputPrice?: number | null;
    /**
     * The price of the output in USD.
     * @format double
     */
    outputPrice?: number | null;
    /**
     * The total price in USD.
     * @format double
     */
    totalPrice?: number | null;
    /**
     * (Deprecated. Use usageDetails and costDetails instead.) The calculated cost of the input in USD
     * @format double
     */
    calculatedInputCost?: number | null;
    /**
     * (Deprecated. Use usageDetails and costDetails instead.) The calculated cost of the output in USD
     * @format double
     */
    calculatedOutputCost?: number | null;
    /**
     * (Deprecated. Use usageDetails and costDetails instead.) The calculated total cost in USD
     * @format double
     */
    calculatedTotalCost?: number | null;
    /**
     * The latency in seconds.
     * @format double
     */
    latency?: number | null;
    /**
     * The time to the first token in seconds
     * @format double
     */
    timeToFirstToken?: number | null;
};
/**
 * Usage
 * (Deprecated. Use usageDetails and costDetails instead.) Standard interface for usage and cost
 */
interface ApiUsage {
    /** Number of input units (e.g. tokens) */
    input?: number | null;
    /** Number of output units (e.g. tokens) */
    output?: number | null;
    /** Defaults to input+output if not set */
    total?: number | null;
    /** Unit of usage in Langfuse */
    unit?: ApiModelUsageUnit | null;
    /**
     * USD input cost
     * @format double
     */
    inputCost?: number | null;
    /**
     * USD output cost
     * @format double
     */
    outputCost?: number | null;
    /**
     * USD total cost, defaults to input+output
     * @format double
     */
    totalCost?: number | null;
}
/**
 * ScoreConfig
 * Configuration for a score
 */
interface ApiScoreConfig {
    id: string;
    name: string;
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    updatedAt: string;
    projectId: string;
    dataType: ApiScoreDataType;
    /** Whether the score config is archived. Defaults to false */
    isArchived: boolean;
    /**
     * Sets minimum value for numerical scores. If not set, the minimum value defaults to -∞
     * @format double
     */
    minValue?: number | null;
    /**
     * Sets maximum value for numerical scores. If not set, the maximum value defaults to +∞
     * @format double
     */
    maxValue?: number | null;
    /** Configures custom categories for categorical scores */
    categories?: ApiConfigCategory[] | null;
    description?: string | null;
}
/** ConfigCategory */
interface ApiConfigCategory {
    /** @format double */
    value: number;
    label: string;
}
/** BaseScoreV1 */
interface ApiBaseScoreV1 {
    id: string;
    traceId: string;
    name: string;
    source: ApiScoreSource;
    observationId?: string | null;
    /** @format date-time */
    timestamp: string;
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    updatedAt: string;
    authorUserId?: string | null;
    comment?: string | null;
    metadata?: any;
    /** Reference a score config on a score. When set, config and score name must be equal and value must comply to optionally defined numerical range */
    configId?: string | null;
    /** Reference an annotation queue on a score. Populated if the score was initially created in an annotation queue. */
    queueId?: string | null;
    /** The environment from which this score originated. Can be any lowercase alphanumeric string with hyphens and underscores that does not start with 'langfuse'. */
    environment?: string | null;
}
/** NumericScoreV1 */
type ApiNumericScoreV1 = ApiBaseScoreV1 & {
    /**
     * The numeric value of the score
     * @format double
     */
    value: number;
};
/** BooleanScoreV1 */
type ApiBooleanScoreV1 = ApiBaseScoreV1 & {
    /**
     * The numeric value of the score. Equals 1 for "True" and 0 for "False"
     * @format double
     */
    value: number;
    /** The string representation of the score value. Is inferred from the numeric value and equals "True" or "False" */
    stringValue: string;
};
/** CategoricalScoreV1 */
type ApiCategoricalScoreV1 = ApiBaseScoreV1 & {
    /**
     * Only defined if a config is linked. Represents the numeric category mapping of the stringValue
     * @format double
     */
    value?: number | null;
    /** The string representation of the score value. If no config is linked, can be any string. Otherwise, must map to a config category */
    stringValue: string;
};
/** ScoreV1 */
type ApiScoreV1 = ({
    dataType: "NUMERIC";
} & ApiNumericScoreV1) | ({
    dataType: "CATEGORICAL";
} & ApiCategoricalScoreV1) | ({
    dataType: "BOOLEAN";
} & ApiBooleanScoreV1);
/** BaseScore */
interface ApiBaseScore {
    id: string;
    traceId?: string | null;
    sessionId?: string | null;
    observationId?: string | null;
    datasetRunId?: string | null;
    name: string;
    source: ApiScoreSource;
    /** @format date-time */
    timestamp: string;
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    updatedAt: string;
    authorUserId?: string | null;
    comment?: string | null;
    metadata?: any;
    /** Reference a score config on a score. When set, config and score name must be equal and value must comply to optionally defined numerical range */
    configId?: string | null;
    /** Reference an annotation queue on a score. Populated if the score was initially created in an annotation queue. */
    queueId?: string | null;
    /** The environment from which this score originated. Can be any lowercase alphanumeric string with hyphens and underscores that does not start with 'langfuse'. */
    environment?: string | null;
}
/** NumericScore */
type ApiNumericScore = ApiBaseScore & {
    /**
     * The numeric value of the score
     * @format double
     */
    value: number;
};
/** BooleanScore */
type ApiBooleanScore = ApiBaseScore & {
    /**
     * The numeric value of the score. Equals 1 for "True" and 0 for "False"
     * @format double
     */
    value: number;
    /** The string representation of the score value. Is inferred from the numeric value and equals "True" or "False" */
    stringValue: string;
};
/** CategoricalScore */
type ApiCategoricalScore = ApiBaseScore & {
    /**
     * Only defined if a config is linked. Represents the numeric category mapping of the stringValue
     * @format double
     */
    value?: number | null;
    /** The string representation of the score value. If no config is linked, can be any string. Otherwise, must map to a config category */
    stringValue: string;
};
/** Score */
type ApiScore = ({
    dataType: "NUMERIC";
} & ApiNumericScore) | ({
    dataType: "CATEGORICAL";
} & ApiCategoricalScore) | ({
    dataType: "BOOLEAN";
} & ApiBooleanScore);
/**
 * CreateScoreValue
 * The value of the score. Must be passed as string for categorical scores, and numeric for boolean and numeric scores
 */
type ApiCreateScoreValue = number | string;
/** Comment */
interface ApiComment {
    id: string;
    projectId: string;
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    updatedAt: string;
    objectType: ApiCommentObjectType;
    objectId: string;
    content: string;
    authorUserId?: string | null;
}
/** Dataset */
interface ApiDataset {
    id: string;
    name: string;
    description?: string | null;
    metadata?: any;
    projectId: string;
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    updatedAt: string;
}
/** DatasetItem */
interface ApiDatasetItem {
    id: string;
    status: ApiDatasetStatus;
    input?: any;
    expectedOutput?: any;
    metadata?: any;
    sourceTraceId?: string | null;
    sourceObservationId?: string | null;
    datasetId: string;
    datasetName: string;
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    updatedAt: string;
}
/** DatasetRunItem */
interface ApiDatasetRunItem {
    id: string;
    datasetRunId: string;
    datasetRunName: string;
    datasetItemId: string;
    traceId: string;
    observationId?: string | null;
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    updatedAt: string;
}
/** DatasetRun */
interface ApiDatasetRun {
    /** Unique identifier of the dataset run */
    id: string;
    /** Name of the dataset run */
    name: string;
    /** Description of the run */
    description?: string | null;
    /** Metadata of the dataset run */
    metadata?: any;
    /** Id of the associated dataset */
    datasetId: string;
    /** Name of the associated dataset */
    datasetName: string;
    /**
     * The date and time when the dataset run was created
     * @format date-time
     */
    createdAt: string;
    /**
     * The date and time when the dataset run was last updated
     * @format date-time
     */
    updatedAt: string;
}
/** DatasetRunWithItems */
type ApiDatasetRunWithItems = ApiDatasetRun & {
    datasetRunItems: ApiDatasetRunItem[];
};
/**
 * Model
 * Model definition used for transforming usage into USD cost and/or tokenization.
 */
interface ApiModel {
    id: string;
    /** Name of the model definition. If multiple with the same name exist, they are applied in the following order: (1) custom over built-in, (2) newest according to startTime where model.startTime<observation.startTime */
    modelName: string;
    /** Regex pattern which matches this model definition to generation.model. Useful in case of fine-tuned models. If you want to exact match, use `(?i)^modelname$` */
    matchPattern: string;
    /**
     * Apply only to generations which are newer than this ISO date.
     * @format date-time
     */
    startDate?: string | null;
    /** Unit used by this model. */
    unit?: ApiModelUsageUnit | null;
    /**
     * Deprecated. See 'prices' instead. Price (USD) per input unit
     * @format double
     */
    inputPrice?: number | null;
    /**
     * Deprecated. See 'prices' instead. Price (USD) per output unit
     * @format double
     */
    outputPrice?: number | null;
    /**
     * Deprecated. See 'prices' instead. Price (USD) per total unit. Cannot be set if input or output price is set.
     * @format double
     */
    totalPrice?: number | null;
    /** Optional. Tokenizer to be applied to observations which match to this model. See docs for more details. */
    tokenizerId?: string | null;
    /** Optional. Configuration for the selected tokenizer. Needs to be JSON. See docs for more details. */
    tokenizerConfig?: any;
    isLangfuseManaged: boolean;
    /** Price (USD) by usage type */
    prices: Record<string, ApiModelPrice>;
}
/** ModelPrice */
interface ApiModelPrice {
    /** @format double */
    price: number;
}
/**
 * ModelUsageUnit
 * Unit of usage in Langfuse
 */
type ApiModelUsageUnit = "CHARACTERS" | "TOKENS" | "MILLISECONDS" | "SECONDS" | "IMAGES" | "REQUESTS";
/** ObservationLevel */
type ApiObservationLevel = "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
/** MapValue */
type ApiMapValue = string | null | number | null | boolean | null | string[] | null;
/** CommentObjectType */
type ApiCommentObjectType = "TRACE" | "OBSERVATION" | "SESSION" | "PROMPT";
/** DatasetStatus */
type ApiDatasetStatus = "ACTIVE" | "ARCHIVED";
/** ScoreSource */
type ApiScoreSource = "ANNOTATION" | "API" | "EVAL";
/** ScoreDataType */
type ApiScoreDataType = "NUMERIC" | "BOOLEAN" | "CATEGORICAL";
/** DeleteDatasetItemResponse */
interface ApiDeleteDatasetItemResponse {
    /** Success message after deletion */
    message: string;
}
/** CreateDatasetItemRequest */
interface ApiCreateDatasetItemRequest {
    datasetName: string;
    input?: any;
    expectedOutput?: any;
    metadata?: any;
    sourceTraceId?: string | null;
    sourceObservationId?: string | null;
    /** Dataset items are upserted on their id. Id needs to be unique (project-level) and cannot be reused across datasets. */
    id?: string | null;
    /** Defaults to ACTIVE for newly created items */
    status?: ApiDatasetStatus | null;
}
/** PaginatedDatasetItems */
interface ApiPaginatedDatasetItems {
    data: ApiDatasetItem[];
    meta: ApiUtilsMetaResponse;
}
/** CreateDatasetRunItemRequest */
interface ApiCreateDatasetRunItemRequest {
    runName: string;
    /** Description of the run. If run exists, description will be updated. */
    runDescription?: string | null;
    /** Metadata of the dataset run, updates run if run already exists */
    metadata?: any;
    datasetItemId: string;
    observationId?: string | null;
    /** traceId should always be provided. For compatibility with older SDK versions it can also be inferred from the provided observationId. */
    traceId?: string | null;
}
/** PaginatedDatasetRunItems */
interface ApiPaginatedDatasetRunItems {
    data: ApiDatasetRunItem[];
    meta: ApiUtilsMetaResponse;
}
/** PaginatedDatasets */
interface ApiPaginatedDatasets {
    data: ApiDataset[];
    meta: ApiUtilsMetaResponse;
}
/** CreateDatasetRequest */
interface ApiCreateDatasetRequest {
    name: string;
    description?: string | null;
    metadata?: any;
}
/** PaginatedDatasetRuns */
interface ApiPaginatedDatasetRuns {
    data: ApiDatasetRun[];
    meta: ApiUtilsMetaResponse;
}
/** DeleteDatasetRunResponse */
interface ApiDeleteDatasetRunResponse {
    message: string;
}
/** HealthResponse */
interface ApiHealthResponse {
    /**
     * Langfuse server version
     * @example "1.25.0"
     */
    version: string;
    /** @example "OK" */
    status: string;
}
/** IngestionEvent */
type ApiIngestionEvent = ({
    type: "trace-create";
} & ApiTraceEvent) | ({
    type: "score-create";
} & ApiScoreEvent) | ({
    type: "span-create";
} & ApiCreateSpanEvent) | ({
    type: "span-update";
} & ApiUpdateSpanEvent) | ({
    type: "generation-create";
} & ApiCreateGenerationEvent) | ({
    type: "generation-update";
} & ApiUpdateGenerationEvent) | ({
    type: "event-create";
} & ApiCreateEventEvent) | ({
    type: "sdk-log";
} & ApiSDKLogEvent) | ({
    type: "observation-create";
} & ApiCreateObservationEvent) | ({
    type: "observation-update";
} & ApiUpdateObservationEvent);
/** ObservationType */
type ApiObservationType = "SPAN" | "GENERATION" | "EVENT";
/** IngestionUsage */
type ApiIngestionUsage = ApiUsage | ApiOpenAIUsage;
/**
 * OpenAIUsage
 * Usage interface of OpenAI for improved compatibility.
 */
interface ApiOpenAIUsage {
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
}
/** OptionalObservationBody */
interface ApiOptionalObservationBody {
    traceId?: string | null;
    name?: string | null;
    /** @format date-time */
    startTime?: string | null;
    metadata?: any;
    input?: any;
    output?: any;
    level?: ApiObservationLevel | null;
    statusMessage?: string | null;
    parentObservationId?: string | null;
    version?: string | null;
    environment?: string | null;
}
/** CreateEventBody */
type ApiCreateEventBody = ApiOptionalObservationBody & {
    id?: string | null;
};
/** UpdateEventBody */
type ApiUpdateEventBody = ApiOptionalObservationBody & {
    id: string;
};
/** CreateSpanBody */
type ApiCreateSpanBody = ApiCreateEventBody & {
    /** @format date-time */
    endTime?: string | null;
};
/** UpdateSpanBody */
type ApiUpdateSpanBody = ApiUpdateEventBody & {
    /** @format date-time */
    endTime?: string | null;
};
/** CreateGenerationBody */
type ApiCreateGenerationBody = ApiCreateSpanBody & {
    /** @format date-time */
    completionStartTime?: string | null;
    model?: string | null;
    modelParameters?: Record<string, ApiMapValue>;
    usage?: ApiIngestionUsage | null;
    usageDetails?: ApiUsageDetails | null;
    costDetails?: Record<string, number>;
    promptName?: string | null;
    promptVersion?: number | null;
};
/** UpdateGenerationBody */
type ApiUpdateGenerationBody = ApiUpdateSpanBody & {
    /** @format date-time */
    completionStartTime?: string | null;
    model?: string | null;
    modelParameters?: Record<string, ApiMapValue>;
    usage?: ApiIngestionUsage | null;
    promptName?: string | null;
    usageDetails?: ApiUsageDetails | null;
    costDetails?: Record<string, number>;
    promptVersion?: number | null;
};
/** ObservationBody */
interface ApiObservationBody {
    id?: string | null;
    traceId?: string | null;
    type: ApiObservationType;
    name?: string | null;
    /** @format date-time */
    startTime?: string | null;
    /** @format date-time */
    endTime?: string | null;
    /** @format date-time */
    completionStartTime?: string | null;
    model?: string | null;
    modelParameters?: Record<string, ApiMapValue>;
    input?: any;
    version?: string | null;
    metadata?: any;
    output?: any;
    /** (Deprecated. Use usageDetails and costDetails instead.) Standard interface for usage and cost */
    usage?: ApiUsage | null;
    level?: ApiObservationLevel | null;
    statusMessage?: string | null;
    parentObservationId?: string | null;
    environment?: string | null;
}
/** TraceBody */
interface ApiTraceBody {
    id?: string | null;
    /** @format date-time */
    timestamp?: string | null;
    name?: string | null;
    userId?: string | null;
    input?: any;
    output?: any;
    sessionId?: string | null;
    release?: string | null;
    version?: string | null;
    metadata?: any;
    tags?: string[] | null;
    environment?: string | null;
    /** Make trace publicly accessible via url */
    public?: boolean | null;
}
/** SDKLogBody */
interface ApiSDKLogBody {
    log: any;
}
/** ScoreBody */
interface ApiScoreBody {
    id?: string | null;
    traceId?: string | null;
    sessionId?: string | null;
    observationId?: string | null;
    datasetRunId?: string | null;
    /** @example "novelty" */
    name: string;
    environment?: string | null;
    /** The value of the score. Must be passed as string for categorical scores, and numeric for boolean and numeric scores. Boolean score values must equal either 1 or 0 (true or false) */
    value: ApiCreateScoreValue;
    comment?: string | null;
    metadata?: any;
    /** When set, must match the score value's type. If not set, will be inferred from the score value or config */
    dataType?: ApiScoreDataType | null;
    /** Reference a score config on a score. When set, the score name must equal the config name and scores must comply with the config's range and data type. For categorical scores, the value must map to a config category. Numeric scores might be constrained by the score config's max and min values */
    configId?: string | null;
}
/** BaseEvent */
interface ApiBaseEvent {
    /** UUID v4 that identifies the event */
    id: string;
    /** Datetime (ISO 8601) of event creation in client. Should be as close to actual event creation in client as possible, this timestamp will be used for ordering of events in future release. Resolution: milliseconds (required), microseconds (optimal). */
    timestamp: string;
    /** Optional. Metadata field used by the Langfuse SDKs for debugging. */
    metadata?: any;
}
/** TraceEvent */
type ApiTraceEvent = ApiBaseEvent & {
    body: ApiTraceBody;
};
/** CreateObservationEvent */
type ApiCreateObservationEvent = ApiBaseEvent & {
    body: ApiObservationBody;
};
/** UpdateObservationEvent */
type ApiUpdateObservationEvent = ApiBaseEvent & {
    body: ApiObservationBody;
};
/** ScoreEvent */
type ApiScoreEvent = ApiBaseEvent & {
    body: ApiScoreBody;
};
/** SDKLogEvent */
type ApiSDKLogEvent = ApiBaseEvent & {
    body: ApiSDKLogBody;
};
/** CreateGenerationEvent */
type ApiCreateGenerationEvent = ApiBaseEvent & {
    body: ApiCreateGenerationBody;
};
/** UpdateGenerationEvent */
type ApiUpdateGenerationEvent = ApiBaseEvent & {
    body: ApiUpdateGenerationBody;
};
/** CreateSpanEvent */
type ApiCreateSpanEvent = ApiBaseEvent & {
    body: ApiCreateSpanBody;
};
/** UpdateSpanEvent */
type ApiUpdateSpanEvent = ApiBaseEvent & {
    body: ApiUpdateSpanBody;
};
/** CreateEventEvent */
type ApiCreateEventEvent = ApiBaseEvent & {
    body: ApiCreateEventBody;
};
/** IngestionSuccess */
interface ApiIngestionSuccess {
    id: string;
    status: number;
}
/** IngestionError */
interface ApiIngestionError {
    id: string;
    status: number;
    message?: string | null;
    error?: any;
}
/** IngestionResponse */
interface ApiIngestionResponse {
    successes: ApiIngestionSuccess[];
    errors: ApiIngestionError[];
}
/**
 * OpenAICompletionUsageSchema
 * OpenAI Usage schema from (Chat-)Completion APIs
 */
interface ApiOpenAICompletionUsageSchema {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: Record<string, number | null>;
    completion_tokens_details?: Record<string, number | null>;
}
/**
 * OpenAIResponseUsageSchema
 * OpenAI Usage schema from Response API
 */
interface ApiOpenAIResponseUsageSchema {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_tokens_details?: Record<string, number | null>;
    output_tokens_details?: Record<string, number | null>;
}
/** UsageDetails */
type ApiUsageDetails = Record<string, number> | ApiOpenAICompletionUsageSchema | ApiOpenAIResponseUsageSchema;
/** GetMediaResponse */
interface ApiGetMediaResponse {
    /** The unique langfuse identifier of a media record */
    mediaId: string;
    /** The MIME type of the media record */
    contentType: string;
    /** The size of the media record in bytes */
    contentLength: number;
    /**
     * The date and time when the media record was uploaded
     * @format date-time
     */
    uploadedAt: string;
    /** The download URL of the media record */
    url: string;
    /** The expiry date and time of the media record download URL */
    urlExpiry: string;
}
/** PatchMediaBody */
interface ApiPatchMediaBody {
    /**
     * The date and time when the media record was uploaded
     * @format date-time
     */
    uploadedAt: string;
    /** The HTTP status code of the upload */
    uploadHttpStatus: number;
    /** The HTTP error message of the upload */
    uploadHttpError?: string | null;
    /** The time in milliseconds it took to upload the media record */
    uploadTimeMs?: number | null;
}
/** GetMediaUploadUrlRequest */
interface ApiGetMediaUploadUrlRequest {
    /** The trace ID associated with the media record */
    traceId: string;
    /** The observation ID associated with the media record. If the media record is associated directly with a trace, this will be null. */
    observationId?: string | null;
    /** The MIME type of the media record */
    contentType: ApiMediaContentType;
    /** The size of the media record in bytes */
    contentLength: number;
    /** The SHA-256 hash of the media record */
    sha256Hash: string;
    /** The trace / observation field the media record is associated with. This can be one of `input`, `output`, `metadata` */
    field: string;
}
/** GetMediaUploadUrlResponse */
interface ApiGetMediaUploadUrlResponse {
    /** The presigned upload URL. If the asset is already uploaded, this will be null */
    uploadUrl?: string | null;
    /** The unique langfuse identifier of a media record */
    mediaId: string;
}
/**
 * MediaContentType
 * The MIME type of the media record
 */
type ApiMediaContentType = "image/png" | "image/jpeg" | "image/jpg" | "image/webp" | "image/gif" | "image/svg+xml" | "image/tiff" | "image/bmp" | "audio/mpeg" | "audio/mp3" | "audio/wav" | "audio/ogg" | "audio/oga" | "audio/aac" | "audio/mp4" | "audio/flac" | "video/mp4" | "video/webm" | "text/plain" | "text/html" | "text/css" | "text/csv" | "application/pdf" | "application/msword" | "application/vnd.ms-excel" | "application/zip" | "application/json" | "application/xml" | "application/octet-stream";
/** MetricsResponse */
interface ApiMetricsResponse {
    /**
     * The metrics data. Each item in the list contains the metric values and dimensions requested in the query.
     * Format varies based on the query parameters.
     * Histograms will return an array with [lower, upper, height] tuples.
     */
    data: Record<string, any>[];
}
/** PaginatedModels */
interface ApiPaginatedModels {
    data: ApiModel[];
    meta: ApiUtilsMetaResponse;
}
/** CreateModelRequest */
interface ApiCreateModelRequest {
    /** Name of the model definition. If multiple with the same name exist, they are applied in the following order: (1) custom over built-in, (2) newest according to startTime where model.startTime<observation.startTime */
    modelName: string;
    /** Regex pattern which matches this model definition to generation.model. Useful in case of fine-tuned models. If you want to exact match, use `(?i)^modelname$` */
    matchPattern: string;
    /**
     * Apply only to generations which are newer than this ISO date.
     * @format date-time
     */
    startDate?: string | null;
    /** Unit used by this model. */
    unit?: ApiModelUsageUnit | null;
    /**
     * Price (USD) per input unit
     * @format double
     */
    inputPrice?: number | null;
    /**
     * Price (USD) per output unit
     * @format double
     */
    outputPrice?: number | null;
    /**
     * Price (USD) per total units. Cannot be set if input or output price is set.
     * @format double
     */
    totalPrice?: number | null;
    /** Optional. Tokenizer to be applied to observations which match to this model. See docs for more details. */
    tokenizerId?: string | null;
    /** Optional. Configuration for the selected tokenizer. Needs to be JSON. See docs for more details. */
    tokenizerConfig?: any;
}
/** Observations */
interface ApiObservations {
    data: ApiObservation[];
    meta: ApiUtilsMetaResponse;
}
/** ObservationsViews */
interface ApiObservationsViews {
    data: ApiObservationsView[];
    meta: ApiUtilsMetaResponse;
}
/** MembershipRole */
type ApiMembershipRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
/** MembershipRequest */
interface ApiMembershipRequest {
    userId: string;
    role: ApiMembershipRole;
}
/** MembershipResponse */
interface ApiMembershipResponse {
    userId: string;
    role: ApiMembershipRole;
    email: string;
    name: string;
}
/** MembershipsResponse */
interface ApiMembershipsResponse {
    memberships: ApiMembershipResponse[];
}
/** OrganizationProject */
interface ApiOrganizationProject {
    id: string;
    name: string;
    metadata?: Record<string, any>;
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    updatedAt: string;
}
/** OrganizationProjectsResponse */
interface ApiOrganizationProjectsResponse {
    projects: ApiOrganizationProject[];
}
/** Projects */
interface ApiProjects {
    data: ApiProject[];
}
/** Project */
interface ApiProject {
    id: string;
    name: string;
    /** Metadata for the project */
    metadata: Record<string, any>;
    /** Number of days to retain data. Null or 0 means no retention. Omitted if no retention is configured. */
    retentionDays?: number | null;
}
/** ProjectDeletionResponse */
interface ApiProjectDeletionResponse {
    success: boolean;
    message: string;
}
/**
 * ApiKeyList
 * List of API keys for a project
 */
interface ApiApiKeyList {
    apiKeys: ApiApiKeySummary[];
}
/**
 * ApiKeySummary
 * Summary of an API key
 */
interface ApiApiKeySummary {
    id: string;
    /** @format date-time */
    createdAt: string;
    /** @format date-time */
    expiresAt?: string | null;
    /** @format date-time */
    lastUsedAt?: string | null;
    note?: string | null;
    publicKey: string;
    displaySecretKey: string;
}
/**
 * ApiKeyResponse
 * Response for API key creation
 */
interface ApiApiKeyResponse {
    id: string;
    /** @format date-time */
    createdAt: string;
    publicKey: string;
    secretKey: string;
    displaySecretKey: string;
    note?: string | null;
}
/**
 * ApiKeyDeletionResponse
 * Response for API key deletion
 */
interface ApiApiKeyDeletionResponse {
    success: boolean;
}
/** PromptMetaListResponse */
interface ApiPromptMetaListResponse {
    data: ApiPromptMeta[];
    meta: ApiUtilsMetaResponse;
}
/** PromptMeta */
interface ApiPromptMeta {
    name: string;
    versions: number[];
    labels: string[];
    tags: string[];
    /** @format date-time */
    lastUpdatedAt: string;
    /** Config object of the most recent prompt version that matches the filters (if any are provided) */
    lastConfig: any;
}
/** CreatePromptRequest */
type ApiCreatePromptRequest = ({
    type: "chat";
} & ApiCreateChatPromptRequest) | ({
    type: "text";
} & ApiCreateTextPromptRequest);
/** CreateChatPromptRequest */
interface ApiCreateChatPromptRequest {
    name: string;
    prompt: ApiChatMessageWithPlaceholders[];
    config?: any;
    /** List of deployment labels of this prompt version. */
    labels?: string[] | null;
    /** List of tags to apply to all versions of this prompt. */
    tags?: string[] | null;
    /** Commit message for this prompt version. */
    commitMessage?: string | null;
}
/** CreateTextPromptRequest */
interface ApiCreateTextPromptRequest {
    name: string;
    prompt: string;
    config?: any;
    /** List of deployment labels of this prompt version. */
    labels?: string[] | null;
    /** List of tags to apply to all versions of this prompt. */
    tags?: string[] | null;
    /** Commit message for this prompt version. */
    commitMessage?: string | null;
}
/** Prompt */
type ApiPrompt = ({
    type: "chat";
} & ApiChatPrompt) | ({
    type: "text";
} & ApiTextPrompt);
/** BasePrompt */
interface ApiBasePrompt {
    name: string;
    version: number;
    config: any;
    /** List of deployment labels of this prompt version. */
    labels: string[];
    /** List of tags. Used to filter via UI and API. The same across versions of a prompt. */
    tags: string[];
    /** Commit message for this prompt version. */
    commitMessage?: string | null;
    /** The dependency resolution graph for the current prompt. Null if prompt has no dependencies. */
    resolutionGraph?: Record<string, any>;
}
/** ChatMessageWithPlaceholders */
type ApiChatMessageWithPlaceholders = ({
    type: "chatmessage";
} & ApiChatMessage) | ({
    type: "placeholder";
} & ApiPlaceholderMessage);
/** ChatMessage */
interface ApiChatMessage {
    role: string;
    content: string;
}
/** PlaceholderMessage */
interface ApiPlaceholderMessage {
    name: string;
}
/** TextPrompt */
type ApiTextPrompt = ApiBasePrompt & {
    prompt: string;
};
/** ChatPrompt */
type ApiChatPrompt = ApiBasePrompt & {
    prompt: ApiChatMessageWithPlaceholders[];
};
/** ServiceProviderConfig */
interface ApiServiceProviderConfig {
    schemas: string[];
    documentationUri: string;
    patch: ApiScimFeatureSupport;
    bulk: ApiBulkConfig;
    filter: ApiFilterConfig;
    changePassword: ApiScimFeatureSupport;
    sort: ApiScimFeatureSupport;
    etag: ApiScimFeatureSupport;
    authenticationSchemes: ApiAuthenticationScheme[];
    meta: ApiResourceMeta;
}
/** ScimFeatureSupport */
interface ApiScimFeatureSupport {
    supported: boolean;
}
/** BulkConfig */
interface ApiBulkConfig {
    supported: boolean;
    maxOperations: number;
    maxPayloadSize: number;
}
/** FilterConfig */
interface ApiFilterConfig {
    supported: boolean;
    maxResults: number;
}
/** ResourceMeta */
interface ApiResourceMeta {
    resourceType: string;
    location: string;
}
/** AuthenticationScheme */
interface ApiAuthenticationScheme {
    name: string;
    description: string;
    specUri: string;
    type: string;
    primary: boolean;
}
/** ResourceTypesResponse */
interface ApiResourceTypesResponse {
    schemas: string[];
    totalResults: number;
    Resources: ApiResourceType[];
}
/** ResourceType */
interface ApiResourceType {
    schemas?: string[] | null;
    id: string;
    name: string;
    endpoint: string;
    description: string;
    schema: string;
    schemaExtensions: ApiSchemaExtension[];
    meta: ApiResourceMeta;
}
/** SchemaExtension */
interface ApiSchemaExtension {
    schema: string;
    required: boolean;
}
/** SchemasResponse */
interface ApiSchemasResponse {
    schemas: string[];
    totalResults: number;
    Resources: ApiSchemaResource[];
}
/** SchemaResource */
interface ApiSchemaResource {
    id: string;
    name: string;
    description: string;
    attributes: any[];
    meta: ApiResourceMeta;
}
/** ScimUsersListResponse */
interface ApiScimUsersListResponse {
    schemas: string[];
    totalResults: number;
    startIndex: number;
    itemsPerPage: number;
    Resources: ApiScimUser[];
}
/** ScimUser */
interface ApiScimUser {
    schemas: string[];
    id: string;
    userName: string;
    name: ApiScimName;
    emails: ApiScimEmail[];
    meta: ApiUserMeta;
}
/** UserMeta */
interface ApiUserMeta {
    resourceType: string;
    created?: string | null;
    lastModified?: string | null;
}
/** ScimName */
interface ApiScimName {
    formatted?: string | null;
}
/** ScimEmail */
interface ApiScimEmail {
    primary: boolean;
    value: string;
    type: string;
}
/**
 * EmptyResponse
 * Empty response for 204 No Content responses
 */
type ApiEmptyResponse = object;
/** ScoreConfigs */
interface ApiScoreConfigs {
    data: ApiScoreConfig[];
    meta: ApiUtilsMetaResponse;
}
/** CreateScoreConfigRequest */
interface ApiCreateScoreConfigRequest {
    name: string;
    dataType: ApiScoreDataType;
    /** Configure custom categories for categorical scores. Pass a list of objects with `label` and `value` properties. Categories are autogenerated for boolean configs and cannot be passed */
    categories?: ApiConfigCategory[] | null;
    /**
     * Configure a minimum value for numerical scores. If not set, the minimum value defaults to -∞
     * @format double
     */
    minValue?: number | null;
    /**
     * Configure a maximum value for numerical scores. If not set, the maximum value defaults to +∞
     * @format double
     */
    maxValue?: number | null;
    /** Description is shown across the Langfuse UI and can be used to e.g. explain the config categories in detail, why a numeric range was set, or provide additional context on config name or usage */
    description?: string | null;
}
/** GetScoresResponseTraceData */
interface ApiGetScoresResponseTraceData {
    /** The user ID associated with the trace referenced by score */
    userId?: string | null;
    /** A list of tags associated with the trace referenced by score */
    tags?: string[] | null;
    /** The environment of the trace referenced by score */
    environment?: string | null;
}
/** GetScoresResponseDataNumeric */
type ApiGetScoresResponseDataNumeric = ApiNumericScore & {
    trace?: ApiGetScoresResponseTraceData | null;
};
/** GetScoresResponseDataCategorical */
type ApiGetScoresResponseDataCategorical = ApiCategoricalScore & {
    trace?: ApiGetScoresResponseTraceData | null;
};
/** GetScoresResponseDataBoolean */
type ApiGetScoresResponseDataBoolean = ApiBooleanScore & {
    trace?: ApiGetScoresResponseTraceData | null;
};
/** GetScoresResponseData */
type ApiGetScoresResponseData = ({
    dataType: "NUMERIC";
} & ApiGetScoresResponseDataNumeric) | ({
    dataType: "CATEGORICAL";
} & ApiGetScoresResponseDataCategorical) | ({
    dataType: "BOOLEAN";
} & ApiGetScoresResponseDataBoolean);
/** GetScoresResponse */
interface ApiGetScoresResponse {
    data: ApiGetScoresResponseData[];
    meta: ApiUtilsMetaResponse;
}
/** CreateScoreRequest */
interface ApiCreateScoreRequest {
    id?: string | null;
    traceId?: string | null;
    sessionId?: string | null;
    observationId?: string | null;
    datasetRunId?: string | null;
    /** @example "novelty" */
    name: string;
    /** The value of the score. Must be passed as string for categorical scores, and numeric for boolean and numeric scores. Boolean score values must equal either 1 or 0 (true or false) */
    value: ApiCreateScoreValue;
    comment?: string | null;
    metadata?: any;
    /** The environment of the score. Can be any lowercase alphanumeric string with hyphens and underscores that does not start with 'langfuse'. */
    environment?: string | null;
    /** The data type of the score. When passing a configId this field is inferred. Otherwise, this field must be passed or will default to numeric. */
    dataType?: ApiScoreDataType | null;
    /** Reference a score config on a score. The unique langfuse identifier of a score config. When passing this field, the dataType and stringValue fields are automatically populated. */
    configId?: string | null;
}
/** CreateScoreResponse */
interface ApiCreateScoreResponse {
    /** The id of the created object in Langfuse */
    id: string;
}
/** PaginatedSessions */
interface ApiPaginatedSessions {
    data: ApiSession[];
    meta: ApiUtilsMetaResponse;
}
/** Traces */
interface ApiTraces {
    data: ApiTraceWithDetails[];
    meta: ApiUtilsMetaResponse;
}
/** DeleteTraceResponse */
interface ApiDeleteTraceResponse {
    message: string;
}
/** Sort */
interface ApiSort {
    id: string;
}
/** utilsMetaResponse */
interface ApiUtilsMetaResponse {
    /** current page number */
    page: number;
    /** number of items per page */
    limit: number;
    /** number of total items given the current filters/selection (if any) */
    totalItems: number;
    /** number of total pages given the current limit */
    totalPages: number;
}
interface ApiAnnotationQueuesListQueuesParams {
    /** page number, starts at 1 */
    page?: number | null;
    /** limit of items per page */
    limit?: number | null;
}
interface ApiAnnotationQueuesListQueueItemsParams {
    /** Filter by status */
    status?: ApiAnnotationQueueStatus | null;
    /** page number, starts at 1 */
    page?: number | null;
    /** limit of items per page */
    limit?: number | null;
    /** The unique identifier of the annotation queue */
    queueId: string;
}
interface ApiCommentsGetParams {
    /** Page number, starts at 1. */
    page?: number | null;
    /** Limit of items per page. If you encounter api issues due to too large page sizes, try to reduce the limit */
    limit?: number | null;
    /** Filter comments by object type (trace, observation, session, prompt). */
    objectType?: string | null;
    /** Filter comments by object id. If objectType is not provided, an error will be thrown. */
    objectId?: string | null;
    /** Filter comments by author user id. */
    authorUserId?: string | null;
}
interface ApiDatasetItemsListParams {
    datasetName?: string | null;
    sourceTraceId?: string | null;
    sourceObservationId?: string | null;
    /** page number, starts at 1 */
    page?: number | null;
    /** limit of items per page */
    limit?: number | null;
}
interface ApiDatasetRunItemsListParams {
    datasetId: string;
    runName: string;
    /** page number, starts at 1 */
    page?: number | null;
    /** limit of items per page */
    limit?: number | null;
    response: ApiPaginatedDatasetRunItems;
}
interface ApiDatasetsListParams {
    /** page number, starts at 1 */
    page?: number | null;
    /** limit of items per page */
    limit?: number | null;
}
interface ApiDatasetsGetRunsParams {
    /** page number, starts at 1 */
    page?: number | null;
    /** limit of items per page */
    limit?: number | null;
    datasetName: string;
}
interface ApiIngestionBatchPayload {
    /** Batch of tracing events to be ingested. Discriminated by attribute `type`. */
    batch: ApiIngestionEvent[];
    /** Optional. Metadata field used by the Langfuse SDKs for debugging. */
    metadata?: any;
}
interface ApiMetricsMetricsParams {
    /**
     * JSON string containing the query parameters with the following structure:
     * ```json
     * {
     *   "view": string,           // Required. One of "traces", "observations", "scores-numeric", "scores-categorical"
     *   "dimensions": [           // Optional. Default: []
     *     {
     *       "field": string       // Field to group by, e.g. "name", "userId", "sessionId"
     *     }
     *   ],
     *   "metrics": [              // Required. At least one metric must be provided
     *     {
     *       "measure": string,    // What to measure, e.g. "count", "latency", "value"
     *       "aggregation": string // How to aggregate, e.g. "count", "sum", "avg", "p95", "histogram"
     *     }
     *   ],
     *   "filters": [              // Optional. Default: []
     *     {
     *       "column": string,     // Column to filter on
     *       "operator": string,   // Operator, e.g. "=", ">", "<", "contains"
     *       "value": any,         // Value to compare against
     *       "type": string,       // Data type, e.g. "string", "number", "stringObject"
     *       "key": string         // Required only when filtering on metadata
     *     }
     *   ],
     *   "timeDimension": {        // Optional. Default: null. If provided, results will be grouped by time
     *     "granularity": string   // One of "minute", "hour", "day", "week", "month", "auto"
     *   },
     *   "fromTimestamp": string,  // Required. ISO datetime string for start of time range
     *   "toTimestamp": string,    // Required. ISO datetime string for end of time range
     *   "orderBy": [              // Optional. Default: null
     *     {
     *       "field": string,      // Field to order by
     *       "direction": string   // "asc" or "desc"
     *     }
     *   ],
     *   "config": {               // Optional. Query-specific configuration
     *     "bins": number,         // Optional. Number of bins for histogram (1-100), default: 10
     *     "row_limit": number     // Optional. Row limit for results (1-1000)
     *   }
     * }
     * ```
     */
    query: string;
}
interface ApiModelsListParams {
    /** page number, starts at 1 */
    page?: number | null;
    /** limit of items per page */
    limit?: number | null;
}
interface ApiObservationsGetManyParams {
    /** Page number, starts at 1. */
    page?: number | null;
    /** Limit of items per page. If you encounter api issues due to too large page sizes, try to reduce the limit. */
    limit?: number | null;
    name?: string | null;
    userId?: string | null;
    type?: string | null;
    traceId?: string | null;
    parentObservationId?: string | null;
    /** Optional filter for observations where the environment is one of the provided values. */
    environment?: (string | null)[];
    /**
     * Retrieve only observations with a start_time on or after this datetime (ISO 8601).
     * @format date-time
     */
    fromStartTime?: string | null;
    /**
     * Retrieve only observations with a start_time before this datetime (ISO 8601).
     * @format date-time
     */
    toStartTime?: string | null;
    /** Optional filter to only include observations with a certain version. */
    version?: string | null;
}
interface ApiProjectsCreatePayload {
    name: string;
    /** Optional metadata for the project */
    metadata?: Record<string, any>;
    /** Number of days to retain data. Must be 0 or at least 3 days. Requires data-retention entitlement for non-zero values. Optional. */
    retention: number;
}
interface ApiProjectsUpdatePayload {
    name: string;
    /** Optional metadata for the project */
    metadata?: Record<string, any>;
    /** Number of days to retain data. Must be 0 or at least 3 days. Requires data-retention entitlement for non-zero values. Optional. */
    retention: number;
}
interface ApiProjectsCreateApiKeyPayload {
    /** Optional note for the API key */
    note?: string | null;
}
interface ApiPromptVersionUpdatePayload {
    /** New labels for the prompt version. Labels are unique across versions. The "latest" label is reserved and managed by Langfuse. */
    newLabels: string[];
}
interface ApiPromptsGetParams {
    /** Version of the prompt to be retrieved. */
    version?: number | null;
    /** Label of the prompt to be retrieved. Defaults to "production" if no label or version is set. */
    label?: string | null;
    /** The name of the prompt */
    promptName: string;
}
interface ApiPromptsListParams {
    name?: string | null;
    label?: string | null;
    tag?: string | null;
    /** page number, starts at 1 */
    page?: number | null;
    /** limit of items per page */
    limit?: number | null;
    /**
     * Optional filter to only include prompt versions created/updated on or after a certain datetime (ISO 8601)
     * @format date-time
     */
    fromUpdatedAt?: string | null;
    /**
     * Optional filter to only include prompt versions created/updated before a certain datetime (ISO 8601)
     * @format date-time
     */
    toUpdatedAt?: string | null;
}
interface ApiScimListUsersParams {
    /** Filter expression (e.g. userName eq "value") */
    filter?: string | null;
    /** 1-based index of the first result to return (default 1) */
    startIndex?: number | null;
    /** Maximum number of results to return (default 100) */
    count?: number | null;
}
interface ApiScimCreateUserPayload {
    /** User's email address (required) */
    userName: string;
    /** User's name information */
    name: ApiScimName;
    /** User's email addresses */
    emails?: ApiScimEmail[] | null;
    /** Whether the user is active */
    active?: boolean | null;
    /** Initial password for the user */
    password?: string | null;
}
interface ApiScoreConfigsGetParams {
    /** Page number, starts at 1. */
    page?: number | null;
    /** Limit of items per page. If you encounter api issues due to too large page sizes, try to reduce the limit */
    limit?: number | null;
}
interface ApiScoreV2GetParams {
    /** Page number, starts at 1. */
    page?: number | null;
    /** Limit of items per page. If you encounter api issues due to too large page sizes, try to reduce the limit. */
    limit?: number | null;
    /** Retrieve only scores with this userId associated to the trace. */
    userId?: string | null;
    /** Retrieve only scores with this name. */
    name?: string | null;
    /**
     * Optional filter to only include scores created on or after a certain datetime (ISO 8601)
     * @format date-time
     */
    fromTimestamp?: string | null;
    /**
     * Optional filter to only include scores created before a certain datetime (ISO 8601)
     * @format date-time
     */
    toTimestamp?: string | null;
    /** Optional filter for scores where the environment is one of the provided values. */
    environment?: (string | null)[];
    /** Retrieve only scores from a specific source. */
    source?: ApiScoreSource | null;
    /** Retrieve only scores with <operator> value. */
    operator?: string | null;
    /**
     * Retrieve only scores with <operator> value.
     * @format double
     */
    value?: number | null;
    /** Comma-separated list of score IDs to limit the results to. */
    scoreIds?: string | null;
    /** Retrieve only scores with a specific configId. */
    configId?: string | null;
    /** Retrieve only scores with a specific annotation queueId. */
    queueId?: string | null;
    /** Retrieve only scores with a specific dataType. */
    dataType?: ApiScoreDataType | null;
    /** Only scores linked to traces that include all of these tags will be returned. */
    traceTags?: (string | null)[];
}
interface ApiSessionsListParams {
    /** Page number, starts at 1 */
    page?: number | null;
    /** Limit of items per page. If you encounter api issues due to too large page sizes, try to reduce the limit. */
    limit?: number | null;
    /**
     * Optional filter to only include sessions created on or after a certain datetime (ISO 8601)
     * @format date-time
     */
    fromTimestamp?: string | null;
    /**
     * Optional filter to only include sessions created before a certain datetime (ISO 8601)
     * @format date-time
     */
    toTimestamp?: string | null;
    /** Optional filter for sessions where the environment is one of the provided values. */
    environment?: (string | null)[];
}
interface ApiTraceListParams {
    /** Page number, starts at 1 */
    page?: number | null;
    /** Limit of items per page. If you encounter api issues due to too large page sizes, try to reduce the limit. */
    limit?: number | null;
    userId?: string | null;
    name?: string | null;
    sessionId?: string | null;
    /**
     * Optional filter to only include traces with a trace.timestamp on or after a certain datetime (ISO 8601)
     * @format date-time
     */
    fromTimestamp?: string | null;
    /**
     * Optional filter to only include traces with a trace.timestamp before a certain datetime (ISO 8601)
     * @format date-time
     */
    toTimestamp?: string | null;
    /** Format of the string [field].[asc/desc]. Fields: id, timestamp, name, userId, release, version, public, bookmarked, sessionId. Example: timestamp.asc */
    orderBy?: string | null;
    /** Only traces that include all of these tags will be returned. */
    tags?: (string | null)[];
    /** Optional filter to only include traces with a certain version. */
    version?: string | null;
    /** Optional filter to only include traces with a certain release. */
    release?: string | null;
    /** Optional filter for traces where the environment is one of the provided values. */
    environment?: (string | null)[];
    /** Comma-separated list of fields to include in the response. Available field groups are 'core' (always included), 'io' (input, output, metadata), 'scores', 'observations', 'metrics'. If not provided, all fields are included. Example: 'core,scores,metrics' */
    fields?: string | null;
}
interface ApiTraceDeleteMultiplePayload {
    /** List of trace IDs to delete */
    traceIds: string[];
}
type QueryParamsType = Record<string | number, any>;
type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;
interface FullRequestParams extends Omit<RequestInit, "body"> {
    /** set parameter to `true` for call `securityWorker` for this request */
    secure?: boolean;
    /** request path */
    path: string;
    /** content type of request body */
    type?: ContentType;
    /** query params */
    query?: QueryParamsType;
    /** format of response (i.e. response.json() -> format: "json") */
    format?: ResponseFormat;
    /** request body */
    body?: unknown;
    /** base url */
    baseUrl?: string;
    /** request cancellation token */
    cancelToken?: CancelToken;
}
type RequestParams = Omit<FullRequestParams, "body" | "method" | "query" | "path">;
interface ApiConfig<SecurityDataType = unknown> {
    baseUrl?: string;
    baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
    securityWorker?: (securityData: SecurityDataType | null) => Promise<RequestParams | void> | RequestParams | void;
    customFetch?: typeof fetch;
}
interface HttpResponse<D extends unknown, E extends unknown = unknown> extends Response {
    data: D;
    error: E;
}
type CancelToken = Symbol | string | number;
declare enum ContentType {
    Json = "application/json",
    FormData = "multipart/form-data",
    UrlEncoded = "application/x-www-form-urlencoded",
    Text = "text/plain"
}
declare class HttpClient<SecurityDataType = unknown> {
    baseUrl: string;
    private securityData;
    private securityWorker?;
    private abortControllers;
    private customFetch;
    private baseApiParams;
    constructor(apiConfig?: ApiConfig<SecurityDataType>);
    setSecurityData: (data: SecurityDataType | null) => void;
    protected encodeQueryParam(key: string, value: any): string;
    protected addQueryParam(query: QueryParamsType, key: string): string;
    protected addArrayQueryParam(query: QueryParamsType, key: string): any;
    protected toQueryString(rawQuery?: QueryParamsType): string;
    protected addQueryParams(rawQuery?: QueryParamsType): string;
    private contentFormatters;
    protected mergeRequestParams(params1: RequestParams, params2?: RequestParams): RequestParams;
    protected createAbortSignal: (cancelToken: CancelToken) => AbortSignal | undefined;
    abortRequest: (cancelToken: CancelToken) => void;
    request: <T = any, E = any>({ body, secure, path, type, query, format, baseUrl, cancelToken, ...params }: FullRequestParams) => Promise<T>;
}
/**
 * @title langfuse
 *
 * ## Authentication
 *
 * Authenticate with the API using [Basic Auth](https://en.wikipedia.org/wiki/Basic_access_authentication), get API keys in the project settings:
 *
 * - username: Langfuse Public Key
 * - password: Langfuse Secret Key
 *
 * ## Exports
 *
 * - OpenAPI spec: https://cloud.langfuse.com/generated/api/openapi.yml
 * - Postman collection: https://cloud.langfuse.com/generated/postman/collection.json
 */
declare class LangfusePublicApi<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
    api: {
        /**
         * @description Add an item to an annotation queue
         *
         * @tags AnnotationQueues
         * @name AnnotationQueuesCreateQueueItem
         * @request POST:/api/public/annotation-queues/{queueId}/items
         * @secure
         */
        annotationQueuesCreateQueueItem: (queueId: string, data: ApiCreateAnnotationQueueItemRequest, params?: RequestParams) => Promise<ApiAnnotationQueueItem>;
        /**
         * @description Remove an item from an annotation queue
         *
         * @tags AnnotationQueues
         * @name AnnotationQueuesDeleteQueueItem
         * @request DELETE:/api/public/annotation-queues/{queueId}/items/{itemId}
         * @secure
         */
        annotationQueuesDeleteQueueItem: (queueId: string, itemId: string, params?: RequestParams) => Promise<ApiDeleteAnnotationQueueItemResponse>;
        /**
         * @description Get an annotation queue by ID
         *
         * @tags AnnotationQueues
         * @name AnnotationQueuesGetQueue
         * @request GET:/api/public/annotation-queues/{queueId}
         * @secure
         */
        annotationQueuesGetQueue: (queueId: string, params?: RequestParams) => Promise<ApiAnnotationQueue>;
        /**
         * @description Get a specific item from an annotation queue
         *
         * @tags AnnotationQueues
         * @name AnnotationQueuesGetQueueItem
         * @request GET:/api/public/annotation-queues/{queueId}/items/{itemId}
         * @secure
         */
        annotationQueuesGetQueueItem: (queueId: string, itemId: string, params?: RequestParams) => Promise<ApiAnnotationQueueItem>;
        /**
         * @description Get items for a specific annotation queue
         *
         * @tags AnnotationQueues
         * @name AnnotationQueuesListQueueItems
         * @request GET:/api/public/annotation-queues/{queueId}/items
         * @secure
         */
        annotationQueuesListQueueItems: ({ queueId, ...query }: ApiAnnotationQueuesListQueueItemsParams, params?: RequestParams) => Promise<ApiPaginatedAnnotationQueueItems>;
        /**
         * @description Get all annotation queues
         *
         * @tags AnnotationQueues
         * @name AnnotationQueuesListQueues
         * @request GET:/api/public/annotation-queues
         * @secure
         */
        annotationQueuesListQueues: (query: ApiAnnotationQueuesListQueuesParams, params?: RequestParams) => Promise<ApiPaginatedAnnotationQueues>;
        /**
         * @description Update an annotation queue item
         *
         * @tags AnnotationQueues
         * @name AnnotationQueuesUpdateQueueItem
         * @request PATCH:/api/public/annotation-queues/{queueId}/items/{itemId}
         * @secure
         */
        annotationQueuesUpdateQueueItem: (queueId: string, itemId: string, data: ApiUpdateAnnotationQueueItemRequest, params?: RequestParams) => Promise<ApiAnnotationQueueItem>;
        /**
         * @description Create a comment. Comments may be attached to different object types (trace, observation, session, prompt).
         *
         * @tags Comments
         * @name CommentsCreate
         * @request POST:/api/public/comments
         * @secure
         */
        commentsCreate: (data: ApiCreateCommentRequest, params?: RequestParams) => Promise<ApiCreateCommentResponse>;
        /**
         * @description Get all comments
         *
         * @tags Comments
         * @name CommentsGet
         * @request GET:/api/public/comments
         * @secure
         */
        commentsGet: (query: ApiCommentsGetParams, params?: RequestParams) => Promise<ApiGetCommentsResponse>;
        /**
         * @description Get a comment by id
         *
         * @tags Comments
         * @name CommentsGetById
         * @request GET:/api/public/comments/{commentId}
         * @secure
         */
        commentsGetById: (commentId: string, params?: RequestParams) => Promise<ApiComment>;
        /**
         * @description Create a dataset item
         *
         * @tags DatasetItems
         * @name DatasetItemsCreate
         * @request POST:/api/public/dataset-items
         * @secure
         */
        datasetItemsCreate: (data: ApiCreateDatasetItemRequest, params?: RequestParams) => Promise<ApiDatasetItem>;
        /**
         * @description Delete a dataset item and all its run items. This action is irreversible.
         *
         * @tags DatasetItems
         * @name DatasetItemsDelete
         * @request DELETE:/api/public/dataset-items/{id}
         * @secure
         */
        datasetItemsDelete: (id: string, params?: RequestParams) => Promise<ApiDeleteDatasetItemResponse>;
        /**
         * @description Get a dataset item
         *
         * @tags DatasetItems
         * @name DatasetItemsGet
         * @request GET:/api/public/dataset-items/{id}
         * @secure
         */
        datasetItemsGet: (id: string, params?: RequestParams) => Promise<ApiDatasetItem>;
        /**
         * @description Get dataset items
         *
         * @tags DatasetItems
         * @name DatasetItemsList
         * @request GET:/api/public/dataset-items
         * @secure
         */
        datasetItemsList: (query: ApiDatasetItemsListParams, params?: RequestParams) => Promise<ApiPaginatedDatasetItems>;
        /**
         * @description Create a dataset run item
         *
         * @tags DatasetRunItems
         * @name DatasetRunItemsCreate
         * @request POST:/api/public/dataset-run-items
         * @secure
         */
        datasetRunItemsCreate: (data: ApiCreateDatasetRunItemRequest, params?: RequestParams) => Promise<ApiDatasetRunItem>;
        /**
         * @description List dataset run items
         *
         * @tags DatasetRunItems
         * @name DatasetRunItemsList
         * @request GET:/api/public/dataset-run-items
         * @secure
         */
        datasetRunItemsList: (query: ApiDatasetRunItemsListParams, params?: RequestParams) => Promise<void>;
        /**
         * @description Create a dataset
         *
         * @tags Datasets
         * @name DatasetsCreate
         * @request POST:/api/public/v2/datasets
         * @secure
         */
        datasetsCreate: (data: ApiCreateDatasetRequest, params?: RequestParams) => Promise<ApiDataset>;
        /**
         * @description Delete a dataset run and all its run items. This action is irreversible.
         *
         * @tags Datasets
         * @name DatasetsDeleteRun
         * @request DELETE:/api/public/datasets/{datasetName}/runs/{runName}
         * @secure
         */
        datasetsDeleteRun: (datasetName: string, runName: string, params?: RequestParams) => Promise<ApiDeleteDatasetRunResponse>;
        /**
         * @description Get a dataset
         *
         * @tags Datasets
         * @name DatasetsGet
         * @request GET:/api/public/v2/datasets/{datasetName}
         * @secure
         */
        datasetsGet: (datasetName: string, params?: RequestParams) => Promise<ApiDataset>;
        /**
         * @description Get a dataset run and its items
         *
         * @tags Datasets
         * @name DatasetsGetRun
         * @request GET:/api/public/datasets/{datasetName}/runs/{runName}
         * @secure
         */
        datasetsGetRun: (datasetName: string, runName: string, params?: RequestParams) => Promise<ApiDatasetRunWithItems>;
        /**
         * @description Get dataset runs
         *
         * @tags Datasets
         * @name DatasetsGetRuns
         * @request GET:/api/public/datasets/{datasetName}/runs
         * @secure
         */
        datasetsGetRuns: ({ datasetName, ...query }: ApiDatasetsGetRunsParams, params?: RequestParams) => Promise<ApiPaginatedDatasetRuns>;
        /**
         * @description Get all datasets
         *
         * @tags Datasets
         * @name DatasetsList
         * @request GET:/api/public/v2/datasets
         * @secure
         */
        datasetsList: (query: ApiDatasetsListParams, params?: RequestParams) => Promise<ApiPaginatedDatasets>;
        /**
         * @description Check health of API and database
         *
         * @tags Health
         * @name HealthHealth
         * @request GET:/api/public/health
         */
        healthHealth: (params?: RequestParams) => Promise<ApiHealthResponse>;
        /**
         * @description Batched ingestion for Langfuse Tracing. If you want to use tracing via the API, such as to build your own Langfuse client implementation, this is the only API route you need to implement. Within each batch, there can be multiple events. Each event has a type, an id, a timestamp, metadata and a body. Internally, we refer to this as the "event envelope" as it tells us something about the event but not the trace. We use the event id within this envelope to deduplicate messages to avoid processing the same event twice, i.e. the event id should be unique per request. The event.body.id is the ID of the actual trace and will be used for updates and will be visible within the Langfuse App. I.e. if you want to update a trace, you'd use the same body id, but separate event IDs. Notes: - Introduction to data model: https://langfuse.com/docs/tracing-data-model - Batch sizes are limited to 3.5 MB in total. You need to adjust the number of events per batch accordingly. - The API does not return a 4xx status code for input errors. Instead, it responds with a 207 status code, which includes a list of the encountered errors.
         *
         * @tags Ingestion
         * @name IngestionBatch
         * @request POST:/api/public/ingestion
         * @secure
         */
        ingestionBatch: (data: ApiIngestionBatchPayload, params?: RequestParams) => Promise<ApiIngestionResponse>;
        /**
         * @description Get a media record
         *
         * @tags Media
         * @name MediaGet
         * @request GET:/api/public/media/{mediaId}
         * @secure
         */
        mediaGet: (mediaId: string, params?: RequestParams) => Promise<ApiGetMediaResponse>;
        /**
         * @description Get a presigned upload URL for a media record
         *
         * @tags Media
         * @name MediaGetUploadUrl
         * @request POST:/api/public/media
         * @secure
         */
        mediaGetUploadUrl: (data: ApiGetMediaUploadUrlRequest, params?: RequestParams) => Promise<ApiGetMediaUploadUrlResponse>;
        /**
         * @description Patch a media record
         *
         * @tags Media
         * @name MediaPatch
         * @request PATCH:/api/public/media/{mediaId}
         * @secure
         */
        mediaPatch: (mediaId: string, data: ApiPatchMediaBody, params?: RequestParams) => Promise<void>;
        /**
         * @description Get metrics from the Langfuse project using a query object
         *
         * @tags Metrics
         * @name MetricsMetrics
         * @request GET:/api/public/metrics
         * @secure
         */
        metricsMetrics: (query: ApiMetricsMetricsParams, params?: RequestParams) => Promise<ApiMetricsResponse>;
        /**
         * @description Create a model
         *
         * @tags Models
         * @name ModelsCreate
         * @request POST:/api/public/models
         * @secure
         */
        modelsCreate: (data: ApiCreateModelRequest, params?: RequestParams) => Promise<ApiModel>;
        /**
         * @description Delete a model. Cannot delete models managed by Langfuse. You can create your own definition with the same modelName to override the definition though.
         *
         * @tags Models
         * @name ModelsDelete
         * @request DELETE:/api/public/models/{id}
         * @secure
         */
        modelsDelete: (id: string, params?: RequestParams) => Promise<void>;
        /**
         * @description Get a model
         *
         * @tags Models
         * @name ModelsGet
         * @request GET:/api/public/models/{id}
         * @secure
         */
        modelsGet: (id: string, params?: RequestParams) => Promise<ApiModel>;
        /**
         * @description Get all models
         *
         * @tags Models
         * @name ModelsList
         * @request GET:/api/public/models
         * @secure
         */
        modelsList: (query: ApiModelsListParams, params?: RequestParams) => Promise<ApiPaginatedModels>;
        /**
         * @description Get a observation
         *
         * @tags Observations
         * @name ObservationsGet
         * @request GET:/api/public/observations/{observationId}
         * @secure
         */
        observationsGet: (observationId: string, params?: RequestParams) => Promise<ApiObservationsView>;
        /**
         * @description Get a list of observations
         *
         * @tags Observations
         * @name ObservationsGetMany
         * @request GET:/api/public/observations
         * @secure
         */
        observationsGetMany: (query: ApiObservationsGetManyParams, params?: RequestParams) => Promise<ApiObservationsViews>;
        /**
         * @description Get all memberships for the organization associated with the API key (requires organization-scoped API key)
         *
         * @tags Organizations
         * @name OrganizationsGetOrganizationMemberships
         * @request GET:/api/public/organizations/memberships
         * @secure
         */
        organizationsGetOrganizationMemberships: (params?: RequestParams) => Promise<ApiMembershipsResponse>;
        /**
         * @description Get all projects for the organization associated with the API key (requires organization-scoped API key)
         *
         * @tags Organizations
         * @name OrganizationsGetOrganizationProjects
         * @request GET:/api/public/organizations/projects
         * @secure
         */
        organizationsGetOrganizationProjects: (params?: RequestParams) => Promise<ApiOrganizationProjectsResponse>;
        /**
         * @description Get all memberships for a specific project (requires organization-scoped API key)
         *
         * @tags Organizations
         * @name OrganizationsGetProjectMemberships
         * @request GET:/api/public/projects/{projectId}/memberships
         * @secure
         */
        organizationsGetProjectMemberships: (projectId: string, params?: RequestParams) => Promise<ApiMembershipsResponse>;
        /**
         * @description Create or update a membership for the organization associated with the API key (requires organization-scoped API key)
         *
         * @tags Organizations
         * @name OrganizationsUpdateOrganizationMembership
         * @request PUT:/api/public/organizations/memberships
         * @secure
         */
        organizationsUpdateOrganizationMembership: (data: ApiMembershipRequest, params?: RequestParams) => Promise<ApiMembershipResponse>;
        /**
         * @description Create or update a membership for a specific project (requires organization-scoped API key). The user must already be a member of the organization.
         *
         * @tags Organizations
         * @name OrganizationsUpdateProjectMembership
         * @request PUT:/api/public/projects/{projectId}/memberships
         * @secure
         */
        organizationsUpdateProjectMembership: (projectId: string, data: ApiMembershipRequest, params?: RequestParams) => Promise<ApiMembershipResponse>;
        /**
         * @description Create a new project (requires organization-scoped API key)
         *
         * @tags Projects
         * @name ProjectsCreate
         * @request POST:/api/public/projects
         * @secure
         */
        projectsCreate: (data: ApiProjectsCreatePayload, params?: RequestParams) => Promise<ApiProject>;
        /**
         * @description Create a new API key for a project (requires organization-scoped API key)
         *
         * @tags Projects
         * @name ProjectsCreateApiKey
         * @request POST:/api/public/projects/{projectId}/apiKeys
         * @secure
         */
        projectsCreateApiKey: (projectId: string, data: ApiProjectsCreateApiKeyPayload, params?: RequestParams) => Promise<ApiApiKeyResponse>;
        /**
         * @description Delete a project by ID (requires organization-scoped API key). Project deletion is processed asynchronously.
         *
         * @tags Projects
         * @name ProjectsDelete
         * @request DELETE:/api/public/projects/{projectId}
         * @secure
         */
        projectsDelete: (projectId: string, params?: RequestParams) => Promise<ApiProjectDeletionResponse>;
        /**
         * @description Delete an API key for a project (requires organization-scoped API key)
         *
         * @tags Projects
         * @name ProjectsDeleteApiKey
         * @request DELETE:/api/public/projects/{projectId}/apiKeys/{apiKeyId}
         * @secure
         */
        projectsDeleteApiKey: (projectId: string, apiKeyId: string, params?: RequestParams) => Promise<ApiApiKeyDeletionResponse>;
        /**
         * @description Get Project associated with API key
         *
         * @tags Projects
         * @name ProjectsGet
         * @request GET:/api/public/projects
         * @secure
         */
        projectsGet: (params?: RequestParams) => Promise<ApiProjects>;
        /**
         * @description Get all API keys for a project (requires organization-scoped API key)
         *
         * @tags Projects
         * @name ProjectsGetApiKeys
         * @request GET:/api/public/projects/{projectId}/apiKeys
         * @secure
         */
        projectsGetApiKeys: (projectId: string, params?: RequestParams) => Promise<ApiApiKeyList>;
        /**
         * @description Update a project by ID (requires organization-scoped API key).
         *
         * @tags Projects
         * @name ProjectsUpdate
         * @request PUT:/api/public/projects/{projectId}
         * @secure
         */
        projectsUpdate: (projectId: string, data: ApiProjectsUpdatePayload, params?: RequestParams) => Promise<ApiProject>;
        /**
         * @description Create a new version for the prompt with the given `name`
         *
         * @tags Prompts
         * @name PromptsCreate
         * @request POST:/api/public/v2/prompts
         * @secure
         */
        promptsCreate: (data: ApiCreatePromptRequest, params?: RequestParams) => Promise<ApiPrompt>;
        /**
         * @description Get a prompt
         *
         * @tags Prompts
         * @name PromptsGet
         * @request GET:/api/public/v2/prompts/{promptName}
         * @secure
         */
        promptsGet: ({ promptName, ...query }: ApiPromptsGetParams, params?: RequestParams) => Promise<ApiPrompt>;
        /**
         * @description Get a list of prompt names with versions and labels
         *
         * @tags Prompts
         * @name PromptsList
         * @request GET:/api/public/v2/prompts
         * @secure
         */
        promptsList: (query: ApiPromptsListParams, params?: RequestParams) => Promise<ApiPromptMetaListResponse>;
        /**
         * @description Update labels for a specific prompt version
         *
         * @tags PromptVersion
         * @name PromptVersionUpdate
         * @request PATCH:/api/public/v2/prompts/{name}/versions/{version}
         * @secure
         */
        promptVersionUpdate: (name: string, version: number, data: ApiPromptVersionUpdatePayload, params?: RequestParams) => Promise<ApiPrompt>;
        /**
         * @description Create a new user in the organization (requires organization-scoped API key)
         *
         * @tags Scim
         * @name ScimCreateUser
         * @request POST:/api/public/scim/Users
         * @secure
         */
        scimCreateUser: (data: ApiScimCreateUserPayload, params?: RequestParams) => Promise<ApiScimUser>;
        /**
         * @description Remove a user from the organization (requires organization-scoped API key). Note that this only removes the user from the organization but does not delete the user entity itself.
         *
         * @tags Scim
         * @name ScimDeleteUser
         * @request DELETE:/api/public/scim/Users/{userId}
         * @secure
         */
        scimDeleteUser: (userId: string, params?: RequestParams) => Promise<object>;
        /**
         * @description Get SCIM Resource Types (requires organization-scoped API key)
         *
         * @tags Scim
         * @name ScimGetResourceTypes
         * @request GET:/api/public/scim/ResourceTypes
         * @secure
         */
        scimGetResourceTypes: (params?: RequestParams) => Promise<ApiResourceTypesResponse>;
        /**
         * @description Get SCIM Schemas (requires organization-scoped API key)
         *
         * @tags Scim
         * @name ScimGetSchemas
         * @request GET:/api/public/scim/Schemas
         * @secure
         */
        scimGetSchemas: (params?: RequestParams) => Promise<ApiSchemasResponse>;
        /**
         * @description Get SCIM Service Provider Configuration (requires organization-scoped API key)
         *
         * @tags Scim
         * @name ScimGetServiceProviderConfig
         * @request GET:/api/public/scim/ServiceProviderConfig
         * @secure
         */
        scimGetServiceProviderConfig: (params?: RequestParams) => Promise<ApiServiceProviderConfig>;
        /**
         * @description Get a specific user by ID (requires organization-scoped API key)
         *
         * @tags Scim
         * @name ScimGetUser
         * @request GET:/api/public/scim/Users/{userId}
         * @secure
         */
        scimGetUser: (userId: string, params?: RequestParams) => Promise<ApiScimUser>;
        /**
         * @description List users in the organization (requires organization-scoped API key)
         *
         * @tags Scim
         * @name ScimListUsers
         * @request GET:/api/public/scim/Users
         * @secure
         */
        scimListUsers: (query: ApiScimListUsersParams, params?: RequestParams) => Promise<ApiScimUsersListResponse>;
        /**
         * @description Create a score configuration (config). Score configs are used to define the structure of scores
         *
         * @tags ScoreConfigs
         * @name ScoreConfigsCreate
         * @request POST:/api/public/score-configs
         * @secure
         */
        scoreConfigsCreate: (data: ApiCreateScoreConfigRequest, params?: RequestParams) => Promise<ApiScoreConfig>;
        /**
         * @description Get all score configs
         *
         * @tags ScoreConfigs
         * @name ScoreConfigsGet
         * @request GET:/api/public/score-configs
         * @secure
         */
        scoreConfigsGet: (query: ApiScoreConfigsGetParams, params?: RequestParams) => Promise<ApiScoreConfigs>;
        /**
         * @description Get a score config
         *
         * @tags ScoreConfigs
         * @name ScoreConfigsGetById
         * @request GET:/api/public/score-configs/{configId}
         * @secure
         */
        scoreConfigsGetById: (configId: string, params?: RequestParams) => Promise<ApiScoreConfig>;
        /**
         * @description Create a score (supports both trace and session scores)
         *
         * @tags Score
         * @name ScoreCreate
         * @request POST:/api/public/scores
         * @secure
         */
        scoreCreate: (data: ApiCreateScoreRequest, params?: RequestParams) => Promise<ApiCreateScoreResponse>;
        /**
         * @description Delete a score (supports both trace and session scores)
         *
         * @tags Score
         * @name ScoreDelete
         * @request DELETE:/api/public/scores/{scoreId}
         * @secure
         */
        scoreDelete: (scoreId: string, params?: RequestParams) => Promise<void>;
        /**
         * @description Get a list of scores (supports both trace and session scores)
         *
         * @tags ScoreV2
         * @name ScoreV2Get
         * @request GET:/api/public/v2/scores
         * @secure
         */
        scoreV2Get: (query: ApiScoreV2GetParams, params?: RequestParams) => Promise<ApiGetScoresResponse>;
        /**
         * @description Get a score (supports both trace and session scores)
         *
         * @tags ScoreV2
         * @name ScoreV2GetById
         * @request GET:/api/public/v2/scores/{scoreId}
         * @secure
         */
        scoreV2GetById: (scoreId: string, params?: RequestParams) => Promise<ApiScore>;
        /**
         * @description Get a session. Please note that `traces` on this endpoint are not paginated, if you plan to fetch large sessions, consider `GET /api/public/traces?sessionId=<sessionId>`
         *
         * @tags Sessions
         * @name SessionsGet
         * @request GET:/api/public/sessions/{sessionId}
         * @secure
         */
        sessionsGet: (sessionId: string, params?: RequestParams) => Promise<ApiSessionWithTraces>;
        /**
         * @description Get sessions
         *
         * @tags Sessions
         * @name SessionsList
         * @request GET:/api/public/sessions
         * @secure
         */
        sessionsList: (query: ApiSessionsListParams, params?: RequestParams) => Promise<ApiPaginatedSessions>;
        /**
         * @description Delete a specific trace
         *
         * @tags Trace
         * @name TraceDelete
         * @request DELETE:/api/public/traces/{traceId}
         * @secure
         */
        traceDelete: (traceId: string, params?: RequestParams) => Promise<ApiDeleteTraceResponse>;
        /**
         * @description Delete multiple traces
         *
         * @tags Trace
         * @name TraceDeleteMultiple
         * @request DELETE:/api/public/traces
         * @secure
         */
        traceDeleteMultiple: (data: ApiTraceDeleteMultiplePayload, params?: RequestParams) => Promise<ApiDeleteTraceResponse>;
        /**
         * @description Get a specific trace
         *
         * @tags Trace
         * @name TraceGet
         * @request GET:/api/public/traces/{traceId}
         * @secure
         */
        traceGet: (traceId: string, params?: RequestParams) => Promise<ApiTraceWithFullDetails>;
        /**
         * @description Get list of traces
         *
         * @tags Trace
         * @name TraceList
         * @request GET:/api/public/traces
         * @secure
         */
        traceList: (query: ApiTraceListParams, params?: RequestParams) => Promise<ApiTraces>;
    };
}

type LangfuseOptions = {
    persistence?: "localStorage" | "sessionStorage" | "cookie" | "memory";
    persistence_name?: string;
    enabled?: boolean;
} & LangfuseCoreOptions;

declare class Langfuse extends LangfuseCore {
    private _storage;
    private _storageCache;
    private _storageKey;
    api: LangfusePublicApi<null>["api"];
    constructor(params?: {
        publicKey?: string;
        secretKey?: string;
    } & LangfuseOptions);
    getPersistedProperty<T>(key: LangfusePersistedProperty): T | undefined;
    setPersistedProperty<T>(key: LangfusePersistedProperty, value: T | null): void;
    fetch(url: string, options: LangfuseFetchOptions): Promise<LangfuseFetchResponse>;
    getLibraryId(): string;
    getLibraryVersion(): string;
    getCustomUserAgent(): void;
}
declare class LangfuseWeb extends LangfuseWebStateless {
    private _storage;
    private _storageCache;
    private _storageKey;
    constructor(params?: Omit<LangfuseOptions, "secretKey">);
    getPersistedProperty<T>(key: LangfusePersistedProperty): T | undefined;
    setPersistedProperty<T>(key: LangfusePersistedProperty, value: T | null): void;
    fetch(url: string, options: LangfuseFetchOptions): Promise<LangfuseFetchResponse>;
    getLibraryId(): string;
    getLibraryVersion(): string;
    getCustomUserAgent(): void;
}

/**
 * Represents a singleton instance of the Langfuse client.
 */
declare class LangfuseSingleton {
    private static instance;
    /**
     * Returns the singleton instance of the Langfuse client.
     * @param params Optional parameters for initializing the Langfuse instance. Only used for the first call.
     * @returns The singleton instance of the Langfuse client.
     */
    static getInstance(params?: LangfuseInitParams): Langfuse;
}

type LangfuseInitParams = {
    publicKey?: string;
    secretKey?: string;
} & LangfuseCoreOptions;
type LangfuseTraceConfig = Pick<CreateLangfuseTraceBody, "sessionId" | "userId" | "release" | "version" | "metadata" | "tags">;
type LangfuseGenerationConfig = Pick<CreateLangfuseGenerationBody, "metadata" | "version" | "promptName" | "promptVersion">;
type LangfuseNewTraceConfig = LangfuseTraceConfig & {
    traceId?: string;
    traceName?: string;
    clientInitParams?: LangfuseInitParams;
};
type LangfuseParent = LangfuseTraceClient | LangfuseSpanClient | LangfuseGenerationClient;
type LangfuseWithParentConfig = LangfuseGenerationConfig & {
    parent: LangfuseParent;
};
type LangfuseConfig = (LangfuseNewTraceConfig | LangfuseWithParentConfig) & {
    generationName?: string;
    langfusePrompt?: LangfusePromptClient;
};
type LangfuseExtension = OpenAI & Pick<ReturnType<typeof LangfuseSingleton.getInstance>, "flushAsync" | "shutdownAsync">;

/**
 * Wraps an OpenAI SDK object with Langfuse tracing. Function calls are extended with a tracer that logs detailed information about the call, including the method name,
 * input parameters, and output.
 *
 * @param {T} sdk - The OpenAI SDK object to be wrapped.
 * @param {LangfuseConfig} [langfuseConfig] - Optional configuration object for the wrapper.
 * @param {string} [langfuseConfig.traceName] - The name to use for tracing. If not provided, a default name based on the SDK's constructor name and the method name will be used.
 * @param {string} [langfuseConfig.sessionId] - Optional session ID for tracing.
 * @param {string} [langfuseConfig.userId] - Optional user ID for tracing.
 * @param {string} [langfuseConfig.release] - Optional release version for tracing.
 * @param {string} [langfuseConfig.version] - Optional version for tracing.
 * @param {string} [langfuseConfig.metadata] - Optional metadata for tracing.
 * @param {string} [langfuseConfig.tags] - Optional tags for tracing.
 * @returns {T} - A proxy of the original SDK object with methods wrapped for tracing.
 *
 * @example
 * const client = new OpenAI();
 * const res = observeOpenAI(client, { traceName: "My.OpenAI.Chat.Trace" }).chat.completions.create({
 *      messages: [{ role: "system", content: "Say this is a test!" }],
        model: "gpt-3.5-turbo",
        user: "langfuse",
        max_tokens: 300
 * });
 * */
declare const observeOpenAI: <SDKType extends object>(sdk: SDKType, langfuseConfig?: LangfuseConfig) => SDKType & LangfuseExtension;

export { type ApiAnnotationQueue, type ApiAnnotationQueueItem, type ApiAnnotationQueueObjectType, type ApiAnnotationQueueStatus, type ApiAnnotationQueuesListQueueItemsParams, type ApiAnnotationQueuesListQueuesParams, type ApiApiKeyDeletionResponse, type ApiApiKeyList, type ApiApiKeyResponse, type ApiApiKeySummary, type ApiAuthenticationScheme, type ApiBaseEvent, type ApiBasePrompt, type ApiBaseScore, type ApiBaseScoreV1, type ApiBooleanScore, type ApiBooleanScoreV1, type ApiBulkConfig, type ApiCategoricalScore, type ApiCategoricalScoreV1, type ApiChatMessage, type ApiChatMessageWithPlaceholders, type ApiChatPrompt, type ApiComment, type ApiCommentObjectType, type ApiCommentsGetParams, type ApiConfig, type ApiConfigCategory, type ApiCreateAnnotationQueueItemRequest, type ApiCreateChatPromptRequest, type ApiCreateCommentRequest, type ApiCreateCommentResponse, type ApiCreateDatasetItemRequest, type ApiCreateDatasetRequest, type ApiCreateDatasetRunItemRequest, type ApiCreateEventBody, type ApiCreateEventEvent, type ApiCreateGenerationBody, type ApiCreateGenerationEvent, type ApiCreateModelRequest, type ApiCreateObservationEvent, type ApiCreatePromptRequest, type ApiCreateScoreConfigRequest, type ApiCreateScoreRequest, type ApiCreateScoreResponse, type ApiCreateScoreValue, type ApiCreateSpanBody, type ApiCreateSpanEvent, type ApiCreateTextPromptRequest, type ApiDataset, type ApiDatasetItem, type ApiDatasetItemsListParams, type ApiDatasetRun, type ApiDatasetRunItem, type ApiDatasetRunItemsListParams, type ApiDatasetRunWithItems, type ApiDatasetStatus, type ApiDatasetsGetRunsParams, type ApiDatasetsListParams, type ApiDeleteAnnotationQueueItemResponse, type ApiDeleteDatasetItemResponse, type ApiDeleteDatasetRunResponse, type ApiDeleteTraceResponse, type ApiEmptyResponse, type ApiFilterConfig, type ApiGetCommentsResponse, type ApiGetMediaResponse, type ApiGetMediaUploadUrlRequest, type ApiGetMediaUploadUrlResponse, type ApiGetScoresResponse, type ApiGetScoresResponseData, type ApiGetScoresResponseDataBoolean, type ApiGetScoresResponseDataCategorical, type ApiGetScoresResponseDataNumeric, type ApiGetScoresResponseTraceData, type ApiHealthResponse, type ApiIngestionBatchPayload, type ApiIngestionError, type ApiIngestionEvent, type ApiIngestionResponse, type ApiIngestionSuccess, type ApiIngestionUsage, type ApiMapValue, type ApiMediaContentType, type ApiMembershipRequest, type ApiMembershipResponse, type ApiMembershipRole, type ApiMembershipsResponse, type ApiMetricsMetricsParams, type ApiMetricsResponse, type ApiModel, type ApiModelPrice, type ApiModelUsageUnit, type ApiModelsListParams, type ApiNumericScore, type ApiNumericScoreV1, type ApiObservation, type ApiObservationBody, type ApiObservationLevel, type ApiObservationType, type ApiObservations, type ApiObservationsGetManyParams, type ApiObservationsView, type ApiObservationsViews, type ApiOpenAICompletionUsageSchema, type ApiOpenAIResponseUsageSchema, type ApiOpenAIUsage, type ApiOptionalObservationBody, type ApiOrganizationProject, type ApiOrganizationProjectsResponse, type ApiPaginatedAnnotationQueueItems, type ApiPaginatedAnnotationQueues, type ApiPaginatedDatasetItems, type ApiPaginatedDatasetRunItems, type ApiPaginatedDatasetRuns, type ApiPaginatedDatasets, type ApiPaginatedModels, type ApiPaginatedSessions, type ApiPatchMediaBody, type ApiPlaceholderMessage, type ApiProject, type ApiProjectDeletionResponse, type ApiProjects, type ApiProjectsCreateApiKeyPayload, type ApiProjectsCreatePayload, type ApiProjectsUpdatePayload, type ApiPrompt, type ApiPromptMeta, type ApiPromptMetaListResponse, type ApiPromptVersionUpdatePayload, type ApiPromptsGetParams, type ApiPromptsListParams, type ApiResourceMeta, type ApiResourceType, type ApiResourceTypesResponse, type ApiSDKLogBody, type ApiSDKLogEvent, type ApiSchemaExtension, type ApiSchemaResource, type ApiSchemasResponse, type ApiScimCreateUserPayload, type ApiScimEmail, type ApiScimFeatureSupport, type ApiScimListUsersParams, type ApiScimName, type ApiScimUser, type ApiScimUsersListResponse, type ApiScore, type ApiScoreBody, type ApiScoreConfig, type ApiScoreConfigs, type ApiScoreConfigsGetParams, type ApiScoreDataType, type ApiScoreEvent, type ApiScoreSource, type ApiScoreV1, type ApiScoreV2GetParams, type ApiServiceProviderConfig, type ApiSession, type ApiSessionWithTraces, type ApiSessionsListParams, type ApiSort, type ApiTextPrompt, type ApiTrace, type ApiTraceBody, type ApiTraceDeleteMultiplePayload, type ApiTraceEvent, type ApiTraceListParams, type ApiTraceWithDetails, type ApiTraceWithFullDetails, type ApiTraces, type ApiUpdateAnnotationQueueItemRequest, type ApiUpdateEventBody, type ApiUpdateGenerationBody, type ApiUpdateGenerationEvent, type ApiUpdateObservationEvent, type ApiUpdateSpanBody, type ApiUpdateSpanEvent, type ApiUsage, type ApiUsageDetails, type ApiUserMeta, type ApiUtilsMetaResponse, ContentType, type FullRequestParams, HttpClient, type HttpResponse, Langfuse, type LangfuseConfig, type LangfuseOptions, type LangfuseParent, LangfusePublicApi, LangfuseWeb, type QueryParamsType, type RequestParams, type ResponseFormat, Langfuse as default, observeOpenAI };
