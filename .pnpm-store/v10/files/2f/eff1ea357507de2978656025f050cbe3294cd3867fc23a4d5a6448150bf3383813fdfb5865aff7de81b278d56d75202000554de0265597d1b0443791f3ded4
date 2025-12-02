import { AnalyticsScanConsistency, AnalyticsStatus } from './analyticstypes';
import { AnalyticsEncryptionLevel, CouchbaseAnalyticsEncryptionSettings } from './analyticsindexmanager';
import { CppAnalyticsResponseAnalyticsStatus, CppAnalyticsScanConsistency, CppDesignDocumentNamespace, CppDiagEndpointState, CppDiagPingState, CppDurabilityLevel, CppError, CppManagementAnalyticsCouchbaseLinkEncryptionLevel, CppManagementAnalyticsCouchbaseLinkEncryptionSettings, CppManagementClusterBucketCompression, CppManagementClusterBucketConflictResolution, CppManagementClusterBucketEvictionPolicy, CppManagementClusterBucketStorageBackend, CppManagementClusterBucketType, CppManagementEventingFunctionBucketAccess, CppManagementEventingFunctionDcpBoundary, CppManagementEventingFunctionDeploymentStatus, CppManagementEventingFunctionLanguageCompatibility, CppManagementEventingFunctionLogLevel, CppManagementEventingFunctionProcessingStatus, CppManagementEventingFunctionStatus, CppManagementRbacAuthDomain, CppMutationState, CppPersistTo, CppPrefixScan, CppQueryProfile, CppQueryScanConsistency, CppRangeScan, CppReadPreference, CppReplicateTo, CppSamplingScan, CppSearchHighlightStyle, CppSearchScanConsistency, CppServiceType, CppStoreSemantics, CppTransactionKeyspace, CppTransactionsExternalException, CppTransactionsTransactionGetMultiMode, CppTransactionsTransactionGetMultiReplicasFromPreferredServerGroupMode, CppTxnOpException, CppVectorQueryCombination, CppViewScanConsistency, CppViewSortOrder } from './binding';
import { BucketType, CompressionMode, ConflictResolutionType, EvictionPolicy, StorageBackend } from './bucketmanager';
import { EndpointState, PingState } from './diagnosticstypes';
import { ErrorContext } from './errorcontexts';
import { DurabilityLevel, ReadPreference, ServiceType, StoreSemantics } from './generaltypes';
import { MutationState } from './mutationstate';
import { QueryProfileMode, QueryScanConsistency } from './querytypes';
import { PrefixScan, RangeScan, SamplingScan } from './rangeScan';
import { HighlightStyle, SearchScanConsistency } from './searchtypes';
import { TransactionGetMultiMode, TransactionGetMultiReplicasFromPreferredServerGroupMode, TransactionKeyspace } from './transactions';
import { VectorQueryCombination } from './vectorsearch';
import { DesignDocumentNamespace, ViewOrdering, ViewScanConsistency } from './viewtypes';
import { EventingFunctionBucketAccess, EventingFunctionDcpBoundary, EventingFunctionDeploymentStatus, EventingFunctionLanguageCompatibility, EventingFunctionLogLevel, EventingFunctionProcessingStatus, EventingFunctionStatus } from './eventingfunctionmanager';
/**
 * @internal
 */
export declare function durabilityToCpp(mode: DurabilityLevel | string | undefined): CppDurabilityLevel;
/**
 * @internal
 */
export declare function durabilityFromCpp(mode: CppDurabilityLevel | undefined): DurabilityLevel | undefined;
/**
 * @internal
 */
export declare function persistToToCpp(persistTo: number | undefined): CppPersistTo;
/**
 * @internal
 */
export declare function replicateToToCpp(replicateTo: number | undefined): CppReplicateTo;
/**
 * @internal
 */
export declare function storeSemanticToCpp(mode: StoreSemantics | undefined): CppStoreSemantics;
/**
 * @internal
 */
export declare function viewScanConsistencyToCpp(mode: ViewScanConsistency | undefined): CppViewScanConsistency | undefined;
/**
 * @internal
 */
export declare function viewOrderingToCpp(ordering: ViewOrdering | undefined): CppViewSortOrder | undefined;
/**
 * @internal
 */
export declare function queryScanConsistencyToCpp(mode: QueryScanConsistency | undefined): CppQueryScanConsistency | undefined;
/**
 * @internal
 */
export declare function queryScanConsistencyFromCpp(mode: CppQueryScanConsistency | undefined): QueryScanConsistency | undefined;
/**
 * @internal
 */
export declare function queryProfileToCpp(mode: QueryProfileMode | undefined): CppQueryProfile;
/**
 * @internal
 */
export declare function analyticsScanConsistencyToCpp(mode: AnalyticsScanConsistency | undefined): CppAnalyticsScanConsistency;
/**
 * @internal
 */
export declare function analyticsStatusFromCpp(status: CppAnalyticsResponseAnalyticsStatus): AnalyticsStatus;
/**
 * @internal
 */
export declare function searchScanConsistencyToCpp(mode: SearchScanConsistency | undefined): CppSearchScanConsistency;
/**
 * @internal
 */
export declare function searchHighlightStyleToCpp(mode: HighlightStyle | undefined): CppSearchHighlightStyle | undefined;
/**
 * @internal
 */
export declare function mutationStateToCpp(state: MutationState | undefined): CppMutationState;
/**
 * @internal
 */
export declare function serviceTypeToCpp(service: ServiceType): CppServiceType;
/**
 * @internal
 */
export declare function serviceTypeFromCpp(service: CppServiceType): ServiceType;
/**
 * @internal
 */
export declare function endpointStateFromCpp(service: CppDiagEndpointState): EndpointState;
/**
 * @internal
 */
export declare function txnExternalExceptionStringFromCpp(cause: CppTransactionsExternalException, message?: string): string;
/**
 * @internal
 */
export declare function txnOpExeptionFromCpp(err: CppTxnOpException | null, ctx: ErrorContext | null): Error | null;
/**
 * @internal
 */
export declare function pingStateFromCpp(service: CppDiagPingState): PingState;
/**
 * @internal
 */
export declare function contextFromCpp(err: CppError | null): ErrorContext | null;
/**
 * @internal
 */
export declare function errorFromCpp(err: CppError | null): Error | null;
/**
 * @internal
 */
export declare function scanTypeToCpp(scanType: RangeScan | SamplingScan | PrefixScan): CppRangeScan | CppSamplingScan | CppPrefixScan;
/**
 * @internal
 */
export declare function bucketTypeToCpp(type: BucketType | string | undefined): CppManagementClusterBucketType;
/**
 * @internal
 */
export declare function bucketTypeFromCpp(type: CppManagementClusterBucketType): BucketType | undefined;
/**
 * @internal
 */
export declare function bucketCompressionModeToCpp(mode: CompressionMode | string | undefined): CppManagementClusterBucketCompression;
/**
 * @internal
 */
export declare function bucketCompressionModeFromCpp(mode: CppManagementClusterBucketCompression): CompressionMode | undefined;
/**
 * @internal
 */
export declare function bucketEvictionPolicyToCpp(policy: EvictionPolicy | string | undefined): CppManagementClusterBucketEvictionPolicy;
/**
 * @internal
 */
export declare function bucketEvictionPolicyFromCpp(policy: CppManagementClusterBucketEvictionPolicy): EvictionPolicy | undefined;
/**
 * @internal
 */
export declare function bucketStorageBackendToCpp(backend: StorageBackend | string | undefined): CppManagementClusterBucketStorageBackend;
/**
 * @internal
 */
export declare function bucketStorageBackendFromCpp(backend: CppManagementClusterBucketStorageBackend): StorageBackend | undefined;
/**
 * @internal
 */
export declare function bucketConflictResolutionTypeToCpp(type: ConflictResolutionType | string | undefined): CppManagementClusterBucketConflictResolution;
/**
 * @internal
 */
export declare function bucketConflictResolutionTypeFromCpp(type: CppManagementClusterBucketConflictResolution): ConflictResolutionType | undefined;
/**
 * @internal
 */
export declare function vectorQueryCombinationToCpp(combination: VectorQueryCombination | undefined): CppVectorQueryCombination;
/**
 * @internal
 */
export declare function designDocumentNamespaceFromCpp(namespace: CppDesignDocumentNamespace): DesignDocumentNamespace;
/**
 * @internal
 */
export declare function designDocumentNamespaceToCpp(namespace: DesignDocumentNamespace): CppDesignDocumentNamespace;
/**
 * @internal
 */
export declare function transactionKeyspaceToCpp(keyspace?: TransactionKeyspace): CppTransactionKeyspace | undefined;
/**
 * @internal
 */
export declare function eventingBucketBindingAccessToCpp(access: EventingFunctionBucketAccess): CppManagementEventingFunctionBucketAccess;
/**
 * @internal
 */
export declare function eventingBucketBindingAccessFromCpp(access: CppManagementEventingFunctionBucketAccess): EventingFunctionBucketAccess;
/**
 * @internal
 */
export declare function eventingFunctionDcpBoundaryToCpp(boundary: EventingFunctionDcpBoundary | undefined): CppManagementEventingFunctionDcpBoundary | undefined;
/**
 * @internal
 */
export declare function eventingFunctionDcpBoundaryFromCpp(boundary: CppManagementEventingFunctionDcpBoundary | undefined): EventingFunctionDcpBoundary | undefined;
/**
 * @internal
 */
export declare function eventingFunctionDeploymentStatusToCpp(status: EventingFunctionDeploymentStatus | undefined): CppManagementEventingFunctionDeploymentStatus | undefined;
/**
 * @internal
 */
export declare function eventingFunctionDeploymentStatusFromCpp(status: CppManagementEventingFunctionDeploymentStatus | undefined): EventingFunctionDeploymentStatus | undefined;
/**
 * @internal
 */
export declare function eventingFunctionProcessingStatusToCpp(status: EventingFunctionProcessingStatus | undefined): CppManagementEventingFunctionProcessingStatus | undefined;
/**
 * @internal
 */
export declare function eventingFunctionProcessingStatusFromCpp(status: CppManagementEventingFunctionProcessingStatus | undefined): EventingFunctionProcessingStatus | undefined;
/**
 * @internal
 */
export declare function eventingFunctionLogLevelToCpp(level: EventingFunctionLogLevel | undefined): CppManagementEventingFunctionLogLevel | undefined;
/**
 * @internal
 */
export declare function eventingFunctionLogLevelFromCpp(level: CppManagementEventingFunctionLogLevel | undefined): EventingFunctionLogLevel | undefined;
/**
 * @internal
 */
export declare function eventingFunctionLanguageCompatibilityToCpp(compatibility: EventingFunctionLanguageCompatibility | undefined): CppManagementEventingFunctionLanguageCompatibility | undefined;
/**
 * @internal
 */
export declare function eventingFunctionLanguageCompatibilityFromCpp(compatibility: CppManagementEventingFunctionLanguageCompatibility | undefined): EventingFunctionLanguageCompatibility | undefined;
/**
 * @internal
 */
export declare function eventingFunctionStatusFromCpp(status: CppManagementEventingFunctionStatus): EventingFunctionStatus;
/**
 * @internal
 */
export declare function couchbaseLinkEncryptionLevelFromCpp(level: CppManagementAnalyticsCouchbaseLinkEncryptionLevel): AnalyticsEncryptionLevel;
/**
 * @internal
 */
export declare function encryptionLevelToCpp(level: AnalyticsEncryptionLevel): CppManagementAnalyticsCouchbaseLinkEncryptionLevel;
/**
 * @internal
 */
export declare function encryptionSettingsToCpp(settings?: CouchbaseAnalyticsEncryptionSettings): CppManagementAnalyticsCouchbaseLinkEncryptionSettings;
/**
 * @internal
 */
export declare function encryptionSettingsFromCpp(settings: CppManagementAnalyticsCouchbaseLinkEncryptionSettings): CouchbaseAnalyticsEncryptionSettings;
/**
 * @internal
 */
export declare function authDomainToCpp(domain: string): CppManagementRbacAuthDomain;
/**
 * @internal
 */
export declare function authDomainFromCpp(domain: CppManagementRbacAuthDomain): string;
/**
 * @internal
 */
export declare function readPreferenceToCpp(preference: ReadPreference | undefined): CppReadPreference;
/**
 * @internal
 */
export declare function transactionGetMultiModeToCpp(mode: TransactionGetMultiMode | undefined): CppTransactionsTransactionGetMultiMode | undefined;
/**
 * @internal
 */
export declare function transactionGetMultiReplicasFromPreferredServerGroupModeToCpp(mode: TransactionGetMultiReplicasFromPreferredServerGroupMode | undefined): CppTransactionsTransactionGetMultiReplicasFromPreferredServerGroupMode | undefined;
