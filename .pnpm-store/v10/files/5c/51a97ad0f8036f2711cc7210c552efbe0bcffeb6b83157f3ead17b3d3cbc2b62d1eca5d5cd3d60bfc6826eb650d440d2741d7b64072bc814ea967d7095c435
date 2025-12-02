/// <reference types="node" />
/// <reference types="node" />
export type CppMilliseconds = number;
export type CppSeconds = number;
export type CppBytes = string | Buffer;
export type CppDocFlags = number;
export type CppExpiry = number;
export type CppJsonString = string | Buffer;
export interface CppClusterCredentials {
    username?: string;
    password?: string;
    certificate_path?: string;
    key_path?: string;
    allowed_sasl_mechanisms?: string[];
}
export interface CppDnsConfig {
    nameserver?: string;
    port?: number;
    dnsSrvTimeout?: number;
}
export interface CppAppTelemetryConfig {
    enabled?: boolean;
    endpoint?: string;
    backoff?: number;
    pingInterval?: number;
    pingTimeout?: number;
}
export interface CppTracingConfig {
    enableTracing?: boolean;
    emitInterval?: number;
    sampleSize?: number;
    kvThreshold?: number;
    queryThreshold?: number;
    searchThreshold?: number;
    analyticsThreshold?: number;
    managementThreshold?: number;
    eventingThreshold?: number;
    viewsThreshold?: number;
}
export interface CppOrphanReporterConfig {
    emitInterval?: number;
    sampleSize?: number;
}
export interface CppMetricsConfig {
    enableMetrics?: boolean;
    emitInterval?: number;
}
export interface CppDocumentId {
    bucket: string;
    scope: string;
    collection: string;
    key: string;
}
export interface CppCas {
    toString(): string;
    toJSON(): any;
}
export declare const zeroCas: CppCas;
export type CppCasInput = CppCas | string | Buffer;
export interface CppMutationToken {
    toString(): string;
    toJSON(): any;
}
export interface CppQueryContext {
    bucket_name: string;
    scope_name: string;
}
export interface CppScanIterator {
    cancelled: boolean;
    next(callback: (err: CppError | null, result: CppRangeScanItem | undefined) => void): void;
    cancel(): boolean;
}
export interface CppEncodedValue {
    data: Buffer;
    flags: number;
}
export declare enum CppManagementAnalyticsCouchbaseLinkEncryptionLevel {
}
export declare enum CppManagementClusterBucketType {
}
export declare enum CppManagementClusterBucketCompression {
}
export declare enum CppManagementClusterBucketEvictionPolicy {
}
export declare enum CppManagementClusterBucketConflictResolution {
}
export declare enum CppManagementClusterBucketStorageBackend {
}
export declare enum CppManagementEventingFunctionDcpBoundary {
}
export declare enum CppManagementEventingFunctionLanguageCompatibility {
}
export declare enum CppManagementEventingFunctionLogLevel {
}
export declare enum CppManagementEventingFunctionBucketAccess {
}
export declare enum CppManagementEventingFunctionStatus {
}
export declare enum CppManagementEventingFunctionDeploymentStatus {
}
export declare enum CppManagementEventingFunctionProcessingStatus {
}
export declare enum CppManagementRbacAuthDomain {
}
export declare enum CppRetryReason {
}
export declare enum CppProtocolSubdocOpcode {
}
export declare enum CppAnalyticsScanConsistency {
}
export declare enum CppDesignDocumentNamespace {
}
export declare enum CppDiagClusterState {
}
export declare enum CppDiagEndpointState {
}
export declare enum CppDiagPingState {
}
export declare enum CppQueryProfile {
}
export declare enum CppQueryScanConsistency {
}
export declare enum CppSearchHighlightStyle {
}
export declare enum CppSearchScanConsistency {
}
export declare enum CppServiceType {
}
export declare enum CppViewOnError {
}
export declare enum CppViewScanConsistency {
}
export declare enum CppViewSortOrder {
}
export declare enum CppAnalyticsResponseAnalyticsStatus {
}
export declare enum CppDurabilityLevel {
}
export declare enum CppErrcCommon {
}
export declare enum CppErrcKeyValue {
}
export declare enum CppErrcQuery {
}
export declare enum CppErrcAnalytics {
}
export declare enum CppErrcSearch {
}
export declare enum CppErrcView {
}
export declare enum CppErrcManagement {
}
export declare enum CppErrcFieldLevelEncryption {
}
export declare enum CppErrcNetwork {
}
export declare enum CppKeyValueStatusCode {
}
export declare enum CppImplSubdocOpcode {
}
export declare enum CppStoreSemantics {
}
export declare enum CppPersistTo {
}
export declare enum CppReplicateTo {
}
export declare enum CppReadPreference {
}
export declare enum CppVectorQueryCombination {
}
export declare enum CppTransactionsFailureType {
}
export declare enum CppTransactionsExternalException {
}
export declare enum CppTransactionsTransactionGetMultiMode {
}
export declare enum CppTransactionsTransactionGetMultiReplicasFromPreferredServerGroupMode {
}
export interface CppManagementAnalyticsDataset {
    name: string;
    dataverse_name: string;
    link_name: string;
    bucket_name: string;
}
export interface CppManagementAnalyticsIndex {
    name: string;
    dataverse_name: string;
    dataset_name: string;
    is_primary: boolean;
}
export interface CppManagementAnalyticsAzureBlobExternalLink {
    link_name: string;
    dataverse: string;
    connection_string?: string;
    account_name?: string;
    account_key?: string;
    shared_access_signature?: string;
    blob_endpoint?: string;
    endpoint_suffix?: string;
}
export interface CppManagementAnalyticsCouchbaseLinkEncryptionSettings {
    level: CppManagementAnalyticsCouchbaseLinkEncryptionLevel;
    certificate?: string;
    client_certificate?: string;
    client_key?: string;
}
export interface CppManagementAnalyticsCouchbaseRemoteLink {
    link_name: string;
    dataverse: string;
    hostname: string;
    username?: string;
    password?: string;
    encryption: CppManagementAnalyticsCouchbaseLinkEncryptionSettings;
}
export interface CppManagementAnalyticsS3ExternalLink {
    link_name: string;
    dataverse: string;
    access_key_id: string;
    secret_access_key: string;
    session_token?: string;
    region: string;
    service_endpoint?: string;
}
export interface CppManagementClusterBucketSettings {
    name: string;
    uuid: string;
    ram_quota_mb: number;
    bucket_type: CppManagementClusterBucketType;
    max_expiry?: number;
    compression_mode: CppManagementClusterBucketCompression;
    minimum_durability_level?: CppDurabilityLevel;
    num_replicas?: number;
    replica_indexes?: boolean;
    flush_enabled?: boolean;
    eviction_policy: CppManagementClusterBucketEvictionPolicy;
    conflict_resolution_type: CppManagementClusterBucketConflictResolution;
    history_retention_collection_default?: boolean;
    history_retention_bytes?: number;
    history_retention_duration?: number;
    num_vbuckets?: number;
    storage_backend: CppManagementClusterBucketStorageBackend;
    capabilities: string[];
    nodes: CppManagementClusterBucketSettingsNode[];
}
export interface CppManagementClusterBucketSettingsNode {
    hostname: string;
    status: string;
    version: string;
    services: string[];
    ports: {
        [key: string]: number;
    };
}
export interface CppManagementViewsDesignDocument {
    rev?: string;
    name: string;
    ns: CppDesignDocumentNamespace;
    views: {
        [key: string]: CppManagementViewsDesignDocumentView;
    };
}
export interface CppManagementViewsDesignDocumentView {
    name: string;
    map?: string;
    reduce?: string;
}
export interface CppManagementEventingFunctionKeyspace {
    bucket: string;
    scope?: string;
    collection?: string;
}
export interface CppManagementEventingFunctionSettings {
    cpp_worker_count?: number;
    dcp_stream_boundary?: CppManagementEventingFunctionDcpBoundary;
    description?: string;
    deployment_status?: CppManagementEventingFunctionDeploymentStatus;
    processing_status?: CppManagementEventingFunctionProcessingStatus;
    log_level?: CppManagementEventingFunctionLogLevel;
    language_compatibility?: CppManagementEventingFunctionLanguageCompatibility;
    execution_timeout?: CppMilliseconds;
    lcb_inst_capacity?: number;
    lcb_retry_count?: number;
    lcb_timeout?: CppMilliseconds;
    query_consistency?: CppQueryScanConsistency;
    num_timer_partitions?: number;
    sock_batch_size?: number;
    tick_duration?: CppMilliseconds;
    timer_context_size?: number;
    user_prefix?: string;
    bucket_cache_size?: number;
    bucket_cache_age?: CppMilliseconds;
    curl_max_allowed_resp_size?: number;
    query_prepare_all?: boolean;
    worker_count?: number;
    handler_headers: string[];
    handler_footers: string[];
    enable_app_log_rotation?: boolean;
    app_log_dir?: string;
    app_log_max_size?: number;
    app_log_max_files?: number;
    checkpoint_interval?: CppMilliseconds;
}
export interface CppManagementEventingFunctionBucketBinding {
    alias: string;
    name: CppManagementEventingFunctionKeyspace;
    access: CppManagementEventingFunctionBucketAccess;
}
export interface CppManagementEventingFunctionUrlNoAuth {
}
export interface CppManagementEventingFunctionUrlAuthBasic {
    username: string;
    password: string;
}
export interface CppManagementEventingFunctionUrlAuthDigest {
    username: string;
    password: string;
}
export interface CppManagementEventingFunctionUrlAuthBearer {
    key: string;
}
export interface CppManagementEventingFunctionUrlBinding {
    alias: string;
    hostname: string;
    allow_cookies: boolean;
    validate_ssl_certificate: boolean;
    auth_name: string;
    auth_value: CppManagementEventingFunctionUrlNoAuth | CppManagementEventingFunctionUrlAuthBasic | CppManagementEventingFunctionUrlAuthDigest | CppManagementEventingFunctionUrlAuthBearer;
}
export interface CppManagementEventingFunctionConstantBinding {
    alias: string;
    literal: string;
}
export interface CppManagementEventingFunction {
    name: string;
    code: string;
    metadata_keyspace: CppManagementEventingFunctionKeyspace;
    source_keyspace: CppManagementEventingFunctionKeyspace;
    version?: string;
    enforce_schema?: boolean;
    handler_uuid?: number;
    function_instance_id?: string;
    bucket_bindings: CppManagementEventingFunctionBucketBinding[];
    url_bindings: CppManagementEventingFunctionUrlBinding[];
    constant_bindings: CppManagementEventingFunctionConstantBinding[];
    settings: CppManagementEventingFunctionSettings;
}
export interface CppManagementEventingFunctionState {
    name: string;
    status: CppManagementEventingFunctionStatus;
    num_bootstrapping_nodes: number;
    num_deployed_nodes: number;
    deployment_status: CppManagementEventingFunctionDeploymentStatus;
    processing_status: CppManagementEventingFunctionProcessingStatus;
    redeploy_required?: boolean;
}
export interface CppManagementEventingStatus {
    num_eventing_nodes: number;
    functions: CppManagementEventingFunctionState[];
}
export interface CppManagementRbacRole {
    name: string;
    bucket?: string;
    scope?: string;
    collection?: string;
}
export interface CppManagementRbacRoleAndDescription {
    display_name: string;
    description: string;
    name: string;
    bucket?: string;
    scope?: string;
    collection?: string;
}
export interface CppManagementRbacOrigin {
    type: string;
    name?: string;
}
export interface CppManagementRbacRoleAndOrigins {
    origins: CppManagementRbacOrigin[];
    name: string;
    bucket?: string;
    scope?: string;
    collection?: string;
}
export interface CppManagementRbacUser {
    username: string;
    display_name?: string;
    groups: string[];
    roles: CppManagementRbacRole[];
    password?: string;
}
export interface CppManagementRbacUserAndMetadata {
    domain: CppManagementRbacAuthDomain;
    effective_roles: CppManagementRbacRoleAndOrigins[];
    password_changed?: string;
    external_groups: string[];
    username: string;
    display_name?: string;
    groups: string[];
    roles: CppManagementRbacRole[];
    password?: string;
}
export interface CppManagementRbacGroup {
    name: string;
    description?: string;
    roles: CppManagementRbacRole[];
    ldap_group_reference?: string;
}
export interface CppManagementSearchIndex {
    uuid: string;
    name: string;
    type: string;
    params_json: string;
    source_uuid: string;
    source_name: string;
    source_type: string;
    source_params_json: string;
    plan_params_json: string;
}
export interface CppManagementQueryIndex {
    is_primary: boolean;
    name: string;
    state: string;
    type: string;
    index_key: string[];
    partition?: string;
    condition?: string;
    bucket_name: string;
    scope_name?: string;
    collection_name?: string;
}
export interface CppTopologyCollectionsManifest {
    id: number[];
    uid: number;
    scopes: CppTopologyCollectionsManifestScope[];
}
export interface CppTopologyCollectionsManifestCollection {
    uid: number;
    name: string;
    max_expiry: number;
    history?: boolean;
}
export interface CppTopologyCollectionsManifestScope {
    uid: number;
    name: string;
    collections: CppTopologyCollectionsManifestCollection[];
}
export interface CppDiagEndpointDiagInfo {
    type: CppServiceType;
    id: string;
    last_activity?: CppMilliseconds;
    remote: string;
    local: string;
    state: CppDiagEndpointState;
    bucket?: string;
    details?: string;
}
export interface CppDiagDiagnosticsResult {
    id: string;
    sdk: string;
    services: {
        [key: string]: CppDiagEndpointDiagInfo[];
    };
    version: number;
}
export interface CppDiagEndpointPingInfo {
    type: CppServiceType;
    id: string;
    latency: CppMilliseconds;
    remote: string;
    local: string;
    state: CppDiagPingState;
    bucket?: string;
    error?: string;
}
export interface CppDiagPingResult {
    id: string;
    sdk: string;
    services: {
        [key: string]: CppDiagEndpointPingInfo[];
    };
    version: number;
}
export interface CppPrependResponse {
    cas: CppCas;
    token: CppMutationToken;
}
export interface CppPrependRequest {
    id: CppDocumentId;
    value: Buffer;
    partition: number;
    opaque: number;
    cas: CppCasInput;
    durability_level: CppDurabilityLevel;
    timeout?: CppMilliseconds;
}
export interface CppPrependWithLegacyDurabilityRequest {
    id: CppDocumentId;
    value: Buffer;
    partition: number;
    opaque: number;
    cas: CppCasInput;
    timeout?: CppMilliseconds;
    persist_to: CppPersistTo;
    replicate_to: CppReplicateTo;
}
export interface CppExistsResponse {
    deleted: boolean;
    cas: CppCas;
    flags: number;
    expiry: number;
    sequence_number: number;
    datatype: number;
    document_exists: boolean;
}
export interface CppExistsRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    timeout?: CppMilliseconds;
}
export interface CppHttpNoopResponse {
}
export interface CppHttpNoopRequest {
    type: CppServiceType;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppUnlockResponse {
    cas: CppCas;
}
export interface CppUnlockRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    cas: CppCasInput;
    timeout?: CppMilliseconds;
}
export interface CppGetAllReplicasResponse {
    entries: CppGetAllReplicasResponseEntry[];
}
export interface CppGetAllReplicasResponseEntry {
    value: Buffer;
    cas: CppCas;
    flags: number;
    replica: boolean;
}
export interface CppGetAllReplicasRequest {
    id: CppDocumentId;
    timeout?: CppMilliseconds;
    read_preference: CppReadPreference;
}
export interface CppUpsertResponse {
    cas: CppCas;
    token: CppMutationToken;
}
export interface CppUpsertRequest {
    id: CppDocumentId;
    value: Buffer;
    partition: number;
    opaque: number;
    flags: number;
    expiry: number;
    durability_level: CppDurabilityLevel;
    timeout?: CppMilliseconds;
    preserve_expiry: boolean;
}
export interface CppUpsertWithLegacyDurabilityRequest {
    id: CppDocumentId;
    value: Buffer;
    partition: number;
    opaque: number;
    flags: number;
    expiry: number;
    timeout?: CppMilliseconds;
    preserve_expiry: boolean;
    persist_to: CppPersistTo;
    replicate_to: CppReplicateTo;
}
export interface CppGetAnyReplicaResponse {
    value: Buffer;
    cas: CppCas;
    flags: number;
    replica: boolean;
}
export interface CppGetAnyReplicaRequest {
    id: CppDocumentId;
    timeout?: CppMilliseconds;
    read_preference: CppReadPreference;
}
export interface CppAppendResponse {
    cas: CppCas;
    token: CppMutationToken;
}
export interface CppAppendRequest {
    id: CppDocumentId;
    value: Buffer;
    partition: number;
    opaque: number;
    cas: CppCasInput;
    durability_level: CppDurabilityLevel;
    timeout?: CppMilliseconds;
}
export interface CppAppendWithLegacyDurabilityRequest {
    id: CppDocumentId;
    value: Buffer;
    partition: number;
    opaque: number;
    cas: CppCasInput;
    timeout?: CppMilliseconds;
    persist_to: CppPersistTo;
    replicate_to: CppReplicateTo;
}
export interface CppQueryResponse {
    meta: CppQueryResponseQueryMetaData;
    prepared?: string;
    rows: string[];
    served_by_node: string;
}
export interface CppQueryResponseQueryMetrics {
    elapsed_time: CppMilliseconds;
    execution_time: CppMilliseconds;
    result_count: number;
    result_size: number;
    sort_count: number;
    mutation_count: number;
    error_count: number;
    warning_count: number;
}
export interface CppQueryResponseQueryProblem {
    code: number;
    message: string;
    reason?: number;
    retry?: boolean;
}
export interface CppQueryResponseQueryMetaData {
    request_id: string;
    client_context_id: string;
    status: string;
    metrics?: CppQueryResponseQueryMetrics;
    signature?: string;
    profile?: string;
    warnings?: CppQueryResponseQueryProblem[];
    errors?: CppQueryResponseQueryProblem[];
}
export interface CppQueryRequest {
    statement: string;
    adhoc: boolean;
    metrics: boolean;
    readonly: boolean;
    flex_index: boolean;
    preserve_expiry: boolean;
    use_replica?: boolean;
    max_parallelism?: number;
    scan_cap?: number;
    scan_wait?: CppMilliseconds;
    pipeline_batch?: number;
    pipeline_cap?: number;
    scan_consistency?: CppQueryScanConsistency;
    mutation_state: CppMutationToken[];
    query_context?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
    profile?: CppQueryProfile;
    raw: {
        [key: string]: CppJsonString;
    };
    positional_parameters: CppJsonString[];
    named_parameters: {
        [key: string]: CppJsonString;
    };
    send_to_node?: string;
    body_str: string;
}
export interface CppReplaceResponse {
    cas: CppCas;
    token: CppMutationToken;
}
export interface CppReplaceRequest {
    id: CppDocumentId;
    value: Buffer;
    partition: number;
    opaque: number;
    flags: number;
    expiry: number;
    cas: CppCasInput;
    durability_level: CppDurabilityLevel;
    timeout?: CppMilliseconds;
    preserve_expiry: boolean;
}
export interface CppReplaceWithLegacyDurabilityRequest {
    id: CppDocumentId;
    value: Buffer;
    partition: number;
    opaque: number;
    flags: number;
    expiry: number;
    cas: CppCasInput;
    timeout?: CppMilliseconds;
    preserve_expiry: boolean;
    persist_to: CppPersistTo;
    replicate_to: CppReplicateTo;
}
export interface CppGetAndTouchResponse {
    value: Buffer;
    cas: CppCas;
    flags: number;
}
export interface CppGetAndTouchRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    expiry: number;
    timeout?: CppMilliseconds;
}
export interface CppRemoveResponse {
    cas: CppCas;
    token: CppMutationToken;
}
export interface CppRemoveRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    cas: CppCasInput;
    durability_level: CppDurabilityLevel;
    timeout?: CppMilliseconds;
}
export interface CppRemoveWithLegacyDurabilityRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    cas: CppCasInput;
    timeout?: CppMilliseconds;
    persist_to: CppPersistTo;
    replicate_to: CppReplicateTo;
}
export interface CppGetResponse {
    value: Buffer;
    cas: CppCas;
    flags: number;
}
export interface CppGetRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    timeout?: CppMilliseconds;
}
export interface CppLookupInAllReplicasResponse {
    entries: CppLookupInAllReplicasResponseEntry[];
}
export interface CppLookupInAllReplicasResponseEntry {
    fields: CppLookupInAllReplicasResponseEntryLookupInEntry[];
    cas: CppCas;
    deleted: boolean;
    is_replica: boolean;
}
export interface CppLookupInAllReplicasResponseEntryLookupInEntry {
    path: string;
    value: Buffer;
    original_index: number;
    exists: boolean;
    opcode: CppProtocolSubdocOpcode;
    status: CppKeyValueStatusCode;
    ec: CppError;
}
export interface CppLookupInAllReplicasRequest {
    id: CppDocumentId;
    specs: CppImplSubdocCommand[];
    timeout?: CppMilliseconds;
    read_preference: CppReadPreference;
}
export interface CppAnalyticsResponse {
    meta: CppAnalyticsResponseAnalyticsMetaData;
    rows: string[];
}
export interface CppAnalyticsResponseAnalyticsMetrics {
    elapsed_time: CppMilliseconds;
    execution_time: CppMilliseconds;
    result_count: number;
    result_size: number;
    error_count: number;
    processed_objects: number;
    warning_count: number;
}
export interface CppAnalyticsResponseAnalyticsProblem {
    code: number;
    message: string;
}
export interface CppAnalyticsResponseAnalyticsMetaData {
    request_id: string;
    client_context_id: string;
    status: CppAnalyticsResponseAnalyticsStatus;
    metrics: CppAnalyticsResponseAnalyticsMetrics;
    signature?: string;
    errors: CppAnalyticsResponseAnalyticsProblem[];
    warnings: CppAnalyticsResponseAnalyticsProblem[];
}
export interface CppAnalyticsRequest {
    statement: string;
    readonly: boolean;
    priority: boolean;
    bucket_name?: string;
    scope_name?: string;
    scope_qualifier?: string;
    scan_consistency?: CppAnalyticsScanConsistency;
    raw: {
        [key: string]: CppJsonString;
    };
    positional_parameters: CppJsonString[];
    named_parameters: {
        [key: string]: CppJsonString;
    };
    client_context_id?: string;
    timeout?: CppMilliseconds;
    body_str: string;
}
export interface CppGetProjectedResponse {
    value: Buffer;
    cas: CppCas;
    flags: number;
    expiry?: number;
}
export interface CppGetProjectedRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    projections: string[];
    with_expiry: boolean;
    effective_projections: string[];
    preserve_array_indexes: boolean;
    timeout?: CppMilliseconds;
}
export interface CppDecrementResponse {
    content: number;
    cas: CppCas;
    token: CppMutationToken;
}
export interface CppDecrementRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    expiry: number;
    delta: number;
    initial_value?: number;
    durability_level: CppDurabilityLevel;
    timeout?: CppMilliseconds;
}
export interface CppDecrementWithLegacyDurabilityRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    expiry: number;
    delta: number;
    initial_value?: number;
    timeout?: CppMilliseconds;
    persist_to: CppPersistTo;
    replicate_to: CppReplicateTo;
}
export interface CppSearchResponse {
    status: string;
    meta: CppSearchResponseSearchMetaData;
    error: string;
    rows: CppSearchResponseSearchRow[];
    facets: CppSearchResponseSearchFacet[];
}
export interface CppSearchResponseSearchMetrics {
    took: CppMilliseconds;
    total_rows: number;
    max_score: number;
    success_partition_count: number;
    error_partition_count: number;
}
export interface CppSearchResponseSearchMetaData {
    client_context_id: string;
    metrics: CppSearchResponseSearchMetrics;
    errors: {
        [key: string]: string;
    };
}
export interface CppSearchResponseSearchLocation {
    field: string;
    term: string;
    position: number;
    start_offset: number;
    end_offset: number;
    array_positions?: number[];
}
export interface CppSearchResponseSearchRow {
    index: string;
    id: string;
    score: number;
    locations: CppSearchResponseSearchLocation[];
    fragments: {
        [key: string]: string[];
    };
    fields: string;
    explanation: string;
}
export interface CppSearchResponseSearchFacet {
    name: string;
    field: string;
    total: number;
    missing: number;
    other: number;
    terms: CppSearchResponseSearchFacetTermFacet[];
    date_ranges: CppSearchResponseSearchFacetDateRangeFacet[];
    numeric_ranges: CppSearchResponseSearchFacetNumericRangeFacet[];
}
export interface CppSearchResponseSearchFacetTermFacet {
    term: string;
    count: number;
}
export interface CppSearchResponseSearchFacetDateRangeFacet {
    name: string;
    count: number;
    start?: string;
    end?: string;
}
export interface CppSearchResponseSearchFacetNumericRangeFacet {
    name: string;
    count: number;
    min: undefined | number | number;
    max: undefined | number | number;
}
export interface CppSearchRequest {
    index_name: string;
    query: CppJsonString;
    bucket_name?: string;
    scope_name?: string;
    show_request?: boolean;
    vector_search?: CppJsonString;
    vector_query_combination?: CppVectorQueryCombination;
    limit?: number;
    skip?: number;
    explain?: boolean;
    disable_scoring: boolean;
    include_locations: boolean;
    highlight_style?: CppSearchHighlightStyle;
    highlight_fields: string[];
    fields: string[];
    collections: string[];
    scan_consistency?: CppSearchScanConsistency;
    mutation_state: CppMutationToken[];
    sort_specs: string[];
    facets: {
        [key: string]: string;
    };
    raw: {
        [key: string]: CppJsonString;
    };
    client_context_id?: string;
    timeout?: CppMilliseconds;
    log_request?: boolean;
    log_response?: boolean;
    body_str: string;
}
export interface CppTouchResponse {
    cas: CppCas;
}
export interface CppTouchRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    expiry: number;
    timeout?: CppMilliseconds;
}
export interface CppLookupInResponse {
    cas: CppCas;
    fields: CppLookupInResponseEntry[];
    deleted: boolean;
}
export interface CppLookupInResponseEntry {
    path: string;
    value: Buffer;
    original_index: number;
    exists: boolean;
    opcode: CppProtocolSubdocOpcode;
    status: CppKeyValueStatusCode;
    ec: CppError;
}
export interface CppLookupInRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    access_deleted: boolean;
    specs: CppImplSubdocCommand[];
    timeout?: CppMilliseconds;
}
export interface CppDocumentViewResponse {
    meta: CppDocumentViewResponseMetaData;
    rows: CppDocumentViewResponseRow[];
    error?: CppDocumentViewResponseProblem;
}
export interface CppDocumentViewResponseMetaData {
    total_rows?: number;
    debug_info?: string;
}
export interface CppDocumentViewResponseRow {
    id?: string;
    key: string;
    value: string;
}
export interface CppDocumentViewResponseProblem {
    code: string;
    message: string;
}
export interface CppDocumentViewRequest {
    bucket_name: string;
    document_name: string;
    view_name: string;
    ns: CppDesignDocumentNamespace;
    limit?: number;
    skip?: number;
    consistency?: CppViewScanConsistency;
    keys: string[];
    key?: string;
    start_key?: string;
    end_key?: string;
    start_key_doc_id?: string;
    end_key_doc_id?: string;
    inclusive_end?: boolean;
    reduce?: boolean;
    group?: boolean;
    group_level?: number;
    debug: boolean;
    raw: {
        [key: string]: string;
    };
    full_set?: boolean;
    order?: CppViewSortOrder;
    on_error?: CppViewOnError;
    query_string: string[];
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppGetAndLockResponse {
    value: Buffer;
    cas: CppCas;
    flags: number;
}
export interface CppGetAndLockRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    lock_time: number;
    timeout?: CppMilliseconds;
}
export interface CppInsertResponse {
    cas: CppCas;
    token: CppMutationToken;
}
export interface CppInsertRequest {
    id: CppDocumentId;
    value: Buffer;
    partition: number;
    opaque: number;
    flags: number;
    expiry: number;
    durability_level: CppDurabilityLevel;
    timeout?: CppMilliseconds;
}
export interface CppInsertWithLegacyDurabilityRequest {
    id: CppDocumentId;
    value: Buffer;
    partition: number;
    opaque: number;
    flags: number;
    expiry: number;
    timeout?: CppMilliseconds;
    persist_to: CppPersistTo;
    replicate_to: CppReplicateTo;
}
export interface CppLookupInAnyReplicaResponse {
    cas: CppCas;
    fields: CppLookupInAnyReplicaResponseEntry[];
    deleted: boolean;
    is_replica: boolean;
}
export interface CppLookupInAnyReplicaResponseEntry {
    path: string;
    value: Buffer;
    original_index: number;
    exists: boolean;
    opcode: CppProtocolSubdocOpcode;
    status: CppKeyValueStatusCode;
    ec: CppError;
}
export interface CppLookupInAnyReplicaRequest {
    id: CppDocumentId;
    specs: CppImplSubdocCommand[];
    timeout?: CppMilliseconds;
    read_preference: CppReadPreference;
}
export interface CppMutateInResponse {
    cas: CppCas;
    token: CppMutationToken;
    fields: CppMutateInResponseEntry[];
    deleted: boolean;
}
export interface CppMutateInResponseEntry {
    path: string;
    value: Buffer;
    original_index: number;
    opcode: CppProtocolSubdocOpcode;
    status: CppKeyValueStatusCode;
    ec: CppError;
}
export interface CppMutateInRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    cas: CppCasInput;
    access_deleted: boolean;
    create_as_deleted: boolean;
    expiry?: number;
    store_semantics: CppStoreSemantics;
    specs: CppImplSubdocCommand[];
    durability_level: CppDurabilityLevel;
    timeout?: CppMilliseconds;
    preserve_expiry: boolean;
    flags?: number;
}
export interface CppMutateInWithLegacyDurabilityRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    cas: CppCasInput;
    access_deleted: boolean;
    create_as_deleted: boolean;
    expiry?: number;
    store_semantics: CppStoreSemantics;
    specs: CppImplSubdocCommand[];
    timeout?: CppMilliseconds;
    preserve_expiry: boolean;
    flags?: number;
    persist_to: CppPersistTo;
    replicate_to: CppReplicateTo;
}
export interface CppIncrementResponse {
    content: number;
    cas: CppCas;
    token: CppMutationToken;
}
export interface CppIncrementRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    expiry: number;
    delta: number;
    initial_value?: number;
    durability_level: CppDurabilityLevel;
    timeout?: CppMilliseconds;
}
export interface CppIncrementWithLegacyDurabilityRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    expiry: number;
    delta: number;
    initial_value?: number;
    timeout?: CppMilliseconds;
    persist_to: CppPersistTo;
    replicate_to: CppReplicateTo;
}
export interface CppManagementGroupUpsertResponse {
    errors: string[];
}
export interface CppManagementGroupUpsertRequest {
    group: CppManagementRbacGroup;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementEventingPauseFunctionResponse {
    error?: CppManagementEventingProblem;
}
export interface CppManagementEventingPauseFunctionRequest {
    name: string;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementQueryIndexGetAllResponse {
    status: string;
    indexes: CppManagementQueryIndex[];
}
export interface CppManagementQueryIndexGetAllRequest {
    bucket_name: string;
    scope_name: string;
    collection_name: string;
    query_ctx: CppQueryContext;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementCollectionCreateResponse {
    uid: number;
}
export interface CppManagementCollectionCreateRequest {
    bucket_name: string;
    scope_name: string;
    collection_name: string;
    max_expiry?: number;
    history?: boolean;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementEventingResumeFunctionResponse {
    error?: CppManagementEventingProblem;
}
export interface CppManagementEventingResumeFunctionRequest {
    name: string;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementSearchIndexGetStatsResponse {
    status: string;
    error: string;
    stats: string;
}
export interface CppManagementSearchIndexGetStatsRequest {
    index_name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementBucketGetAllResponse {
    buckets: CppManagementClusterBucketSettings[];
}
export interface CppManagementBucketGetAllRequest {
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementQueryIndexBuildDeferredResponse {
    status: string;
    errors: CppManagementQueryIndexBuildDeferredResponseQueryProblem[];
}
export interface CppManagementQueryIndexBuildDeferredResponseQueryProblem {
    code: number;
    message: string;
}
export interface CppManagementQueryIndexBuildDeferredRequest {
    bucket_name: string;
    scope_name?: string;
    collection_name?: string;
    query_ctx: CppQueryContext;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementClusterDescribeResponse {
    info: CppManagementClusterDescribeResponseClusterInfo;
}
export interface CppManagementClusterDescribeResponseClusterInfo {
    nodes: CppManagementClusterDescribeResponseClusterInfoNode[];
    buckets: CppManagementClusterDescribeResponseClusterInfoBucket[];
    services: CppServiceType[];
}
export interface CppManagementClusterDescribeResponseClusterInfoNode {
    uuid: string;
    otp_node: string;
    status: string;
    hostname: string;
    os: string;
    version: string;
    services: string[];
}
export interface CppManagementClusterDescribeResponseClusterInfoBucket {
    uuid: string;
    name: string;
}
export interface CppManagementClusterDescribeRequest {
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementSearchIndexGetAllResponse {
    status: string;
    impl_version: string;
    indexes: CppManagementSearchIndex[];
}
export interface CppManagementSearchIndexGetAllRequest {
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementSearchIndexAnalyzeDocumentResponse {
    status: string;
    error: string;
    analysis: string;
}
export interface CppManagementSearchIndexAnalyzeDocumentRequest {
    index_name: string;
    encoded_document: string;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementQueryIndexDropResponse {
    status: string;
    errors: CppManagementQueryIndexDropResponseQueryProblem[];
}
export interface CppManagementQueryIndexDropResponseQueryProblem {
    code: number;
    message: string;
}
export interface CppManagementQueryIndexDropRequest {
    bucket_name: string;
    scope_name: string;
    collection_name: string;
    index_name: string;
    query_ctx: CppQueryContext;
    is_primary: boolean;
    ignore_if_does_not_exist: boolean;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsDatasetCreateResponse {
    status: string;
    errors: CppManagementAnalyticsProblem[];
}
export interface CppManagementAnalyticsDatasetCreateRequest {
    dataverse_name: string;
    dataset_name: string;
    bucket_name: string;
    condition?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
    ignore_if_exists: boolean;
}
export interface CppManagementBucketFlushResponse {
}
export interface CppManagementBucketFlushRequest {
    name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsIndexDropResponse {
    status: string;
    errors: CppManagementAnalyticsProblem[];
}
export interface CppManagementAnalyticsIndexDropRequest {
    dataverse_name: string;
    dataset_name: string;
    index_name: string;
    ignore_if_does_not_exist: boolean;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementQueryIndexCreateResponse {
    status: string;
    errors: CppManagementQueryIndexCreateResponseQueryProblem[];
}
export interface CppManagementQueryIndexCreateResponseQueryProblem {
    code: number;
    message: string;
}
export interface CppManagementQueryIndexCreateRequest {
    bucket_name: string;
    scope_name: string;
    collection_name: string;
    index_name: string;
    keys: string[];
    query_ctx: CppQueryContext;
    is_primary: boolean;
    ignore_if_exists: boolean;
    condition?: string;
    deferred?: boolean;
    num_replicas?: number;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementSearchIndexUpsertResponse {
    status: string;
    name: string;
    uuid: string;
    error: string;
}
export interface CppManagementSearchIndexUpsertRequest {
    index: CppManagementSearchIndex;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsDatasetGetAllResponse {
    status: string;
    datasets: CppManagementAnalyticsDataset[];
    errors: CppManagementAnalyticsProblem[];
}
export interface CppManagementAnalyticsDatasetGetAllRequest {
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsIndexGetAllResponse {
    status: string;
    indexes: CppManagementAnalyticsIndex[];
    errors: CppManagementAnalyticsProblem[];
}
export interface CppManagementAnalyticsIndexGetAllRequest {
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsGetPendingMutationsResponse {
    status: string;
    errors: CppManagementAnalyticsProblem[];
    stats: {
        [key: string]: number;
    };
}
export interface CppManagementAnalyticsGetPendingMutationsRequest {
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsDataverseDropResponse {
    status: string;
    errors: CppManagementAnalyticsProblem[];
}
export interface CppManagementAnalyticsDataverseDropRequest {
    dataverse_name: string;
    ignore_if_does_not_exist: boolean;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementEventingProblem {
    code: number;
    name: string;
    description: string;
}
export interface CppManagementAnalyticsLinkConnectResponse {
    status: string;
    errors: CppManagementAnalyticsLinkConnectResponseProblem[];
}
export interface CppManagementAnalyticsLinkConnectResponseProblem {
    code: number;
    message: string;
}
export interface CppManagementAnalyticsLinkConnectRequest {
    dataverse_name: string;
    link_name: string;
    force: boolean;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementCollectionsManifestGetResponse {
    manifest: CppTopologyCollectionsManifest;
}
export interface CppManagementCollectionsManifestGetRequest {
    id: CppDocumentId;
    partition: number;
    opaque: number;
    timeout?: CppMilliseconds;
}
export interface CppManagementChangePasswordResponse {
}
export interface CppManagementChangePasswordRequest {
    newPassword: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementClusterDeveloperPreviewEnableResponse {
}
export interface CppManagementClusterDeveloperPreviewEnableRequest {
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsLinkDropResponse {
    status: string;
    errors: CppManagementAnalyticsLinkDropResponseProblem[];
}
export interface CppManagementAnalyticsLinkDropResponseProblem {
    code: number;
    message: string;
}
export interface CppManagementAnalyticsLinkDropRequest {
    link_name: string;
    dataverse_name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementCollectionUpdateResponse {
    uid: number;
}
export interface CppManagementCollectionUpdateRequest {
    bucket_name: string;
    scope_name: string;
    collection_name: string;
    max_expiry?: number;
    history?: boolean;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementServerNodeAddress {
    hostname: string;
    kv_plain: number;
    kv_tls: number;
}
export interface CppManagementServerNode {
    server_group_name: string;
    server_index: number;
    default_network: CppManagementServerNodeAddress;
    external_network: CppManagementServerNodeAddress;
    active_vbuckets: number[];
    replica_vbuckets: number[];
}
export interface CppManagementServerGroup {
    name: string;
    nodes: CppManagementServerNode[];
}
export interface CppManagementBucketDescribeResponse {
    info: CppManagementBucketDescribeResponseBucketInfo;
}
export interface CppManagementBucketDescribeResponseBucketInfo {
    name: string;
    uuid: string;
    number_of_nodes: number;
    number_of_replicas: number;
    bucket_capabilities: string[];
    server_groups: {
        [key: string]: CppManagementServerGroup;
    };
    storage_backend: CppManagementClusterBucketStorageBackend;
    config_json: string;
}
export interface CppManagementBucketDescribeRequest {
    name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementEventingUpsertFunctionResponse {
    error?: CppManagementEventingProblem;
}
export interface CppManagementEventingUpsertFunctionRequest {
    function: CppManagementEventingFunction;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementViewIndexGetAllResponse {
    design_documents: CppManagementViewsDesignDocument[];
}
export interface CppManagementViewIndexGetAllRequest {
    bucket_name: string;
    ns: CppDesignDocumentNamespace;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementBucketGetResponse {
    bucket: CppManagementClusterBucketSettings;
}
export interface CppManagementBucketGetRequest {
    name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementBucketUpdateResponse {
    bucket: CppManagementClusterBucketSettings;
    error_message: string;
}
export interface CppManagementBucketUpdateRequest {
    bucket: CppManagementClusterBucketSettings;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementBucketDropResponse {
}
export interface CppManagementBucketDropRequest {
    name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementFreeformResponse {
    status: number;
    headers: {
        [key: string]: string;
    };
    body: string;
}
export interface CppManagementFreeformRequest {
    type: CppServiceType;
    method: string;
    path: string;
    headers: {
        [key: string]: string;
    };
    body: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementScopeDropResponse {
    uid: number;
}
export interface CppManagementScopeDropRequest {
    bucket_name: string;
    scope_name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementViewIndexUpsertResponse {
}
export interface CppManagementViewIndexUpsertRequest {
    bucket_name: string;
    document: CppManagementViewsDesignDocument;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementUserGetAllResponse {
    users: CppManagementRbacUserAndMetadata[];
}
export interface CppManagementUserGetAllRequest {
    domain: CppManagementRbacAuthDomain;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementScopeCreateResponse {
    uid: number;
}
export interface CppManagementScopeCreateRequest {
    bucket_name: string;
    scope_name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementEventingGetFunctionResponse {
    function: CppManagementEventingFunction;
    error?: CppManagementEventingProblem;
}
export interface CppManagementEventingGetFunctionRequest {
    name: string;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementViewIndexDropResponse {
}
export interface CppManagementViewIndexDropRequest {
    bucket_name: string;
    document_name: string;
    ns: CppDesignDocumentNamespace;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsLinkReplaceResponse {
    status: string;
    errors: CppManagementAnalyticsLinkReplaceResponseProblem[];
}
export interface CppManagementAnalyticsLinkReplaceResponseProblem {
    code: number;
    message: string;
}
export interface CppManagementAnalyticsLinkReplaceAzureBlobExternalLinkRequest {
    link: CppManagementAnalyticsAzureBlobExternalLink;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsLinkReplaceCouchbaseRemoteLinkRequest {
    link: CppManagementAnalyticsCouchbaseRemoteLink;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsLinkReplaceS3ExternalLinkRequest {
    link: CppManagementAnalyticsS3ExternalLink;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsLinkDisconnectResponse {
    status: string;
    errors: CppManagementAnalyticsLinkDisconnectResponseProblem[];
}
export interface CppManagementAnalyticsLinkDisconnectResponseProblem {
    code: number;
    message: string;
}
export interface CppManagementAnalyticsLinkDisconnectRequest {
    dataverse_name: string;
    link_name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementUserUpsertResponse {
    errors: string[];
}
export interface CppManagementUserUpsertRequest {
    domain: CppManagementRbacAuthDomain;
    user: CppManagementRbacUser;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementEventingGetStatusResponse {
    status: CppManagementEventingStatus;
    error?: CppManagementEventingProblem;
}
export interface CppManagementEventingGetStatusRequest {
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementEventingGetAllFunctionsResponse {
    functions: CppManagementEventingFunction[];
    error?: CppManagementEventingProblem;
}
export interface CppManagementEventingGetAllFunctionsRequest {
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsIndexCreateResponse {
    status: string;
    errors: CppManagementAnalyticsProblem[];
}
export interface CppManagementAnalyticsIndexCreateRequest {
    dataverse_name: string;
    dataset_name: string;
    index_name: string;
    fields: {
        [key: string]: string;
    };
    ignore_if_exists: boolean;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementScopeGetAllResponse {
    manifest: CppTopologyCollectionsManifest;
}
export interface CppManagementScopeGetAllRequest {
    bucket_name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementUserGetResponse {
    user: CppManagementRbacUserAndMetadata;
}
export interface CppManagementUserGetRequest {
    username: string;
    domain: CppManagementRbacAuthDomain;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementSearchIndexDropResponse {
    status: string;
    error: string;
}
export interface CppManagementSearchIndexDropRequest {
    index_name: string;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementSearchIndexControlPlanFreezeResponse {
    status: string;
    error: string;
}
export interface CppManagementSearchIndexControlPlanFreezeRequest {
    index_name: string;
    freeze: boolean;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementSearchGetStatsResponse {
    stats: string;
}
export interface CppManagementSearchGetStatsRequest {
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementUserDropResponse {
}
export interface CppManagementUserDropRequest {
    username: string;
    domain: CppManagementRbacAuthDomain;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsDataverseCreateResponse {
    status: string;
    errors: CppManagementAnalyticsProblem[];
}
export interface CppManagementAnalyticsDataverseCreateRequest {
    dataverse_name: string;
    ignore_if_exists: boolean;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementSearchIndexControlQueryResponse {
    status: string;
    error: string;
}
export interface CppManagementSearchIndexControlQueryRequest {
    index_name: string;
    allow: boolean;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementRoleGetAllResponse {
    roles: CppManagementRbacRoleAndDescription[];
}
export interface CppManagementRoleGetAllRequest {
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementGroupGetAllResponse {
    groups: CppManagementRbacGroup[];
}
export interface CppManagementGroupGetAllRequest {
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsLinkCreateResponse {
    status: string;
    errors: CppManagementAnalyticsLinkCreateResponseProblem[];
}
export interface CppManagementAnalyticsLinkCreateResponseProblem {
    code: number;
    message: string;
}
export interface CppManagementAnalyticsLinkCreateAzureBlobExternalLinkRequest {
    link: CppManagementAnalyticsAzureBlobExternalLink;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsLinkCreateCouchbaseRemoteLinkRequest {
    link: CppManagementAnalyticsCouchbaseRemoteLink;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsLinkCreateS3ExternalLinkRequest {
    link: CppManagementAnalyticsS3ExternalLink;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementEventingDropFunctionResponse {
    error?: CppManagementEventingProblem;
}
export interface CppManagementEventingDropFunctionRequest {
    name: string;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementCollectionDropResponse {
    uid: number;
}
export interface CppManagementCollectionDropRequest {
    bucket_name: string;
    scope_name: string;
    collection_name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsProblem {
    code: number;
    message: string;
}
export interface CppManagementSearchIndexControlIngestResponse {
    status: string;
    error: string;
}
export interface CppManagementSearchIndexControlIngestRequest {
    index_name: string;
    pause: boolean;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementEventingDeployFunctionResponse {
    error?: CppManagementEventingProblem;
}
export interface CppManagementEventingDeployFunctionRequest {
    name: string;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementGroupGetResponse {
    group: CppManagementRbacGroup;
}
export interface CppManagementGroupGetRequest {
    name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementViewIndexGetResponse {
    document: CppManagementViewsDesignDocument;
}
export interface CppManagementViewIndexGetRequest {
    bucket_name: string;
    document_name: string;
    ns: CppDesignDocumentNamespace;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementBucketCreateResponse {
    error_message: string;
}
export interface CppManagementBucketCreateRequest {
    bucket: CppManagementClusterBucketSettings;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsDatasetDropResponse {
    status: string;
    errors: CppManagementAnalyticsProblem[];
}
export interface CppManagementAnalyticsDatasetDropRequest {
    dataverse_name: string;
    dataset_name: string;
    ignore_if_does_not_exist: boolean;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementGroupDropResponse {
}
export interface CppManagementGroupDropRequest {
    name: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementSearchIndexGetResponse {
    status: string;
    index: CppManagementSearchIndex;
    error: string;
}
export interface CppManagementSearchIndexGetRequest {
    index_name: string;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementQueryIndexGetAllDeferredResponse {
    status: string;
    index_names: string[];
}
export interface CppManagementQueryIndexGetAllDeferredRequest {
    bucket_name: string;
    scope_name: string;
    collection_name: string;
    query_ctx: CppQueryContext;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementQueryIndexBuildResponse {
    status: string;
    errors: CppManagementQueryIndexBuildResponseQueryProblem[];
}
export interface CppManagementQueryIndexBuildResponseQueryProblem {
    code: number;
    message: string;
}
export interface CppManagementQueryIndexBuildRequest {
    bucket_name: string;
    scope_name: string;
    collection_name: string;
    query_ctx: CppQueryContext;
    index_names: string[];
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementEventingUndeployFunctionResponse {
    error?: CppManagementEventingProblem;
}
export interface CppManagementEventingUndeployFunctionRequest {
    name: string;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementSearchIndexGetDocumentsCountResponse {
    status: string;
    count: number;
    error: string;
}
export interface CppManagementSearchIndexGetDocumentsCountRequest {
    index_name: string;
    bucket_name?: string;
    scope_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppManagementAnalyticsLinkGetAllResponse {
    status: string;
    errors: CppManagementAnalyticsLinkGetAllResponseProblem[];
    couchbase: CppManagementAnalyticsCouchbaseRemoteLink[];
    s3: CppManagementAnalyticsS3ExternalLink[];
    azure_blob: CppManagementAnalyticsAzureBlobExternalLink[];
}
export interface CppManagementAnalyticsLinkGetAllResponseProblem {
    code: number;
    message: string;
}
export interface CppManagementAnalyticsLinkGetAllRequest {
    link_type?: string;
    link_name?: string;
    dataverse_name?: string;
    client_context_id?: string;
    timeout?: CppMilliseconds;
}
export interface CppImplSubdocCommand {
    opcode_: number;
    path_: string;
    value_?: Buffer;
    flags_: number;
    original_index_: number;
}
export interface CppScanTerm {
    term: string;
    exclusive: boolean;
}
export interface CppRangeScan {
    from?: CppScanTerm;
    to?: CppScanTerm;
}
export interface CppPrefixScan {
    prefix: string;
}
export interface CppSamplingScan {
    limit: number;
    seed?: number;
}
export interface CppRangeSnapshotRequirements {
    vbucket_uuid: number;
    sequence_number: number;
    sequence_number_exists: boolean;
}
export interface CppRangeScanCreateOptions {
    scope_name: string;
    collection_name: string;
    scan_type_name: string;
    scan_type_value: undefined | CppRangeScan | CppPrefixScan | CppSamplingScan;
    timeout: CppMilliseconds;
    collection_id: number;
    snapshot_requirements?: CppRangeSnapshotRequirements;
    ids_only: boolean;
}
export interface CppRangeScanCreateResult {
    scan_uuid: Buffer;
    ids_only: boolean;
}
export interface CppRangeScanContinueOptions {
    batch_item_limit: number;
    batch_byte_limit: number;
    timeout: CppMilliseconds;
    batch_time_limit: CppMilliseconds;
}
export interface CppRangeScanContinueResult {
    more: boolean;
    complete: boolean;
    ids_only: boolean;
}
export interface CppRangeScanCancelOptions {
    timeout: CppMilliseconds;
}
export interface CppRangeScanItemBody {
    flags: number;
    expiry: number;
    cas: CppCas;
    sequence_number: number;
    datatype: number;
    value: Buffer;
}
export interface CppRangeScanItem {
    key: string;
    body?: CppRangeScanItemBody;
}
export interface CppRangeScanCancelResult {
}
export interface CppMutationState {
    tokens: CppMutationToken[];
}
export interface CppRangeScanOrchestratorOptions {
    ids_only: boolean;
    consistent_with?: CppMutationState;
    batch_item_limit: number;
    batch_byte_limit: number;
    concurrency: number;
    timeout: CppMilliseconds;
}
export interface CppConnectionAutogen {
    prepend(options: CppPrependRequest, callback: (err: CppError | null, result: CppPrependResponse) => void): void;
    prependWithLegacyDurability(options: CppPrependWithLegacyDurabilityRequest, callback: (err: CppError | null, result: CppPrependResponse) => void): void;
    exists(options: CppExistsRequest, callback: (err: CppError | null, result: CppExistsResponse) => void): void;
    httpNoop(options: CppHttpNoopRequest, callback: (err: CppError | null, result: CppHttpNoopResponse) => void): void;
    unlock(options: CppUnlockRequest, callback: (err: CppError | null, result: CppUnlockResponse) => void): void;
    getAllReplicas(options: CppGetAllReplicasRequest, callback: (err: CppError | null, result: CppGetAllReplicasResponse) => void): void;
    upsert(options: CppUpsertRequest, callback: (err: CppError | null, result: CppUpsertResponse) => void): void;
    upsertWithLegacyDurability(options: CppUpsertWithLegacyDurabilityRequest, callback: (err: CppError | null, result: CppUpsertResponse) => void): void;
    getAnyReplica(options: CppGetAnyReplicaRequest, callback: (err: CppError | null, result: CppGetAnyReplicaResponse) => void): void;
    append(options: CppAppendRequest, callback: (err: CppError | null, result: CppAppendResponse) => void): void;
    appendWithLegacyDurability(options: CppAppendWithLegacyDurabilityRequest, callback: (err: CppError | null, result: CppAppendResponse) => void): void;
    query(options: CppQueryRequest, callback: (err: CppError | null, result: CppQueryResponse) => void): void;
    replace(options: CppReplaceRequest, callback: (err: CppError | null, result: CppReplaceResponse) => void): void;
    replaceWithLegacyDurability(options: CppReplaceWithLegacyDurabilityRequest, callback: (err: CppError | null, result: CppReplaceResponse) => void): void;
    getAndTouch(options: CppGetAndTouchRequest, callback: (err: CppError | null, result: CppGetAndTouchResponse) => void): void;
    remove(options: CppRemoveRequest, callback: (err: CppError | null, result: CppRemoveResponse) => void): void;
    removeWithLegacyDurability(options: CppRemoveWithLegacyDurabilityRequest, callback: (err: CppError | null, result: CppRemoveResponse) => void): void;
    get(options: CppGetRequest, callback: (err: CppError | null, result: CppGetResponse) => void): void;
    lookupInAllReplicas(options: CppLookupInAllReplicasRequest, callback: (err: CppError | null, result: CppLookupInAllReplicasResponse) => void): void;
    analytics(options: CppAnalyticsRequest, callback: (err: CppError | null, result: CppAnalyticsResponse) => void): void;
    getProjected(options: CppGetProjectedRequest, callback: (err: CppError | null, result: CppGetProjectedResponse) => void): void;
    decrement(options: CppDecrementRequest, callback: (err: CppError | null, result: CppDecrementResponse) => void): void;
    decrementWithLegacyDurability(options: CppDecrementWithLegacyDurabilityRequest, callback: (err: CppError | null, result: CppDecrementResponse) => void): void;
    search(options: CppSearchRequest, callback: (err: CppError | null, result: CppSearchResponse) => void): void;
    touch(options: CppTouchRequest, callback: (err: CppError | null, result: CppTouchResponse) => void): void;
    lookupIn(options: CppLookupInRequest, callback: (err: CppError | null, result: CppLookupInResponse) => void): void;
    documentView(options: CppDocumentViewRequest, callback: (err: CppError | null, result: CppDocumentViewResponse) => void): void;
    getAndLock(options: CppGetAndLockRequest, callback: (err: CppError | null, result: CppGetAndLockResponse) => void): void;
    insert(options: CppInsertRequest, callback: (err: CppError | null, result: CppInsertResponse) => void): void;
    insertWithLegacyDurability(options: CppInsertWithLegacyDurabilityRequest, callback: (err: CppError | null, result: CppInsertResponse) => void): void;
    lookupInAnyReplica(options: CppLookupInAnyReplicaRequest, callback: (err: CppError | null, result: CppLookupInAnyReplicaResponse) => void): void;
    mutateIn(options: CppMutateInRequest, callback: (err: CppError | null, result: CppMutateInResponse) => void): void;
    mutateInWithLegacyDurability(options: CppMutateInWithLegacyDurabilityRequest, callback: (err: CppError | null, result: CppMutateInResponse) => void): void;
    increment(options: CppIncrementRequest, callback: (err: CppError | null, result: CppIncrementResponse) => void): void;
    incrementWithLegacyDurability(options: CppIncrementWithLegacyDurabilityRequest, callback: (err: CppError | null, result: CppIncrementResponse) => void): void;
    managementGroupUpsert(options: CppManagementGroupUpsertRequest, callback: (err: CppError | null, result: CppManagementGroupUpsertResponse) => void): void;
    managementEventingPauseFunction(options: CppManagementEventingPauseFunctionRequest, callback: (err: CppError | null, result: CppManagementEventingPauseFunctionResponse) => void): void;
    managementQueryIndexGetAll(options: CppManagementQueryIndexGetAllRequest, callback: (err: CppError | null, result: CppManagementQueryIndexGetAllResponse) => void): void;
    managementCollectionCreate(options: CppManagementCollectionCreateRequest, callback: (err: CppError | null, result: CppManagementCollectionCreateResponse) => void): void;
    managementEventingResumeFunction(options: CppManagementEventingResumeFunctionRequest, callback: (err: CppError | null, result: CppManagementEventingResumeFunctionResponse) => void): void;
    managementSearchIndexGetStats(options: CppManagementSearchIndexGetStatsRequest, callback: (err: CppError | null, result: CppManagementSearchIndexGetStatsResponse) => void): void;
    managementBucketGetAll(options: CppManagementBucketGetAllRequest, callback: (err: CppError | null, result: CppManagementBucketGetAllResponse) => void): void;
    managementQueryIndexBuildDeferred(options: CppManagementQueryIndexBuildDeferredRequest, callback: (err: CppError | null, result: CppManagementQueryIndexBuildDeferredResponse) => void): void;
    managementClusterDescribe(options: CppManagementClusterDescribeRequest, callback: (err: CppError | null, result: CppManagementClusterDescribeResponse) => void): void;
    managementSearchIndexGetAll(options: CppManagementSearchIndexGetAllRequest, callback: (err: CppError | null, result: CppManagementSearchIndexGetAllResponse) => void): void;
    managementSearchIndexAnalyzeDocument(options: CppManagementSearchIndexAnalyzeDocumentRequest, callback: (err: CppError | null, result: CppManagementSearchIndexAnalyzeDocumentResponse) => void): void;
    managementQueryIndexDrop(options: CppManagementQueryIndexDropRequest, callback: (err: CppError | null, result: CppManagementQueryIndexDropResponse) => void): void;
    managementAnalyticsDatasetCreate(options: CppManagementAnalyticsDatasetCreateRequest, callback: (err: CppError | null, result: CppManagementAnalyticsDatasetCreateResponse) => void): void;
    managementBucketFlush(options: CppManagementBucketFlushRequest, callback: (err: CppError | null, result: CppManagementBucketFlushResponse) => void): void;
    managementAnalyticsIndexDrop(options: CppManagementAnalyticsIndexDropRequest, callback: (err: CppError | null, result: CppManagementAnalyticsIndexDropResponse) => void): void;
    managementQueryIndexCreate(options: CppManagementQueryIndexCreateRequest, callback: (err: CppError | null, result: CppManagementQueryIndexCreateResponse) => void): void;
    managementSearchIndexUpsert(options: CppManagementSearchIndexUpsertRequest, callback: (err: CppError | null, result: CppManagementSearchIndexUpsertResponse) => void): void;
    managementAnalyticsDatasetGetAll(options: CppManagementAnalyticsDatasetGetAllRequest, callback: (err: CppError | null, result: CppManagementAnalyticsDatasetGetAllResponse) => void): void;
    managementAnalyticsIndexGetAll(options: CppManagementAnalyticsIndexGetAllRequest, callback: (err: CppError | null, result: CppManagementAnalyticsIndexGetAllResponse) => void): void;
    managementAnalyticsGetPendingMutations(options: CppManagementAnalyticsGetPendingMutationsRequest, callback: (err: CppError | null, result: CppManagementAnalyticsGetPendingMutationsResponse) => void): void;
    managementAnalyticsDataverseDrop(options: CppManagementAnalyticsDataverseDropRequest, callback: (err: CppError | null, result: CppManagementAnalyticsDataverseDropResponse) => void): void;
    managementAnalyticsLinkConnect(options: CppManagementAnalyticsLinkConnectRequest, callback: (err: CppError | null, result: CppManagementAnalyticsLinkConnectResponse) => void): void;
    managementCollectionsManifestGet(options: CppManagementCollectionsManifestGetRequest, callback: (err: CppError | null, result: CppManagementCollectionsManifestGetResponse) => void): void;
    managementChangePassword(options: CppManagementChangePasswordRequest, callback: (err: CppError | null, result: CppManagementChangePasswordResponse) => void): void;
    managementClusterDeveloperPreviewEnable(options: CppManagementClusterDeveloperPreviewEnableRequest, callback: (err: CppError | null, result: CppManagementClusterDeveloperPreviewEnableResponse) => void): void;
    managementAnalyticsLinkDrop(options: CppManagementAnalyticsLinkDropRequest, callback: (err: CppError | null, result: CppManagementAnalyticsLinkDropResponse) => void): void;
    managementCollectionUpdate(options: CppManagementCollectionUpdateRequest, callback: (err: CppError | null, result: CppManagementCollectionUpdateResponse) => void): void;
    managementBucketDescribe(options: CppManagementBucketDescribeRequest, callback: (err: CppError | null, result: CppManagementBucketDescribeResponse) => void): void;
    managementEventingUpsertFunction(options: CppManagementEventingUpsertFunctionRequest, callback: (err: CppError | null, result: CppManagementEventingUpsertFunctionResponse) => void): void;
    managementViewIndexGetAll(options: CppManagementViewIndexGetAllRequest, callback: (err: CppError | null, result: CppManagementViewIndexGetAllResponse) => void): void;
    managementBucketGet(options: CppManagementBucketGetRequest, callback: (err: CppError | null, result: CppManagementBucketGetResponse) => void): void;
    managementBucketUpdate(options: CppManagementBucketUpdateRequest, callback: (err: CppError | null, result: CppManagementBucketUpdateResponse) => void): void;
    managementBucketDrop(options: CppManagementBucketDropRequest, callback: (err: CppError | null, result: CppManagementBucketDropResponse) => void): void;
    managementFreeform(options: CppManagementFreeformRequest, callback: (err: CppError | null, result: CppManagementFreeformResponse) => void): void;
    managementScopeDrop(options: CppManagementScopeDropRequest, callback: (err: CppError | null, result: CppManagementScopeDropResponse) => void): void;
    managementViewIndexUpsert(options: CppManagementViewIndexUpsertRequest, callback: (err: CppError | null, result: CppManagementViewIndexUpsertResponse) => void): void;
    managementUserGetAll(options: CppManagementUserGetAllRequest, callback: (err: CppError | null, result: CppManagementUserGetAllResponse) => void): void;
    managementScopeCreate(options: CppManagementScopeCreateRequest, callback: (err: CppError | null, result: CppManagementScopeCreateResponse) => void): void;
    managementEventingGetFunction(options: CppManagementEventingGetFunctionRequest, callback: (err: CppError | null, result: CppManagementEventingGetFunctionResponse) => void): void;
    managementViewIndexDrop(options: CppManagementViewIndexDropRequest, callback: (err: CppError | null, result: CppManagementViewIndexDropResponse) => void): void;
    managementAnalyticsLinkReplaceAzureBlobExternalLink(options: CppManagementAnalyticsLinkReplaceAzureBlobExternalLinkRequest, callback: (err: CppError | null, result: CppManagementAnalyticsLinkReplaceResponse) => void): void;
    managementAnalyticsLinkReplaceCouchbaseRemoteLink(options: CppManagementAnalyticsLinkReplaceCouchbaseRemoteLinkRequest, callback: (err: CppError | null, result: CppManagementAnalyticsLinkReplaceResponse) => void): void;
    managementAnalyticsLinkReplaceS3ExternalLink(options: CppManagementAnalyticsLinkReplaceS3ExternalLinkRequest, callback: (err: CppError | null, result: CppManagementAnalyticsLinkReplaceResponse) => void): void;
    managementAnalyticsLinkDisconnect(options: CppManagementAnalyticsLinkDisconnectRequest, callback: (err: CppError | null, result: CppManagementAnalyticsLinkDisconnectResponse) => void): void;
    managementUserUpsert(options: CppManagementUserUpsertRequest, callback: (err: CppError | null, result: CppManagementUserUpsertResponse) => void): void;
    managementEventingGetStatus(options: CppManagementEventingGetStatusRequest, callback: (err: CppError | null, result: CppManagementEventingGetStatusResponse) => void): void;
    managementEventingGetAllFunctions(options: CppManagementEventingGetAllFunctionsRequest, callback: (err: CppError | null, result: CppManagementEventingGetAllFunctionsResponse) => void): void;
    managementAnalyticsIndexCreate(options: CppManagementAnalyticsIndexCreateRequest, callback: (err: CppError | null, result: CppManagementAnalyticsIndexCreateResponse) => void): void;
    managementScopeGetAll(options: CppManagementScopeGetAllRequest, callback: (err: CppError | null, result: CppManagementScopeGetAllResponse) => void): void;
    managementUserGet(options: CppManagementUserGetRequest, callback: (err: CppError | null, result: CppManagementUserGetResponse) => void): void;
    managementSearchIndexDrop(options: CppManagementSearchIndexDropRequest, callback: (err: CppError | null, result: CppManagementSearchIndexDropResponse) => void): void;
    managementSearchIndexControlPlanFreeze(options: CppManagementSearchIndexControlPlanFreezeRequest, callback: (err: CppError | null, result: CppManagementSearchIndexControlPlanFreezeResponse) => void): void;
    managementSearchGetStats(options: CppManagementSearchGetStatsRequest, callback: (err: CppError | null, result: CppManagementSearchGetStatsResponse) => void): void;
    managementUserDrop(options: CppManagementUserDropRequest, callback: (err: CppError | null, result: CppManagementUserDropResponse) => void): void;
    managementAnalyticsDataverseCreate(options: CppManagementAnalyticsDataverseCreateRequest, callback: (err: CppError | null, result: CppManagementAnalyticsDataverseCreateResponse) => void): void;
    managementSearchIndexControlQuery(options: CppManagementSearchIndexControlQueryRequest, callback: (err: CppError | null, result: CppManagementSearchIndexControlQueryResponse) => void): void;
    managementRoleGetAll(options: CppManagementRoleGetAllRequest, callback: (err: CppError | null, result: CppManagementRoleGetAllResponse) => void): void;
    managementGroupGetAll(options: CppManagementGroupGetAllRequest, callback: (err: CppError | null, result: CppManagementGroupGetAllResponse) => void): void;
    managementAnalyticsLinkCreateAzureBlobExternalLink(options: CppManagementAnalyticsLinkCreateAzureBlobExternalLinkRequest, callback: (err: CppError | null, result: CppManagementAnalyticsLinkCreateResponse) => void): void;
    managementAnalyticsLinkCreateCouchbaseRemoteLink(options: CppManagementAnalyticsLinkCreateCouchbaseRemoteLinkRequest, callback: (err: CppError | null, result: CppManagementAnalyticsLinkCreateResponse) => void): void;
    managementAnalyticsLinkCreateS3ExternalLink(options: CppManagementAnalyticsLinkCreateS3ExternalLinkRequest, callback: (err: CppError | null, result: CppManagementAnalyticsLinkCreateResponse) => void): void;
    managementEventingDropFunction(options: CppManagementEventingDropFunctionRequest, callback: (err: CppError | null, result: CppManagementEventingDropFunctionResponse) => void): void;
    managementCollectionDrop(options: CppManagementCollectionDropRequest, callback: (err: CppError | null, result: CppManagementCollectionDropResponse) => void): void;
    managementSearchIndexControlIngest(options: CppManagementSearchIndexControlIngestRequest, callback: (err: CppError | null, result: CppManagementSearchIndexControlIngestResponse) => void): void;
    managementEventingDeployFunction(options: CppManagementEventingDeployFunctionRequest, callback: (err: CppError | null, result: CppManagementEventingDeployFunctionResponse) => void): void;
    managementGroupGet(options: CppManagementGroupGetRequest, callback: (err: CppError | null, result: CppManagementGroupGetResponse) => void): void;
    managementViewIndexGet(options: CppManagementViewIndexGetRequest, callback: (err: CppError | null, result: CppManagementViewIndexGetResponse) => void): void;
    managementBucketCreate(options: CppManagementBucketCreateRequest, callback: (err: CppError | null, result: CppManagementBucketCreateResponse) => void): void;
    managementAnalyticsDatasetDrop(options: CppManagementAnalyticsDatasetDropRequest, callback: (err: CppError | null, result: CppManagementAnalyticsDatasetDropResponse) => void): void;
    managementGroupDrop(options: CppManagementGroupDropRequest, callback: (err: CppError | null, result: CppManagementGroupDropResponse) => void): void;
    managementSearchIndexGet(options: CppManagementSearchIndexGetRequest, callback: (err: CppError | null, result: CppManagementSearchIndexGetResponse) => void): void;
    managementQueryIndexGetAllDeferred(options: CppManagementQueryIndexGetAllDeferredRequest, callback: (err: CppError | null, result: CppManagementQueryIndexGetAllDeferredResponse) => void): void;
    managementQueryIndexBuild(options: CppManagementQueryIndexBuildRequest, callback: (err: CppError | null, result: CppManagementQueryIndexBuildResponse) => void): void;
    managementEventingUndeployFunction(options: CppManagementEventingUndeployFunctionRequest, callback: (err: CppError | null, result: CppManagementEventingUndeployFunctionResponse) => void): void;
    managementSearchIndexGetDocumentsCount(options: CppManagementSearchIndexGetDocumentsCountRequest, callback: (err: CppError | null, result: CppManagementSearchIndexGetDocumentsCountResponse) => void): void;
    managementAnalyticsLinkGetAll(options: CppManagementAnalyticsLinkGetAllRequest, callback: (err: CppError | null, result: CppManagementAnalyticsLinkGetAllResponse) => void): void;
}
export interface CppBindingAutogen {
    management_analytics_couchbase_link_encryption_level: {
        none: CppManagementAnalyticsCouchbaseLinkEncryptionLevel;
        half: CppManagementAnalyticsCouchbaseLinkEncryptionLevel;
        full: CppManagementAnalyticsCouchbaseLinkEncryptionLevel;
    };
    management_cluster_bucket_type: {
        unknown: CppManagementClusterBucketType;
        couchbase: CppManagementClusterBucketType;
        memcached: CppManagementClusterBucketType;
        ephemeral: CppManagementClusterBucketType;
    };
    management_cluster_bucket_compression: {
        unknown: CppManagementClusterBucketCompression;
        off: CppManagementClusterBucketCompression;
        active: CppManagementClusterBucketCompression;
        passive: CppManagementClusterBucketCompression;
    };
    management_cluster_bucket_eviction_policy: {
        unknown: CppManagementClusterBucketEvictionPolicy;
        full: CppManagementClusterBucketEvictionPolicy;
        value_only: CppManagementClusterBucketEvictionPolicy;
        no_eviction: CppManagementClusterBucketEvictionPolicy;
        not_recently_used: CppManagementClusterBucketEvictionPolicy;
    };
    management_cluster_bucket_conflict_resolution: {
        unknown: CppManagementClusterBucketConflictResolution;
        timestamp: CppManagementClusterBucketConflictResolution;
        sequence_number: CppManagementClusterBucketConflictResolution;
        custom: CppManagementClusterBucketConflictResolution;
    };
    management_cluster_bucket_storage_backend: {
        unknown: CppManagementClusterBucketStorageBackend;
        couchstore: CppManagementClusterBucketStorageBackend;
        magma: CppManagementClusterBucketStorageBackend;
    };
    management_eventing_function_dcp_boundary: {
        everything: CppManagementEventingFunctionDcpBoundary;
        from_now: CppManagementEventingFunctionDcpBoundary;
    };
    management_eventing_function_language_compatibility: {
        version_6_0_0: CppManagementEventingFunctionLanguageCompatibility;
        version_6_5_0: CppManagementEventingFunctionLanguageCompatibility;
        version_6_6_2: CppManagementEventingFunctionLanguageCompatibility;
        version_7_2_0: CppManagementEventingFunctionLanguageCompatibility;
    };
    management_eventing_function_log_level: {
        info: CppManagementEventingFunctionLogLevel;
        error: CppManagementEventingFunctionLogLevel;
        warning: CppManagementEventingFunctionLogLevel;
        debug: CppManagementEventingFunctionLogLevel;
        trace: CppManagementEventingFunctionLogLevel;
    };
    management_eventing_function_bucket_access: {
        read_only: CppManagementEventingFunctionBucketAccess;
        read_write: CppManagementEventingFunctionBucketAccess;
    };
    management_eventing_function_status: {
        undeployed: CppManagementEventingFunctionStatus;
        undeploying: CppManagementEventingFunctionStatus;
        deploying: CppManagementEventingFunctionStatus;
        deployed: CppManagementEventingFunctionStatus;
        paused: CppManagementEventingFunctionStatus;
        pausing: CppManagementEventingFunctionStatus;
    };
    management_eventing_function_deployment_status: {
        deployed: CppManagementEventingFunctionDeploymentStatus;
        undeployed: CppManagementEventingFunctionDeploymentStatus;
    };
    management_eventing_function_processing_status: {
        running: CppManagementEventingFunctionProcessingStatus;
        paused: CppManagementEventingFunctionProcessingStatus;
    };
    management_rbac_auth_domain: {
        unknown: CppManagementRbacAuthDomain;
        local: CppManagementRbacAuthDomain;
        external: CppManagementRbacAuthDomain;
    };
    retry_reason: {
        do_not_retry: CppRetryReason;
        unknown: CppRetryReason;
        socket_not_available: CppRetryReason;
        service_not_available: CppRetryReason;
        node_not_available: CppRetryReason;
        key_value_not_my_vbucket: CppRetryReason;
        key_value_collection_outdated: CppRetryReason;
        key_value_error_map_retry_indicated: CppRetryReason;
        key_value_locked: CppRetryReason;
        key_value_temporary_failure: CppRetryReason;
        key_value_sync_write_in_progress: CppRetryReason;
        key_value_sync_write_re_commit_in_progress: CppRetryReason;
        service_response_code_indicated: CppRetryReason;
        socket_closed_while_in_flight: CppRetryReason;
        circuit_breaker_open: CppRetryReason;
        query_prepared_statement_failure: CppRetryReason;
        query_index_not_found: CppRetryReason;
        analytics_temporary_failure: CppRetryReason;
        search_too_many_requests: CppRetryReason;
        views_temporary_failure: CppRetryReason;
        views_no_active_partition: CppRetryReason;
    };
    protocol_subdoc_opcode: {
        get_doc: CppProtocolSubdocOpcode;
        set_doc: CppProtocolSubdocOpcode;
        remove_doc: CppProtocolSubdocOpcode;
        get: CppProtocolSubdocOpcode;
        exists: CppProtocolSubdocOpcode;
        dict_add: CppProtocolSubdocOpcode;
        dict_upsert: CppProtocolSubdocOpcode;
        remove: CppProtocolSubdocOpcode;
        replace: CppProtocolSubdocOpcode;
        array_push_last: CppProtocolSubdocOpcode;
        array_push_first: CppProtocolSubdocOpcode;
        array_insert: CppProtocolSubdocOpcode;
        array_add_unique: CppProtocolSubdocOpcode;
        counter: CppProtocolSubdocOpcode;
        get_count: CppProtocolSubdocOpcode;
        replace_body_with_xattr: CppProtocolSubdocOpcode;
    };
    analytics_scan_consistency: {
        not_bounded: CppAnalyticsScanConsistency;
        request_plus: CppAnalyticsScanConsistency;
    };
    design_document_namespace: {
        development: CppDesignDocumentNamespace;
        production: CppDesignDocumentNamespace;
    };
    diag_cluster_state: {
        online: CppDiagClusterState;
        degraded: CppDiagClusterState;
        offline: CppDiagClusterState;
    };
    diag_endpoint_state: {
        disconnected: CppDiagEndpointState;
        connecting: CppDiagEndpointState;
        connected: CppDiagEndpointState;
        disconnecting: CppDiagEndpointState;
    };
    diag_ping_state: {
        ok: CppDiagPingState;
        timeout: CppDiagPingState;
        error: CppDiagPingState;
    };
    query_profile: {
        off: CppQueryProfile;
        phases: CppQueryProfile;
        timings: CppQueryProfile;
    };
    query_scan_consistency: {
        not_bounded: CppQueryScanConsistency;
        request_plus: CppQueryScanConsistency;
    };
    search_highlight_style: {
        html: CppSearchHighlightStyle;
        ansi: CppSearchHighlightStyle;
    };
    search_scan_consistency: {
        not_bounded: CppSearchScanConsistency;
    };
    service_type: {
        key_value: CppServiceType;
        query: CppServiceType;
        analytics: CppServiceType;
        search: CppServiceType;
        view: CppServiceType;
        management: CppServiceType;
        eventing: CppServiceType;
    };
    view_on_error: {
        resume: CppViewOnError;
        stop: CppViewOnError;
    };
    view_scan_consistency: {
        not_bounded: CppViewScanConsistency;
        update_after: CppViewScanConsistency;
        request_plus: CppViewScanConsistency;
    };
    view_sort_order: {
        ascending: CppViewSortOrder;
        descending: CppViewSortOrder;
    };
    analytics_response_analytics_status: {
        running: CppAnalyticsResponseAnalyticsStatus;
        success: CppAnalyticsResponseAnalyticsStatus;
        errors: CppAnalyticsResponseAnalyticsStatus;
        completed: CppAnalyticsResponseAnalyticsStatus;
        stopped: CppAnalyticsResponseAnalyticsStatus;
        timedout: CppAnalyticsResponseAnalyticsStatus;
        closed: CppAnalyticsResponseAnalyticsStatus;
        fatal: CppAnalyticsResponseAnalyticsStatus;
        aborted: CppAnalyticsResponseAnalyticsStatus;
        unknown: CppAnalyticsResponseAnalyticsStatus;
    };
    durability_level: {
        none: CppDurabilityLevel;
        majority: CppDurabilityLevel;
        majority_and_persist_to_active: CppDurabilityLevel;
        persist_to_majority: CppDurabilityLevel;
    };
    errc_common: {
        request_canceled: CppErrcCommon;
        invalid_argument: CppErrcCommon;
        service_not_available: CppErrcCommon;
        internal_server_failure: CppErrcCommon;
        authentication_failure: CppErrcCommon;
        temporary_failure: CppErrcCommon;
        parsing_failure: CppErrcCommon;
        cas_mismatch: CppErrcCommon;
        bucket_not_found: CppErrcCommon;
        collection_not_found: CppErrcCommon;
        unsupported_operation: CppErrcCommon;
        ambiguous_timeout: CppErrcCommon;
        unambiguous_timeout: CppErrcCommon;
        feature_not_available: CppErrcCommon;
        scope_not_found: CppErrcCommon;
        index_not_found: CppErrcCommon;
        index_exists: CppErrcCommon;
        encoding_failure: CppErrcCommon;
        decoding_failure: CppErrcCommon;
        rate_limited: CppErrcCommon;
        quota_limited: CppErrcCommon;
    };
    errc_key_value: {
        document_not_found: CppErrcKeyValue;
        document_irretrievable: CppErrcKeyValue;
        document_locked: CppErrcKeyValue;
        value_too_large: CppErrcKeyValue;
        document_exists: CppErrcKeyValue;
        durability_level_not_available: CppErrcKeyValue;
        durability_impossible: CppErrcKeyValue;
        durability_ambiguous: CppErrcKeyValue;
        durable_write_in_progress: CppErrcKeyValue;
        durable_write_re_commit_in_progress: CppErrcKeyValue;
        path_not_found: CppErrcKeyValue;
        path_mismatch: CppErrcKeyValue;
        path_invalid: CppErrcKeyValue;
        path_too_big: CppErrcKeyValue;
        path_too_deep: CppErrcKeyValue;
        value_too_deep: CppErrcKeyValue;
        value_invalid: CppErrcKeyValue;
        document_not_json: CppErrcKeyValue;
        number_too_big: CppErrcKeyValue;
        delta_invalid: CppErrcKeyValue;
        path_exists: CppErrcKeyValue;
        xattr_unknown_macro: CppErrcKeyValue;
        xattr_invalid_key_combo: CppErrcKeyValue;
        xattr_unknown_virtual_attribute: CppErrcKeyValue;
        xattr_cannot_modify_virtual_attribute: CppErrcKeyValue;
        xattr_no_access: CppErrcKeyValue;
        document_not_locked: CppErrcKeyValue;
        cannot_revive_living_document: CppErrcKeyValue;
        mutation_token_outdated: CppErrcKeyValue;
        range_scan_completed: CppErrcKeyValue;
    };
    errc_query: {
        planning_failure: CppErrcQuery;
        index_failure: CppErrcQuery;
        prepared_statement_failure: CppErrcQuery;
        dml_failure: CppErrcQuery;
    };
    errc_analytics: {
        compilation_failure: CppErrcAnalytics;
        job_queue_full: CppErrcAnalytics;
        dataset_not_found: CppErrcAnalytics;
        dataverse_not_found: CppErrcAnalytics;
        dataset_exists: CppErrcAnalytics;
        dataverse_exists: CppErrcAnalytics;
        link_not_found: CppErrcAnalytics;
        link_exists: CppErrcAnalytics;
    };
    errc_search: {
        index_not_ready: CppErrcSearch;
        consistency_mismatch: CppErrcSearch;
    };
    errc_view: {
        view_not_found: CppErrcView;
        design_document_not_found: CppErrcView;
    };
    errc_management: {
        collection_exists: CppErrcManagement;
        scope_exists: CppErrcManagement;
        user_not_found: CppErrcManagement;
        group_not_found: CppErrcManagement;
        bucket_exists: CppErrcManagement;
        user_exists: CppErrcManagement;
        bucket_not_flushable: CppErrcManagement;
        eventing_function_not_found: CppErrcManagement;
        eventing_function_not_deployed: CppErrcManagement;
        eventing_function_compilation_failure: CppErrcManagement;
        eventing_function_identical_keyspace: CppErrcManagement;
        eventing_function_not_bootstrapped: CppErrcManagement;
        eventing_function_deployed: CppErrcManagement;
        eventing_function_paused: CppErrcManagement;
    };
    errc_field_level_encryption: {
        generic_cryptography_failure: CppErrcFieldLevelEncryption;
        encryption_failure: CppErrcFieldLevelEncryption;
        decryption_failure: CppErrcFieldLevelEncryption;
        crypto_key_not_found: CppErrcFieldLevelEncryption;
        invalid_crypto_key: CppErrcFieldLevelEncryption;
        decrypter_not_found: CppErrcFieldLevelEncryption;
        encrypter_not_found: CppErrcFieldLevelEncryption;
        invalid_ciphertext: CppErrcFieldLevelEncryption;
    };
    errc_network: {
        resolve_failure: CppErrcNetwork;
        no_endpoints_left: CppErrcNetwork;
        handshake_failure: CppErrcNetwork;
        protocol_error: CppErrcNetwork;
        configuration_not_available: CppErrcNetwork;
        cluster_closed: CppErrcNetwork;
        end_of_stream: CppErrcNetwork;
        need_more_data: CppErrcNetwork;
        operation_queue_closed: CppErrcNetwork;
        operation_queue_full: CppErrcNetwork;
        request_already_queued: CppErrcNetwork;
        request_cancelled: CppErrcNetwork;
        bucket_closed: CppErrcNetwork;
    };
    key_value_status_code: {
        success: CppKeyValueStatusCode;
        not_found: CppKeyValueStatusCode;
        exists: CppKeyValueStatusCode;
        too_big: CppKeyValueStatusCode;
        invalid: CppKeyValueStatusCode;
        not_stored: CppKeyValueStatusCode;
        delta_bad_value: CppKeyValueStatusCode;
        not_my_vbucket: CppKeyValueStatusCode;
        no_bucket: CppKeyValueStatusCode;
        dcp_stream_not_found: CppKeyValueStatusCode;
        opaque_no_match: CppKeyValueStatusCode;
        locked: CppKeyValueStatusCode;
        not_locked: CppKeyValueStatusCode;
        config_only: CppKeyValueStatusCode;
        auth_stale: CppKeyValueStatusCode;
        auth_error: CppKeyValueStatusCode;
        auth_continue: CppKeyValueStatusCode;
        range_error: CppKeyValueStatusCode;
        rollback: CppKeyValueStatusCode;
        no_access: CppKeyValueStatusCode;
        not_initialized: CppKeyValueStatusCode;
        rate_limited_network_ingress: CppKeyValueStatusCode;
        rate_limited_network_egress: CppKeyValueStatusCode;
        rate_limited_max_connections: CppKeyValueStatusCode;
        rate_limited_max_commands: CppKeyValueStatusCode;
        scope_size_limit_exceeded: CppKeyValueStatusCode;
        unknown_frame_info: CppKeyValueStatusCode;
        unknown_command: CppKeyValueStatusCode;
        no_memory: CppKeyValueStatusCode;
        not_supported: CppKeyValueStatusCode;
        internal: CppKeyValueStatusCode;
        busy: CppKeyValueStatusCode;
        temporary_failure: CppKeyValueStatusCode;
        xattr_invalid: CppKeyValueStatusCode;
        unknown_collection: CppKeyValueStatusCode;
        no_collections_manifest: CppKeyValueStatusCode;
        cannot_apply_collections_manifest: CppKeyValueStatusCode;
        collections_manifest_is_ahead: CppKeyValueStatusCode;
        unknown_scope: CppKeyValueStatusCode;
        dcp_stream_id_invalid: CppKeyValueStatusCode;
        durability_invalid_level: CppKeyValueStatusCode;
        durability_impossible: CppKeyValueStatusCode;
        sync_write_in_progress: CppKeyValueStatusCode;
        sync_write_ambiguous: CppKeyValueStatusCode;
        sync_write_re_commit_in_progress: CppKeyValueStatusCode;
        subdoc_path_not_found: CppKeyValueStatusCode;
        subdoc_path_mismatch: CppKeyValueStatusCode;
        subdoc_path_invalid: CppKeyValueStatusCode;
        subdoc_path_too_big: CppKeyValueStatusCode;
        subdoc_doc_too_deep: CppKeyValueStatusCode;
        subdoc_value_cannot_insert: CppKeyValueStatusCode;
        subdoc_doc_not_json: CppKeyValueStatusCode;
        subdoc_num_range_error: CppKeyValueStatusCode;
        subdoc_delta_invalid: CppKeyValueStatusCode;
        subdoc_path_exists: CppKeyValueStatusCode;
        subdoc_value_too_deep: CppKeyValueStatusCode;
        subdoc_invalid_combo: CppKeyValueStatusCode;
        subdoc_multi_path_failure: CppKeyValueStatusCode;
        subdoc_success_deleted: CppKeyValueStatusCode;
        subdoc_xattr_invalid_flag_combo: CppKeyValueStatusCode;
        subdoc_xattr_invalid_key_combo: CppKeyValueStatusCode;
        subdoc_xattr_unknown_macro: CppKeyValueStatusCode;
        subdoc_xattr_unknown_vattr: CppKeyValueStatusCode;
        subdoc_xattr_cannot_modify_vattr: CppKeyValueStatusCode;
        subdoc_multi_path_failure_deleted: CppKeyValueStatusCode;
        subdoc_invalid_xattr_order: CppKeyValueStatusCode;
        subdoc_xattr_unknown_vattr_macro: CppKeyValueStatusCode;
        subdoc_can_only_revive_deleted_documents: CppKeyValueStatusCode;
        subdoc_deleted_document_cannot_have_value: CppKeyValueStatusCode;
        range_scan_cancelled: CppKeyValueStatusCode;
        range_scan_more: CppKeyValueStatusCode;
        range_scan_complete: CppKeyValueStatusCode;
        range_scan_vb_uuid_not_equal: CppKeyValueStatusCode;
        unknown: CppKeyValueStatusCode;
    };
    impl_subdoc_opcode: {
        get_doc: CppImplSubdocOpcode;
        set_doc: CppImplSubdocOpcode;
        remove_doc: CppImplSubdocOpcode;
        get: CppImplSubdocOpcode;
        exists: CppImplSubdocOpcode;
        dict_add: CppImplSubdocOpcode;
        dict_upsert: CppImplSubdocOpcode;
        remove: CppImplSubdocOpcode;
        replace: CppImplSubdocOpcode;
        array_push_last: CppImplSubdocOpcode;
        array_push_first: CppImplSubdocOpcode;
        array_insert: CppImplSubdocOpcode;
        array_add_unique: CppImplSubdocOpcode;
        counter: CppImplSubdocOpcode;
        get_count: CppImplSubdocOpcode;
        replace_body_with_xattr: CppImplSubdocOpcode;
    };
    store_semantics: {
        replace: CppStoreSemantics;
        upsert: CppStoreSemantics;
        insert: CppStoreSemantics;
        revive: CppStoreSemantics;
    };
    persist_to: {
        none: CppPersistTo;
        active: CppPersistTo;
        one: CppPersistTo;
        two: CppPersistTo;
        three: CppPersistTo;
        four: CppPersistTo;
    };
    replicate_to: {
        none: CppReplicateTo;
        one: CppReplicateTo;
        two: CppReplicateTo;
        three: CppReplicateTo;
    };
    read_preference: {
        no_preference: CppReadPreference;
        selected_server_group: CppReadPreference;
        selected_server_group_or_all_available: CppReadPreference;
    };
    vector_query_combination: {
        combination_and: CppVectorQueryCombination;
        combination_or: CppVectorQueryCombination;
    };
    transactions_failure_type: {
        FAIL: CppTransactionsFailureType;
        EXPIRY: CppTransactionsFailureType;
        COMMIT_AMBIGUOUS: CppTransactionsFailureType;
    };
    transactions_external_exception: {
        UNKNOWN: CppTransactionsExternalException;
        ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND: CppTransactionsExternalException;
        ACTIVE_TRANSACTION_RECORD_FULL: CppTransactionsExternalException;
        ACTIVE_TRANSACTION_RECORD_NOT_FOUND: CppTransactionsExternalException;
        DOCUMENT_ALREADY_IN_TRANSACTION: CppTransactionsExternalException;
        DOCUMENT_EXISTS_EXCEPTION: CppTransactionsExternalException;
        DOCUMENT_NOT_FOUND_EXCEPTION: CppTransactionsExternalException;
        NOT_SET: CppTransactionsExternalException;
        FEATURE_NOT_AVAILABLE_EXCEPTION: CppTransactionsExternalException;
        TRANSACTION_ABORTED_EXTERNALLY: CppTransactionsExternalException;
        PREVIOUS_OPERATION_FAILED: CppTransactionsExternalException;
        FORWARD_COMPATIBILITY_FAILURE: CppTransactionsExternalException;
        PARSING_FAILURE: CppTransactionsExternalException;
        ILLEGAL_STATE_EXCEPTION: CppTransactionsExternalException;
        COUCHBASE_EXCEPTION: CppTransactionsExternalException;
        SERVICE_NOT_AVAILABLE_EXCEPTION: CppTransactionsExternalException;
        REQUEST_CANCELED_EXCEPTION: CppTransactionsExternalException;
        CONCURRENT_OPERATIONS_DETECTED_ON_SAME_DOCUMENT: CppTransactionsExternalException;
        COMMIT_NOT_PERMITTED: CppTransactionsExternalException;
        ROLLBACK_NOT_PERMITTED: CppTransactionsExternalException;
        TRANSACTION_ALREADY_ABORTED: CppTransactionsExternalException;
        TRANSACTION_ALREADY_COMMITTED: CppTransactionsExternalException;
        DOCUMENT_UNRETRIEVABLE_EXCEPTION: CppTransactionsExternalException;
    };
    transactions_transaction_get_multi_mode: {
        prioritise_latency: CppTransactionsTransactionGetMultiMode;
        disable_read_skew_detection: CppTransactionsTransactionGetMultiMode;
        prioritise_read_skew_detection: CppTransactionsTransactionGetMultiMode;
    };
    transactions_transaction_get_multi_replicas_from_preferred_server_group_mode: {
        prioritise_latency: CppTransactionsTransactionGetMultiReplicasFromPreferredServerGroupMode;
        disable_read_skew_detection: CppTransactionsTransactionGetMultiReplicasFromPreferredServerGroupMode;
        prioritise_read_skew_detection: CppTransactionsTransactionGetMultiReplicasFromPreferredServerGroupMode;
    };
}
export type CppErrc = CppErrcCommon | CppErrcKeyValue | CppErrcQuery | CppErrcAnalytics | CppErrcSearch | CppErrcView | CppErrcManagement | CppErrcFieldLevelEncryption | CppErrcNetwork;
export interface CppErrorBase {
    code: CppErrc;
}
export interface CppGenericError extends CppErrorBase {
    ctxtype: undefined | null;
}
export interface CppEnhancedErrorInfo {
    reference: string;
    context: string;
}
export interface CppKeyValueError extends CppErrorBase {
    ctxtype: 'key_value';
    id: CppDocumentId;
    opaque: number;
    cas: CppCas;
    status_code: CppKeyValueStatusCode;
    enhanced_error_info: CppEnhancedErrorInfo;
    last_dispatched_to: string;
    last_dispatched_from: string;
    retry_attempts: number;
    retry_reasons: CppRetryReason[];
}
export interface CppViewError extends CppErrorBase {
    ctxtype: 'view';
    client_context_id: string;
    design_document_name: string;
    view_name: string;
    query_string: string;
    method: string;
    path: string;
    http_status: number;
    http_body: string;
    last_dispatched_to: string;
    last_dispatched_from: string;
    retry_attempts: number;
    retry_reasons: CppRetryReason[];
}
export interface CppQueryError extends CppErrorBase {
    ctxtype: 'query';
    first_error_code: number;
    first_error_message: string;
    client_context_id: string;
    statement: string;
    parameters: string;
    method: string;
    path: string;
    http_status: number;
    http_body: string;
    last_dispatched_to: string;
    last_dispatched_from: string;
    retry_attempts: number;
    retry_reasons: CppRetryReason[];
}
export interface CppSearchError extends CppErrorBase {
    ctxtype: 'search';
    client_context_id: string;
    index_name: string;
    query: string;
    parameters: string;
    method: string;
    path: string;
    http_status: number;
    http_body: string;
    last_dispatched_to: string;
    last_dispatched_from: string;
    retry_attempts: number;
    retry_reasons: CppRetryReason[];
}
export interface CppAnalyticsError extends CppErrorBase {
    ctxtype: 'analytics';
    first_error_code: number;
    first_error_message: string;
    client_context_id: string;
    statement: string;
    parameters: string;
    method: string;
    path: string;
    http_status: number;
    http_body: string;
    last_dispatched_to: string;
    last_dispatched_from: string;
    retry_attempts: number;
    retry_reasons: CppRetryReason[];
}
export interface CppHttpError extends CppErrorBase {
    ctxtype: 'http';
    client_context_id: string;
    method: string;
    path: string;
    http_status: number;
    http_body: string;
    last_dispatched_to: string;
    last_dispatched_from: string;
    retry_attempts: number;
    retry_reasons: CppRetryReason[];
}
export interface CppTxnOperationFailed extends CppErrorBase {
    ctxtype: 'transaction_operation_failed';
    ctx: CppTransactionErrorContext;
    should_not_retry: boolean;
    should_not_rollback: boolean;
    cause: CppTransactionsExternalException;
    message?: string;
}
export interface CppTxnOpException extends CppErrorBase {
    ctxtype: 'transaction_op_exception';
    ctx: CppTransactionOpErrorContext | undefined;
    cause: CppTransactionsExternalException;
    message?: string;
}
export interface CppTxnError extends CppErrorBase {
    ctxtype: 'transaction_exception';
    result: CppTransactionResult;
    cause: CppTransactionsExternalException;
    type: CppTransactionsFailureType;
    message?: string;
}
export interface CppTransactionErrorContext {
    code: CppErrc;
    cause: CppErrc;
}
export interface CppTransactionOpErrorContext {
    code: CppErrc;
    cause: CppKeyValueError | CppQueryError | undefined;
}
export type CppError = CppGenericError | CppKeyValueError | CppViewError | CppQueryError | CppSearchError | CppAnalyticsError | CppHttpError | CppTxnOperationFailed | CppTxnOpException | CppTxnError;
export interface CppConnection extends CppConnectionAutogen {
    connect(connStr: string, credentials: CppClusterCredentials, dnsOptions: CppDnsConfig | null, appTelemetryOptions: CppAppTelemetryConfig | null, tracingOptions: CppTracingConfig | null, orphanReporterOptions: CppOrphanReporterConfig | null, metricsOptions: CppMetricsConfig | null, callback: (err: CppError | null) => void): void;
    shutdown(callback: (err: CppError | null) => void): void;
    openBucket(bucketName: string, callback: (err: CppError | null) => void): void;
    diagnostics(options: {
        report_id?: string;
    }, callback: (err: CppError | null, result: {
        version: number;
        id: string;
        sdk: string;
        services: {
            [serviceType: number]: {
                type: CppServiceType;
                id: string;
                last_activity: number;
                remote: string;
                local: string;
                state: CppDiagEndpointState;
                bucket?: string;
                details?: string;
            }[];
        };
    }) => void): void;
    ping(options: {
        report_id?: string;
        bucket_name?: string;
        services?: CppServiceType[];
    }, callback: (err: CppError | null, result: {
        version: number;
        id: string;
        sdk: string;
        services: {
            [serviceType: number]: {
                type: CppServiceType;
                id: string;
                latency: number;
                remote: string;
                local: string;
                state: CppDiagPingState;
                bucket?: string;
                error?: string;
            }[];
        };
    }) => void): void;
    scan(bucket_name: string, scope_name: string, collection_name: string, scan_type_name: string, scan_type_value: CppRangeScan | CppSamplingScan | CppPrefixScan, options: CppRangeScanOrchestratorOptions): {
        cppErr: CppError | null;
        result: CppScanIterator;
    };
}
export interface CppTransactionKeyspace {
    bucket_name: string;
    scope_name?: string;
    collection_name?: string;
}
export interface CppTransactionsConfig {
    durability_level?: CppDurabilityLevel;
    timeout?: CppMilliseconds;
    query_scan_consistency?: CppQueryScanConsistency;
    cleanup_window?: CppMilliseconds;
    cleanup_lost_attempts?: boolean;
    cleanup_client_attempts?: boolean;
    metadata_collection?: CppTransactionKeyspace;
}
export interface CppTransactionOptions {
    durability_level?: CppDurabilityLevel;
    timeout?: CppMilliseconds;
    query_scan_consistency?: CppQueryScanConsistency;
}
export interface CppTransactionLinks {
    atr_id: string;
    atr_bucket_name: string;
    atr_scope_name: string;
    atr_collection_name: string;
    staged_transaction_id: string;
    staged_attempt_id: string;
    staged_operation_id: string;
    staged_content_json: string;
    staged_content_binary?: Buffer;
    cas_pre_txn: string;
    revid_pre_txn: string;
    exptime_pre_txn: number;
    crc32_of_staging: string;
    op: string;
    forward_compat: string;
    is_deleted: boolean;
}
export interface CppTransactionGetMetaData {
    cas: string;
    revid: string;
    exptime: number;
    crc32: string;
}
export interface CppTransactionGetResult {
    id: CppDocumentId;
    cas: CppCas;
    content: CppEncodedValue;
    links: CppTransactionLinks;
    metadata: CppTransactionGetMetaData;
}
export interface CppTransactionGetMultiResult {
    content: (CppEncodedValue | undefined)[];
}
export interface CppTransactionGetMultiReplicasFromPreferredServerGroupResult {
    content: (CppEncodedValue | undefined)[];
}
export interface CppTransactionResult {
    transaction_id: string;
    unstaging_complete: boolean;
}
export interface CppTransactions {
    new (conn: CppConnection): any;
    close(callback: (err: CppError | null) => void): void;
}
export interface CppTransaction {
    newAttempt(callback: (err: CppError | null) => void): void;
    get(options: {
        id: CppDocumentId;
    }, callback: (err: CppError | null, result: CppTransactionGetResult | null) => void): void;
    getReplicaFromPreferredServerGroup(options: {
        id: CppDocumentId;
    }, callback: (err: CppError | null, result: CppTransactionGetResult | null) => void): void;
    getMulti(options: {
        ids: CppDocumentId[];
        mode?: CppTransactionsTransactionGetMultiMode;
    }, callback: (err: CppError | null, result: CppTransactionGetMultiResult | null) => void): void;
    getMultiReplicasFromPreferredServerGroup(options: {
        ids: CppDocumentId[];
        mode?: CppTransactionsTransactionGetMultiReplicasFromPreferredServerGroupMode;
    }, callback: (err: CppError | null, result: CppTransactionGetMultiReplicasFromPreferredServerGroupResult | null) => void): void;
    insert(options: {
        id: CppDocumentId;
        content: CppEncodedValue;
    }, callback: (err: CppError | null, result: CppTransactionGetResult | null) => void): void;
    replace(options: {
        doc: CppTransactionGetResult;
        content: CppEncodedValue;
    }, callback: (err: CppError | null, result: CppTransactionGetResult | null) => void): void;
    remove(options: {
        doc: CppTransactionGetResult;
    }, callback: (err: CppError | null) => void): void;
    query(statement: string, options: {
        raw?: {
            [key: string]: CppJsonString;
        };
        ad_hoc?: boolean;
        scan_consistency?: CppQueryScanConsistency;
        profile?: CppQueryProfile;
        metrics?: boolean;
        client_context_id?: string;
        scan_wait?: CppMilliseconds;
        readonly?: boolean;
        scan_cap?: number;
        pipeline_batch?: number;
        pipeline_cap?: number;
        max_parallelism?: number;
        positional_parameters?: CppJsonString[];
        named_parameters?: {
            [key: string]: CppJsonString;
        };
    }, callback: (err: CppError | null, resp: CppQueryResponse | null) => void): void;
    commit(callback: (err: CppError | null, resp: CppTransactionResult) => void): void;
    rollback(callback: (err: CppError | null) => void): void;
}
export interface CppBinding extends CppBindingAutogen {
    cbppVersion: string;
    cbppMetadata: string;
    enableProtocolLogger: (filename: string) => void;
    shutdownLogger: () => void;
    Connection: {
        new (): CppConnection;
    };
    Transactions: {
        new (conn: CppConnection, config: CppTransactionsConfig): CppTransactions;
    };
    Transaction: {
        new (txns: CppTransactions, options: CppTransactionOptions): CppTransaction;
    };
    protocol_lookup_in_request_body_doc_flag: {
        access_deleted: number;
    };
    protocol_lookup_in_request_body_lookup_in_specs_path_flag: {
        xattr: number;
    };
    protocol_mutate_in_request_body_doc_flag: {
        mkdoc: number;
        add: number;
        access_deleted: number;
        create_as_deleted: number;
        revive_document: number;
    };
    protocol_mutate_in_request_body_mutate_in_specs_path_flag: {
        create_parents: number;
        xattr: number;
        expand_macros: number;
    };
}
declare const binding: CppBinding;
export default binding;
