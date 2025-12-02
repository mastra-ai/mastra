import { Cluster } from './cluster';
import { QueryScanConsistency } from './querytypes';
import { NodeCallback } from './utilities';
import { CppManagementEventingFunction, CppManagementEventingFunctionBucketBinding, CppManagementEventingFunctionConstantBinding, CppManagementEventingFunctionSettings, CppManagementEventingFunctionUrlBinding, CppManagementEventingStatus, CppManagementEventingFunctionState } from './binding';
/**
 * Represents the various dcp boundary options for eventing functions.
 *
 * @category Management
 */
export declare enum EventingFunctionDcpBoundary {
    /**
     * Indicates all documents should be processed by the function.
     */
    Everything = "everything",
    /**
     * Indicates that only documents modified after a function is created
     * should be processed by the function.
     */
    FromNow = "from_now"
}
/**
 * Represents the various possible deployment statuses for an eventing function.
 *
 * @category Management
 */
export declare enum EventingFunctionDeploymentStatus {
    /**
     * Indicates that the function is deployed.
     */
    Deployed = "deployed",
    /**
     * Indicates that the function has not yet been deployed.
     */
    Undeployed = "undeployed"
}
/**
 * Represents the various possible processing statuses for an eventing function.
 *
 * @category Management
 */
export declare enum EventingFunctionProcessingStatus {
    /**
     * Indicates that the eventing function is currently running.
     */
    Running = "running",
    /**
     * Indicates that the eventing function is currently paused.
     */
    Paused = "paused"
}
/**
 * Represents the authentication method to use for a URL binding.
 *
 * @category Management
 */
export declare enum EventingFunctionStatus {
    /**
     * Indicates that the eventing function is undeployed.
     */
    Undeployed = "undeployed",
    /**
     * Indicates that the eventing function is deploying.
     */
    Deploying = "deploying",
    /**
     * Indicates that the eventing function is deployed.
     */
    Deployed = "deployed",
    /**
     * Indicates that the eventing function is undeploying.
     */
    Undeploying = "undeploying",
    /**
     * Indicates that the eventing function is paused.
     */
    Paused = "paused",
    /**
     * Indicates that the eventing function is pausing.
     */
    Pausing = "pausing"
}
/**
 * Represents the language compatibility levels of an eventing function.
 *
 * @category Management
 */
export declare enum EventingFunctionLanguageCompatibility {
    /**
     * Indicates that the function should run with compatibility with
     * Couchbase Server 6.0.0.
     */
    Version_6_0_0 = "6.0.0",
    /**
     * Indicates that the function should run with compatibility with
     * Couchbase Server 6.5.0.
     */
    Version_6_5_0 = "6.5.0",
    /**
     * Indicates that the function should run with compatibility with
     * Couchbase Server 6.6.2.
     */
    Version_6_6_2 = "6.6.2",
    /**
     * Indicates that the function should run with compatibility with
     * Couchbase Server 7.2.0.
     */
    Version_7_2_0 = "7.2.0"
}
/**
 * Represents the various log levels for an eventing function.
 *
 * @category Management
 */
export declare enum EventingFunctionLogLevel {
    /**
     * Indicates to use INFO level logging.
     */
    Info = "INFO",
    /**
     * Indicates to use ERROR level logging.
     */
    Error = "ERROR",
    /**
     * Indicates to use WARNING level logging.
     */
    Warning = "WARNING",
    /**
     * Indicates to use DEBUG level logging.
     */
    Debug = "DEBUG",
    /**
     * Indicates to use TRACE level logging.
     */
    Trace = "TRACE"
}
/**
 * Represents the various bucket access levels for an eventing function.
 *
 * @category Management
 */
export declare enum EventingFunctionBucketAccess {
    /**
     * Indicates that the function can only read the associated bucket.
     */
    ReadOnly = "r",
    /**
     * Indicates that the function can both read and write the associated bucket.
     */
    ReadWrite = "rw"
}
/**
 * Represents the authentication method to use for a URL binding.
 *
 * @category Management
 */
export declare enum EventingFunctionUrlAuthMethod {
    /**
     * Indicates that no authentication should be used.
     */
    None = "no-auth",
    /**
     * Indicates that Basic should be used.
     */
    Basic = "basic",
    /**
     * Indicates that Digest should be used.
     */
    Digest = "digest",
    /**
     * Indicates that Bearer should be used.
     */
    Bearer = "bearer"
}
/**
 * Specifies the bucket/scope/collection used by an eventing function.
 *
 * @category Management
 */
export declare class EventingFunctionKeyspace {
    constructor(v: EventingFunctionKeyspace);
    /**
     * The bucket to use.
     */
    bucket: string;
    /**
     * The scope to use.
     */
    scope?: string;
    /**
     * The collection to use.
     */
    collection?: string;
}
/**
 * Specifies a bucket binding for an eventing function.
 *
 * @category Management
 */
export declare class EventingFunctionBucketBinding {
    constructor(v: EventingFunctionBucketBinding);
    /**
     * The alias to use for referring to this binding.
     */
    alias: string;
    /**
     * The keyspace that this binding refers to.
     */
    name: EventingFunctionKeyspace;
    /**
     * The level of access configured for this binding.
     */
    access: EventingFunctionBucketAccess;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementEventingFunctionBucketBinding): EventingFunctionBucketBinding;
    /**
     * @internal
     */
    static _toCppData(data: EventingFunctionBucketBinding): CppManagementEventingFunctionBucketBinding;
}
/**
 * Specifies a type of url authentication to use.
 *
 * @category Management
 */
export interface EventingFunctionUrlAuth {
    /**
     * The method of authentication to use.
     */
    method: EventingFunctionUrlAuthMethod;
}
/**
 * Specifies that Basic authentication should be used for the URL.
 *
 * @category Management
 */
export declare class EventingFunctionUrlAuthBasic implements EventingFunctionUrlAuth {
    /**
     * Sets the auth method to Basic.
     */
    method: EventingFunctionUrlAuthMethod;
    constructor(v: Omit<EventingFunctionUrlAuthBasic, 'method'>);
    /**
     * Specifies the username to use for authentication.
     */
    username: string;
    /**
     * Specifies the password to use for authentication.
     */
    password: string;
}
/**
 * Specifies that Digest authentication should be used for the URL.
 *
 * @category Management
 */
export declare class EventingFunctionUrlAuthDigest implements EventingFunctionUrlAuth {
    /**
     * Sets the auth method to Digest.
     */
    method: EventingFunctionUrlAuthMethod;
    constructor(v: Omit<EventingFunctionUrlAuthDigest, 'method'>);
    /**
     * Specifies the username to use for authentication.
     */
    username: string;
    /**
     * Specifies the password to use for authentication.
     */
    password: string;
}
/**
 * Specifies that Bearer authentication should be used for the URL.
 *
 * @category Management
 */
export declare class EventingFunctionUrlAuthBearer implements EventingFunctionUrlAuth {
    /**
     * Sets the auth method to Bearer.
     */
    method: EventingFunctionUrlAuthMethod;
    constructor(v: Omit<EventingFunctionUrlAuthBearer, 'method'>);
    /**
     * Specifies the bearer token to use.
     */
    key: string;
}
/**
 * Specifies a url binding for an eventing function.
 *
 * @category Management
 */
export declare class EventingFunctionUrlBinding {
    constructor(v: EventingFunctionUrlBinding);
    /**
     * The alias to use for referring to this binding.
     */
    alias: string;
    /**
     * The hostname this url binding should refer to.
     */
    hostname: string;
    /**
     * The authentication that should be used.
     */
    auth?: EventingFunctionUrlAuth;
    /**
     * Whether or not cookies should be allowed.
     */
    allowCookies: boolean;
    /**
     * Whether the SSL certificate should be validated.
     */
    validateSslCertificate: boolean;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementEventingFunctionUrlBinding): EventingFunctionUrlBinding;
    /**
     * @internal
     */
    static _toCppData(data: EventingFunctionUrlBinding): CppManagementEventingFunctionUrlBinding;
}
/**
 * Specifies a constant binding for an eventing function.
 *
 * @category Management
 */
export declare class EventingFunctionConstantBinding {
    constructor(v: EventingFunctionConstantBinding);
    /**
     * The alias to use for referring to this binding.
     */
    alias: string;
    /**
     * The literal value for this binding.
     */
    literal: string;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementEventingFunctionConstantBinding): EventingFunctionConstantBinding;
    /**
     * @internal
     */
    static _toCppData(data: EventingFunctionConstantBinding): CppManagementEventingFunctionConstantBinding;
}
/**
 * Specifies a number of options which can be used when updating or creating
 * a eventing function.
 *
 * @category Management
 */
export declare class EventingFunctionSettings {
    constructor(v: EventingFunctionSettings);
    /**
     * The number of worker threads to use for the function.
     */
    cppWorkerThreadCount?: number;
    /**
     * The DCP stream boundary to use.
     */
    dcpStreamBoundary?: EventingFunctionDcpBoundary;
    /**
     * A description of this eventing function.
     */
    description?: string;
    /**
     * The current deployment status of the function.
     */
    deploymentStatus?: EventingFunctionDeploymentStatus;
    /**
     * The current processing status of the function.
     */
    processingStatus?: EventingFunctionProcessingStatus;
    /**
     * The active compatibility mode for the function.
     */
    languageCompatibility?: EventingFunctionLanguageCompatibility;
    /**
     * The level of logging that should be captured for the function.
     */
    logLevel?: EventingFunctionLogLevel;
    /**
     * The maximum period of time the function can execute on a document
     * before timing out.
     */
    executionTimeout?: number;
    /**
     * The maximum number of internal clients that the function should
     * maintain for KV operations.
     */
    lcbInstCapacity?: number;
    /**
     * The maximum number of times to retry a KV operation before failing
     * the function.
     */
    lcbRetryCount?: number;
    /**
     * The maximum period of time a KV operation within the function can
     * operate before timing out.
     */
    lcbTimeout?: number;
    /**
     * The level of consistency to use when performing queries in the function.
     */
    queryConsistency?: QueryScanConsistency;
    /**
     * The number of partitions that should be used for timer tracking.
     */
    numTimerPartitions?: number;
    /**
     * The batch size for messages from producer to consumer.
     */
    sockBatchSize?: number;
    /**
     * The duration to log stats from this handler, in milliseconds.
     */
    tickDuration?: number;
    /**
     * The size limit of timer context object.
     */
    timerContextSize?: number;
    /**
     * The key prefix for all data stored in metadata by this handler.
     */
    userPrefix?: string;
    /**
     * The maximum size in bytes the bucket cache can grow to.
     */
    bucketCacheSize?: number;
    /**
     * The time in milliseconds after which a cached bucket object is considered stale.
     */
    bucketCacheAge?: number;
    /**
     * The maximum allowable curl call response in 'MegaBytes'. Setting the value to 0
     * lifts the upper limit off. This parameters affects v8 engine stability since it
     * defines the maximum amount of heap space acquired by a curl call.
     */
    curlMaxAllowedRespSize?: number;
    /**
     * Whether to automatically prepare all query statements in the handler.
     */
    queryPrepareAll?: boolean;
    /**
     * The number of worker processes handler utilizes on each eventing node.
     */
    workerCount?: number;
    /**
     * The code to automatically prepend to top of handler code.
     */
    handlerHeaders?: string[];
    /**
     * The code to automatically append to bottom of handler code.
     */
    handlerFooters?: string[];
    /**
     * Whether to enable rotating this handlers log() message files.
     */
    enableAppLogRotation?: boolean;
    /**
     * The directory to write content of log() message files.
     */
    appLogDir?: string;
    /**
     * The size in bytes of the log file when the file should be rotated.
     */
    appLogMaxSize?: number;
    /**
     * The number of log() message files to retain when rotating.
     */
    appLogMaxFiles?: number;
    /**
     * The number of seconds before writing a progress checkpoint.
     */
    checkpointInterval?: number;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementEventingFunctionSettings): EventingFunctionSettings;
    /**
     * @internal
     */
    static _toCppData(data: EventingFunctionSettings): CppManagementEventingFunctionSettings;
}
/**
 * Describes an eventing function.
 *
 * @category Management
 */
export declare class EventingFunction {
    constructor(v: EventingFunction);
    /**
     * The name of the eventing function.
     */
    name: string;
    /**
     * The code for this eventing function.
     */
    code: string;
    /**
     * The authoring version of this eventing function.
     */
    version?: string;
    /**
     * Whether to enable stricter validation of settings and configuration.
     */
    enforceSchema?: boolean;
    /**
     * The unique ID for this eventing function.
     */
    handlerUuid?: number;
    /**
     * The unique id for the deployment of the handler.
     */
    functionInstanceId?: string;
    /**
     * The keyspace to store the functions metadata.
     */
    metadataKeyspace: EventingFunctionKeyspace;
    /**
     * The keyspace that the function should operate on.
     */
    sourceKeyspace: EventingFunctionKeyspace;
    /**
     * The buckets to bind to the function.
     */
    bucketBindings: EventingFunctionBucketBinding[];
    /**
     * The URLs to bind to the function.
     */
    urlBindings: EventingFunctionUrlBinding[];
    /**
     * The constants to bind to the function.
     */
    constantBindings: EventingFunctionConstantBinding[];
    /**
     * The settings for this function.
     */
    settings: EventingFunctionSettings;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementEventingFunction): EventingFunction;
    /**
     * @internal
     */
    static _toCppData(data: EventingFunction): CppManagementEventingFunction;
}
/**
 * Describes the current state of an eventing function.
 *
 * @category Management
 */
export declare class EventingFunctionState {
    constructor(v: EventingFunctionState);
    /**
     * The name of the eventing function.
     */
    name: string;
    /**
     * The current overall state of this eventing function.
     */
    status: EventingFunctionStatus;
    /**
     * The number of nodes where this eventing function is bootstrapping.
     */
    numBootstrappingNodes: number;
    /**
     * The number of nodes where this eventing function is deployed.
     */
    numDeployedNodes: number;
    /**
     * The current deployment status of this eventing function.
     */
    deploymentStatus: EventingFunctionDeploymentStatus;
    /**
     * The current processing status of this eventing function.
     */
    processingStatus: EventingFunctionProcessingStatus;
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementEventingFunctionState): EventingFunctionState;
}
/**
 * Describes the current state of all eventing function.
 *
 * @category Management
 */
export declare class EventingState {
    constructor(v: EventingState);
    /**
     * The number of eventing nodes that are currently active.
     */
    numEventingNodes: number;
    /**
     * The states of all registered eventing functions.
     */
    functions: EventingFunctionState[];
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementEventingStatus): EventingState;
}
/**
 * @category Management
 */
export interface UpsertFunctionOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropFunctionOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetAllFunctionsOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetFunctionOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DeployFunctionOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface UndeployFunctionOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface PauseFunctionOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface ResumeFunctionOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface FunctionsStatusOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * EventingFunctionManager provides an interface for managing the
 * eventing functions on the cluster.
 * Uncommitted: This API is subject to change in the future.
 *
 * @category Management
 */
export declare class EventingFunctionManager {
    private _cluster;
    /**
     * @internal
     */
    constructor(cluster: Cluster);
    /**
     * Creates or updates an eventing function.
     *
     * @param functionDefinition The description of the eventing function to upsert.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    upsertFunction(functionDefinition: EventingFunction, options?: UpsertFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Deletes an eventing function.
     *
     * @param name The name of the eventing function to delete.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropFunction(name: string, options?: DropFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Fetches all eventing functions.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllFunctions(options?: GetAllFunctionsOptions, callback?: NodeCallback<EventingFunction[]>): Promise<EventingFunction[]>;
    /**
     * Fetches a specific eventing function.
     *
     * @param name The name of the eventing function to fetch.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getFunction(name: string, options?: GetFunctionOptions, callback?: NodeCallback<EventingFunction>): Promise<EventingFunction>;
    /**
     * Deploys an eventing function.
     *
     * @param name The name of the eventing function to deploy.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    deployFunction(name: string, options?: DeployFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Undeploys an eventing function.
     *
     * @param name The name of the eventing function to undeploy.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    undeployFunction(name: string, options?: DeployFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Pauses an eventing function.
     *
     * @param name The name of the eventing function to pause.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    pauseFunction(name: string, options?: PauseFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Resumes an eventing function.
     *
     * @param name The name of the eventing function to resume.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    resumeFunction(name: string, options?: ResumeFunctionOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Fetches the status of all eventing functions.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    functionsStatus(options?: FunctionsStatusOptions, callback?: NodeCallback<EventingState>): Promise<EventingState>;
}
