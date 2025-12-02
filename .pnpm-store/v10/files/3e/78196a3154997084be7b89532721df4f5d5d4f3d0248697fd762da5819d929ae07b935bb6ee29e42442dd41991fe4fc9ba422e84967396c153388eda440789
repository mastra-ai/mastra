/// <reference types="node" />
import { AnalyticsIndexManager } from './analyticsindexmanager';
import { AnalyticsMetaData, AnalyticsQueryOptions, AnalyticsResult } from './analyticstypes';
import { Authenticator } from './authenticators';
import { CppConnection } from './binding';
import { Bucket } from './bucket';
import { BucketManager } from './bucketmanager';
import { DiagnosticsOptions, DiagnosticsResult, PingOptions, PingResult } from './diagnosticstypes';
import { EventingFunctionManager } from './eventingfunctionmanager';
import { QueryIndexManager } from './queryindexmanager';
import { QueryMetaData, QueryOptions, QueryResult } from './querytypes';
import { SearchIndexManager } from './searchindexmanager';
import { SearchQuery } from './searchquery';
import { SearchMetaData, SearchQueryOptions, SearchRequest, SearchResult, SearchRow } from './searchtypes';
import { StreamableRowPromise } from './streamablepromises';
import { Transactions, TransactionsConfig } from './transactions';
import { Transcoder } from './transcoders';
import { UserManager } from './usermanager';
import { NodeCallback } from './utilities';
import { inspect } from 'util';
/**
 * Specifies the timeout options for the client.
 *
 * @category Core
 */
export interface TimeoutConfig {
    /**
     * Specifies the default timeout for KV operations, specified in millseconds.
     */
    kvTimeout?: number;
    /**
     * Specifies the default timeout for durable KV operations, specified in millseconds.
     */
    kvDurableTimeout?: number;
    /**
     * Specifies the default timeout for views operations, specified in millseconds.
     */
    viewTimeout?: number;
    /**
     * Specifies the default timeout for query operations, specified in millseconds.
     */
    queryTimeout?: number;
    /**
     * Specifies the default timeout for analytics query operations, specified in millseconds.
     */
    analyticsTimeout?: number;
    /**
     * Specifies the default timeout for search query operations, specified in millseconds.
     */
    searchTimeout?: number;
    /**
     * Specifies the default timeout for management operations, specified in millseconds.
     */
    managementTimeout?: number;
    /**
     * Specifies the default timeout allocated to complete bootstrap, specified in millseconds.
     */
    bootstrapTimeout?: number;
    /**
     * Specifies the default timeout for attempting to connect to a node’s KV service via a socket, specified in millseconds.
     */
    connectTimeout?: number;
    /**
     * Specifies the default timeout to resolve DNS name of the node to IP address, specified in millseconds.
     */
    resolveTimeout?: number;
}
/**
 * Specifies security options for the client.
 *
 * @category Core
 */
export interface SecurityConfig {
    /**
     * Specifies the path to a trust store file to be used when validating the
     * authenticity of the server when connecting over SSL.
     */
    trustStorePath?: string;
}
/**
 * Specifies DNS options for the client.
 *
 * Volatile: This API is subject to change at any time.
 *
 * @category Core
 */
export interface DnsConfig {
    /**
     * Specifies the nameserver to be used for DNS query when connecting.
     */
    nameserver?: string;
    /**
     * Specifies the port to be used for DNS query when connecting.
     */
    port?: number;
    /**
     * Specifies the default timeout for DNS SRV operations, specified in millseconds.
     */
    dnsSrvTimeout?: number;
}
/**
 * Specifies Application Telemetry options for the client.
 *
 * @category Core
 */
export interface AppTelemetryConfig {
    /**
     * Specifies if application telemetry feature should be enabled or not.
     */
    enabled?: boolean;
    /**
     * Specifies an endpoint to override the application metrics endpoint discovered during configuration.
     */
    endpoint?: string;
    /**
     * Specifies the time to wait before attempting a websocket reconnection, specified in millseconds.
     */
    backoff?: number;
    /**
     * Specifies the time to wait between sending consecutive websocket PING commands to the server, specified in millseconds.
     */
    pingInterval?: number;
    /**
     * Specifies the time allowed for the server to respond to websocket PING command, specified in millseconds.
     */
    pingTimeout?: number;
}
/**
 * Specifies threshold logging options for the client.
 *
 * NOTE:  These options are used to configure the underlying C++ core threshold logging.
 *
 * @category Core
 */
export interface TracingConfig {
    /**
     * Specifies to enable or disable threshold logging.
     * Defaults to true (enabled) if not specified.
     */
    enableTracing?: boolean;
    /**
     * Specifies the interval after which the aggregated trace information is logged, specified in millseconds.
     * Defaults to 10000 (10 seconds) if not specified.
     */
    emitInterval?: number;
    /**
     * Specifies how many entries to sample per service in each emit interval.
     * Defaults to 64 if not specified.
     */
    sampleSize?: number;
    /**
     * Threshold over which the request is taken into account for the KV service, specified in millseconds.
     * Defaults to 500ms if not specified.
     */
    kvThreshold?: number;
    /**
     * Threshold over which the request is taken into account for the query service, specified in millseconds.
     * Defaults to 1000ms if not specified.
     */
    queryThreshold?: number;
    /**
     * Threshold over which the request is taken into account for the search service, specified in millseconds.
     * Defaults to 1000ms if not specified.
     */
    searchThreshold?: number;
    /**
     * Threshold over which the request is taken into account for the analytics service, specified in millseconds.
     * Defaults to 1000ms if not specified.
     */
    analyticsThreshold?: number;
    /**
     * Threshold over which the request is taken into account for management operations, specified in millseconds.
     * Defaults to 1000ms if not specified.
     */
    managementThreshold?: number;
    /**
     * Threshold over which the request is taken into account for eventing service, specified in millseconds.
     * Defaults to 1000ms if not specified.
     */
    eventingThreshold?: number;
    /**
     * Threshold over which the request is taken into account for the views service, specified in millseconds.
     * Defaults to 1000ms if not specified.
     */
    viewsThreshold?: number;
}
/**
 * Specifies orphan report logging options for the client.
 *
 * NOTE:  These options are used to configure the underlying C++ core orphan report logging.
 *
 * @category Core
 */
export interface OrphanReporterConfig {
    /**
     * Specifies the interval after which the aggregated orphaned response information is logged, specified in millseconds.
     * Defaults to 10000 (10 seconds) if not specified.
     */
    emitInterval?: number;
    /**
     * Specifies how many orphaned response entries to sample per service in each emit interval.
     * Defaults to 64 if not specified.
     */
    sampleSize?: number;
}
/**
 * Specifies metrics logging options for the client.
 *
 * NOTE:  These options are used to configure the underlying C++ core metrics logging.
 *
 * @category Core
 */
export interface MetricsConfig {
    /**
     * Specifies to enable or disable metrics logging.
     * Defaults to true (enabled) if not specified.
     */
    enableMetrics?: boolean;
    /**
     * Specifies the interval after which metrics information is logged, specified in millseconds.
     * Defaults to 10 minutes if not specified.
     */
    emitInterval?: number;
}
/**
 * Specifies the options which can be specified when connecting
 * to a cluster.
 *
 * @category Core
 */
export interface ConnectOptions {
    /**
     * Specifies a username to use for an implicitly created IPasswordAuthenticator
     * used for authentication with the cluster.
     */
    username?: string;
    /**
     * Specifies a password to be used in concert with username for authentication.
     *
     * @see ConnectOptions.username
     */
    password?: string;
    /**
     * Specifies a specific authenticator to use when connecting to the cluster.
     */
    authenticator?: Authenticator;
    /**
     * Specifies the security config for connections of this cluster.
     */
    security?: SecurityConfig;
    /**
     * Specifies the default timeouts for various operations performed by the SDK.
     */
    timeouts?: TimeoutConfig;
    /**
     * Specifies the default transcoder to use when encoding or decoding document values.
     */
    transcoder?: Transcoder;
    /**
     * Specifies the options for transactions.
     */
    transactions?: TransactionsConfig;
    /**
     * Specifies the DNS config for connections of this cluster.
     *
     * Volatile: This API is subject to change at any time.
     *
     */
    dnsConfig?: DnsConfig;
    /**
     * Applies the specified ConfigProfile options to the cluster.
     *
     * Volatile: This API is subject to change at any time.
     *
     */
    configProfile?: string;
    /**
     * Specifies the preferred server group to use for replica operations that specify a non-default
     * read preference.
     */
    preferredServerGroup?: string;
    /**
     * Specifies the Application Telemetry config for connections of this cluster.
     *
     */
    appTelemetryConfig?: AppTelemetryConfig;
    /**
     * Specifies the tracing (threshold logging) config for connections of this cluster.
     */
    tracingConfig?: TracingConfig;
    /**
     * Specifies the orphan report logging config for connections of this cluster.
     */
    orphanReporterConfig?: OrphanReporterConfig;
    /**
     * Specifies the metrics config for connections of this cluster.
     */
    metricsConfig?: MetricsConfig;
}
/**
 * Exposes the operations which are available to be performed against a cluster.
 * Namely the ability to access to Buckets as well as performing management
 * operations against the cluster.
 *
 * @category Core
 */
export declare class Cluster {
    private _connStr;
    private _trustStorePath;
    private _kvTimeout;
    private _kvDurableTimeout;
    private _viewTimeout;
    private _queryTimeout;
    private _analyticsTimeout;
    private _searchTimeout;
    private _managementTimeout;
    private _connectTimeout;
    private _bootstrapTimeout;
    private _resolveTimeout;
    private _auth;
    private _conn;
    private _transcoder;
    private _txnConfig;
    private _transactions?;
    private _openBuckets;
    private _dnsConfig;
    private _preferredServerGroup;
    private _appTelemetryConfig;
    private _tracingConfig;
    private _orphanReporterConfig;
    private _metricsConfig;
    /**
     * @internal
     */
    get conn(): CppConnection;
    /**
    @internal
    */
    get transcoder(): Transcoder;
    /**
    @internal
    */
    get kvTimeout(): number;
    /**
    @internal
    */
    get kvDurableTimeout(): number;
    /**
    @internal
    */
    get viewTimeout(): number;
    /**
    @internal
    */
    get queryTimeout(): number;
    /**
    @internal
    */
    get analyticsTimeout(): number;
    /**
    @internal
    */
    get searchTimeout(): number;
    /**
    @internal
    */
    get managementTimeout(): number;
    /**
    @internal
    */
    get bootstrapTimeout(): number | undefined;
    /**
    @internal
    */
    get connectTimeout(): number | undefined;
    /**
    @internal
    */
    get resolveTimeout(): number | undefined;
    /**
     * @internal
     */
    [inspect.custom](): Record<string, any>;
    /**
     * @internal
     */
    toJSON(): Record<string, any>;
    /**
    @internal
    @deprecated Use the static sdk-level {@link connect} method instead.
    */
    constructor(connStr: string, options?: ConnectOptions);
    /**
    @internal
    */
    static connect(connStr: string, options?: ConnectOptions, callback?: NodeCallback<Cluster>): Promise<Cluster>;
    /**
     * Creates a Bucket object reference to a specific bucket.
     *
     * @param bucketName The name of the bucket to reference.
     */
    bucket(bucketName: string): Bucket;
    /**
     * Returns a UserManager which can be used to manage the users
     * of this cluster.
     */
    users(): UserManager;
    /**
     * Returns a BucketManager which can be used to manage the buckets
     * of this cluster.
     */
    buckets(): BucketManager;
    /**
     * Returns a QueryIndexManager which can be used to manage the query indexes
     * of this cluster.
     */
    queryIndexes(): QueryIndexManager;
    /**
     * Returns a AnalyticsIndexManager which can be used to manage the analytics
     * indexes of this cluster.
     */
    analyticsIndexes(): AnalyticsIndexManager;
    /**
     * Returns a SearchIndexManager which can be used to manage the search
     * indexes of this cluster.
     */
    searchIndexes(): SearchIndexManager;
    /**
     * Returns a EventingFunctionManager which can be used to manage the eventing
     * functions of this cluster.
     * Uncommitted: This API is subject to change in the future.
     */
    eventingFunctions(): EventingFunctionManager;
    /**
     * Returns a Transactions object which can be used to perform transactions
     * on this cluster.
     */
    transactions(): Transactions;
    /**
     * Executes a N1QL query against the cluster.
     *
     * @param statement The N1QL statement to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    query<TRow = any>(statement: string, options?: QueryOptions, callback?: NodeCallback<QueryResult<TRow>>): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData>;
    /**
     * Executes an analytics query against the cluster.
     *
     * @param statement The analytics statement to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    analyticsQuery<TRow = any>(statement: string, options?: AnalyticsQueryOptions, callback?: NodeCallback<AnalyticsResult<TRow>>): StreamableRowPromise<AnalyticsResult<TRow>, TRow, AnalyticsMetaData>;
    /**
     * Executes a search query against the cluster.
     *
     * @param indexName The name of the index to query.
     * @param query The SearchQuery describing the query to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    searchQuery(indexName: string, query: SearchQuery, options?: SearchQueryOptions, callback?: NodeCallback<SearchResult>): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData>;
    /**
     * Executes a search query against the cluster.
     *
     * @param indexName The name of the index to query.
     * @param request The SearchRequest describing the search to execute.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    search(indexName: string, request: SearchRequest, options?: SearchQueryOptions, callback?: NodeCallback<SearchResult>): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData>;
    /**
     * Returns a diagnostics report about the currently active connections with the
     * cluster.  Includes information about remote and local addresses, last activity,
     * and other diagnostics information.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    diagnostics(options?: DiagnosticsOptions, callback?: NodeCallback<DiagnosticsResult>): Promise<DiagnosticsResult>;
    /**
     * Performs a ping operation against the cluster.  Pinging the services which
     * are specified (or all services if none are specified).  Returns a report
     * which describes the outcome of the ping operations which were performed.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    ping(options?: PingOptions, callback?: NodeCallback<PingResult>): Promise<PingResult>;
    /**
     * Shuts down this cluster object.  Cleaning up all resources associated with it.
     *
     * @param callback A node-style callback to be invoked after execution.
     */
    close(callback?: NodeCallback<void>): Promise<void>;
    private _connect;
}
