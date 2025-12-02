"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventingFunctionLanguageCompatibilityFromCpp = exports.eventingFunctionLanguageCompatibilityToCpp = exports.eventingFunctionLogLevelFromCpp = exports.eventingFunctionLogLevelToCpp = exports.eventingFunctionProcessingStatusFromCpp = exports.eventingFunctionProcessingStatusToCpp = exports.eventingFunctionDeploymentStatusFromCpp = exports.eventingFunctionDeploymentStatusToCpp = exports.eventingFunctionDcpBoundaryFromCpp = exports.eventingFunctionDcpBoundaryToCpp = exports.eventingBucketBindingAccessFromCpp = exports.eventingBucketBindingAccessToCpp = exports.transactionKeyspaceToCpp = exports.designDocumentNamespaceToCpp = exports.designDocumentNamespaceFromCpp = exports.vectorQueryCombinationToCpp = exports.bucketConflictResolutionTypeFromCpp = exports.bucketConflictResolutionTypeToCpp = exports.bucketStorageBackendFromCpp = exports.bucketStorageBackendToCpp = exports.bucketEvictionPolicyFromCpp = exports.bucketEvictionPolicyToCpp = exports.bucketCompressionModeFromCpp = exports.bucketCompressionModeToCpp = exports.bucketTypeFromCpp = exports.bucketTypeToCpp = exports.scanTypeToCpp = exports.errorFromCpp = exports.contextFromCpp = exports.pingStateFromCpp = exports.txnOpExeptionFromCpp = exports.txnExternalExceptionStringFromCpp = exports.endpointStateFromCpp = exports.serviceTypeFromCpp = exports.serviceTypeToCpp = exports.mutationStateToCpp = exports.searchHighlightStyleToCpp = exports.searchScanConsistencyToCpp = exports.analyticsStatusFromCpp = exports.analyticsScanConsistencyToCpp = exports.queryProfileToCpp = exports.queryScanConsistencyFromCpp = exports.queryScanConsistencyToCpp = exports.viewOrderingToCpp = exports.viewScanConsistencyToCpp = exports.storeSemanticToCpp = exports.replicateToToCpp = exports.persistToToCpp = exports.durabilityFromCpp = exports.durabilityToCpp = void 0;
exports.transactionGetMultiReplicasFromPreferredServerGroupModeToCpp = exports.transactionGetMultiModeToCpp = exports.readPreferenceToCpp = exports.authDomainFromCpp = exports.authDomainToCpp = exports.encryptionSettingsFromCpp = exports.encryptionSettingsToCpp = exports.encryptionLevelToCpp = exports.couchbaseLinkEncryptionLevelFromCpp = exports.eventingFunctionStatusFromCpp = void 0;
const analyticstypes_1 = require("./analyticstypes");
const analyticsindexmanager_1 = require("./analyticsindexmanager");
const binding_1 = __importDefault(require("./binding"));
const bucketmanager_1 = require("./bucketmanager");
const diagnosticstypes_1 = require("./diagnosticstypes");
const errctxs = __importStar(require("./errorcontexts"));
const errs = __importStar(require("./errors"));
const generaltypes_1 = require("./generaltypes");
const querytypes_1 = require("./querytypes");
const rangeScan_1 = require("./rangeScan");
const searchtypes_1 = require("./searchtypes");
const transactions_1 = require("./transactions");
const utilities_1 = require("./utilities");
const vectorsearch_1 = require("./vectorsearch");
const viewtypes_1 = require("./viewtypes");
const eventingfunctionmanager_1 = require("./eventingfunctionmanager");
/**
 * @internal
 */
function durabilityToCpp(mode) {
    // Unspecified is allowed, and means no sync durability.
    if (mode === null || mode === undefined) {
        return binding_1.default.durability_level.none;
    }
    if (typeof mode === 'string') {
        mode = (0, utilities_1.nsServerStrToDuraLevel)(mode);
    }
    if (mode === generaltypes_1.DurabilityLevel.None) {
        return binding_1.default.durability_level.none;
    }
    else if (mode === generaltypes_1.DurabilityLevel.Majority) {
        return binding_1.default.durability_level.majority;
    }
    else if (mode === generaltypes_1.DurabilityLevel.MajorityAndPersistOnMaster) {
        return binding_1.default.durability_level.majority_and_persist_to_active;
    }
    else if (mode === generaltypes_1.DurabilityLevel.PersistToMajority) {
        return binding_1.default.durability_level.persist_to_majority;
    }
    throw new errs.InvalidDurabilityLevel();
}
exports.durabilityToCpp = durabilityToCpp;
/**
 * @internal
 */
function durabilityFromCpp(mode) {
    if (mode === null || mode === undefined) {
        return undefined;
    }
    if (mode === binding_1.default.durability_level.none) {
        return generaltypes_1.DurabilityLevel.None;
    }
    else if (mode === binding_1.default.durability_level.majority) {
        return generaltypes_1.DurabilityLevel.Majority;
    }
    else if (mode === binding_1.default.durability_level.majority_and_persist_to_active) {
        return generaltypes_1.DurabilityLevel.MajorityAndPersistOnMaster;
    }
    else if (mode === binding_1.default.durability_level.persist_to_majority) {
        return generaltypes_1.DurabilityLevel.PersistToMajority;
    }
    throw new errs.InvalidDurabilityLevel();
}
exports.durabilityFromCpp = durabilityFromCpp;
/**
 * @internal
 */
function persistToToCpp(persistTo) {
    // Unspecified is allowed, and means no persistTo.
    if (persistTo === null || persistTo === undefined) {
        return binding_1.default.persist_to.none;
    }
    if (persistTo === 0) {
        return binding_1.default.persist_to.none;
    }
    else if (persistTo === 1) {
        return binding_1.default.persist_to.active;
    }
    else if (persistTo === 2) {
        return binding_1.default.persist_to.one;
    }
    else if (persistTo === 3) {
        return binding_1.default.persist_to.two;
    }
    else if (persistTo === 4) {
        return binding_1.default.persist_to.three;
    }
    else if (persistTo === 5) {
        return binding_1.default.persist_to.four;
    }
    throw new errs.InvalidDurabilityPersistToLevel();
}
exports.persistToToCpp = persistToToCpp;
/**
 * @internal
 */
function replicateToToCpp(replicateTo) {
    // Unspecified is allowed, and means no persistTo.
    if (replicateTo === null || replicateTo === undefined) {
        return binding_1.default.replicate_to.none;
    }
    if (replicateTo === 0) {
        return binding_1.default.replicate_to.none;
    }
    else if (replicateTo === 1) {
        return binding_1.default.replicate_to.one;
    }
    else if (replicateTo === 2) {
        return binding_1.default.replicate_to.two;
    }
    else if (replicateTo === 3) {
        return binding_1.default.replicate_to.three;
    }
    throw new errs.InvalidDurabilityReplicateToLevel();
}
exports.replicateToToCpp = replicateToToCpp;
/**
 * @internal
 */
function storeSemanticToCpp(mode) {
    if (mode === null || mode === undefined) {
        return binding_1.default.store_semantics.replace;
    }
    if (mode === generaltypes_1.StoreSemantics.Insert) {
        return binding_1.default.store_semantics.insert;
    }
    else if (mode === generaltypes_1.StoreSemantics.Upsert) {
        return binding_1.default.store_semantics.upsert;
    }
    else if (mode === generaltypes_1.StoreSemantics.Replace) {
        return binding_1.default.store_semantics.replace;
    }
    throw new errs.InvalidArgumentError();
}
exports.storeSemanticToCpp = storeSemanticToCpp;
/**
 * @internal
 */
function viewScanConsistencyToCpp(mode) {
    // Unspecified is allowed, and means no sync durability.
    if (mode === null || mode === undefined) {
        return undefined;
    }
    if (mode === viewtypes_1.ViewScanConsistency.NotBounded) {
        return binding_1.default.view_scan_consistency.not_bounded;
    }
    else if (mode === viewtypes_1.ViewScanConsistency.UpdateAfter) {
        return binding_1.default.view_scan_consistency.update_after;
    }
    else if (mode === viewtypes_1.ViewScanConsistency.RequestPlus) {
        return binding_1.default.view_scan_consistency.request_plus;
    }
    throw new errs.InvalidArgumentError();
}
exports.viewScanConsistencyToCpp = viewScanConsistencyToCpp;
/**
 * @internal
 */
function viewOrderingToCpp(ordering) {
    // Unspecified is allowed, and means default ordering.
    if (ordering === null || ordering === undefined) {
        return undefined;
    }
    if (ordering === viewtypes_1.ViewOrdering.Ascending) {
        return binding_1.default.view_sort_order.ascending;
    }
    else if (ordering === viewtypes_1.ViewOrdering.Descending) {
        return binding_1.default.view_sort_order.descending;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized view ordering.'));
}
exports.viewOrderingToCpp = viewOrderingToCpp;
/**
 * @internal
 */
function queryScanConsistencyToCpp(mode) {
    // Unspecified is allowed, and means no sync durability.
    if (mode === null || mode === undefined) {
        return undefined;
    }
    if (mode === querytypes_1.QueryScanConsistency.NotBounded) {
        return binding_1.default.query_scan_consistency.not_bounded;
    }
    else if (mode === querytypes_1.QueryScanConsistency.RequestPlus) {
        return binding_1.default.query_scan_consistency.request_plus;
    }
    throw new errs.InvalidArgumentError();
}
exports.queryScanConsistencyToCpp = queryScanConsistencyToCpp;
/**
 * @internal
 */
function queryScanConsistencyFromCpp(mode) {
    if (!mode)
        return undefined;
    if (mode === binding_1.default.query_scan_consistency.not_bounded) {
        return querytypes_1.QueryScanConsistency.NotBounded;
    }
    else if (mode === binding_1.default.query_scan_consistency.request_plus) {
        return querytypes_1.QueryScanConsistency.RequestPlus;
    }
    throw new errs.InvalidArgumentError();
}
exports.queryScanConsistencyFromCpp = queryScanConsistencyFromCpp;
/**
 * @internal
 */
function queryProfileToCpp(mode) {
    // Unspecified is allowed, and means no sync durability.
    if (mode === null || mode === undefined) {
        return binding_1.default.query_profile.off;
    }
    if (mode === querytypes_1.QueryProfileMode.Off) {
        return binding_1.default.query_profile.off;
    }
    else if (mode === querytypes_1.QueryProfileMode.Phases) {
        return binding_1.default.query_profile.phases;
    }
    else if (mode === querytypes_1.QueryProfileMode.Timings) {
        return binding_1.default.query_profile.timings;
    }
    throw new errs.InvalidArgumentError();
}
exports.queryProfileToCpp = queryProfileToCpp;
/**
 * @internal
 */
function analyticsScanConsistencyToCpp(mode) {
    // Unspecified is allowed, and means no sync durability.
    if (mode === null || mode === undefined) {
        return binding_1.default.analytics_scan_consistency.not_bounded;
    }
    if (mode === analyticstypes_1.AnalyticsScanConsistency.NotBounded) {
        return binding_1.default.analytics_scan_consistency.not_bounded;
    }
    else if (mode === analyticstypes_1.AnalyticsScanConsistency.RequestPlus) {
        return binding_1.default.analytics_scan_consistency.request_plus;
    }
    throw new errs.InvalidArgumentError();
}
exports.analyticsScanConsistencyToCpp = analyticsScanConsistencyToCpp;
/**
 * @internal
 */
function analyticsStatusFromCpp(status) {
    if (status === binding_1.default.analytics_response_analytics_status.running) {
        return analyticstypes_1.AnalyticsStatus.Running;
    }
    else if (status === binding_1.default.analytics_response_analytics_status.success) {
        return analyticstypes_1.AnalyticsStatus.Success;
    }
    else if (status === binding_1.default.analytics_response_analytics_status.errors) {
        return analyticstypes_1.AnalyticsStatus.Errors;
    }
    else if (status === binding_1.default.analytics_response_analytics_status.completed) {
        return analyticstypes_1.AnalyticsStatus.Completed;
    }
    else if (status === binding_1.default.analytics_response_analytics_status.stopped) {
        return analyticstypes_1.AnalyticsStatus.Stopped;
    }
    else if (status === binding_1.default.analytics_response_analytics_status.timedout) {
        return analyticstypes_1.AnalyticsStatus.Timeout;
    }
    else if (status === binding_1.default.analytics_response_analytics_status.closed) {
        return analyticstypes_1.AnalyticsStatus.Closed;
    }
    else if (status === binding_1.default.analytics_response_analytics_status.fatal) {
        return analyticstypes_1.AnalyticsStatus.Fatal;
    }
    else if (status === binding_1.default.analytics_response_analytics_status.aborted) {
        return analyticstypes_1.AnalyticsStatus.Aborted;
    }
    else if (status === binding_1.default.analytics_response_analytics_status.unknown) {
        return analyticstypes_1.AnalyticsStatus.Unknown;
    }
    throw new errs.InvalidArgumentError();
}
exports.analyticsStatusFromCpp = analyticsStatusFromCpp;
/**
 * @internal
 */
function searchScanConsistencyToCpp(mode) {
    // Unspecified is allowed, and means no sync durability.
    if (mode === null || mode === undefined) {
        return binding_1.default.search_scan_consistency.not_bounded;
    }
    if (mode === searchtypes_1.SearchScanConsistency.NotBounded) {
        return binding_1.default.search_scan_consistency.not_bounded;
    }
    throw new errs.InvalidArgumentError();
}
exports.searchScanConsistencyToCpp = searchScanConsistencyToCpp;
/**
 * @internal
 */
function searchHighlightStyleToCpp(mode) {
    // Unspecified is allowed, and means no sync durability.
    if (mode === null || mode === undefined) {
        return undefined;
    }
    if (mode === searchtypes_1.HighlightStyle.ANSI) {
        return binding_1.default.search_highlight_style.ansi;
    }
    else if (mode === searchtypes_1.HighlightStyle.HTML) {
        return binding_1.default.search_highlight_style.html;
    }
    throw new errs.InvalidArgumentError();
}
exports.searchHighlightStyleToCpp = searchHighlightStyleToCpp;
/**
 * @internal
 */
function mutationStateToCpp(state) {
    if (state === null || state === undefined) {
        return { tokens: [] };
    }
    const tokens = [];
    for (const bucketName in state._data) {
        for (const vbId in state._data[bucketName]) {
            const token = state._data[bucketName][vbId];
            tokens.push(token);
        }
    }
    return { tokens: tokens };
}
exports.mutationStateToCpp = mutationStateToCpp;
/**
 * @internal
 */
function serviceTypeToCpp(service) {
    if (service === generaltypes_1.ServiceType.KeyValue) {
        return binding_1.default.service_type.key_value;
    }
    else if (service === generaltypes_1.ServiceType.Query) {
        return binding_1.default.service_type.query;
    }
    else if (service === generaltypes_1.ServiceType.Analytics) {
        return binding_1.default.service_type.analytics;
    }
    else if (service === generaltypes_1.ServiceType.Search) {
        return binding_1.default.service_type.search;
    }
    else if (service === generaltypes_1.ServiceType.Views) {
        return binding_1.default.service_type.view;
    }
    else if (service === generaltypes_1.ServiceType.Management) {
        return binding_1.default.service_type.management;
    }
    else if (service === generaltypes_1.ServiceType.Eventing) {
        return binding_1.default.service_type.eventing;
    }
    throw new errs.InvalidArgumentError();
}
exports.serviceTypeToCpp = serviceTypeToCpp;
/**
 * @internal
 */
function serviceTypeFromCpp(service) {
    if (service === binding_1.default.service_type.key_value) {
        return generaltypes_1.ServiceType.KeyValue;
    }
    else if (service === binding_1.default.service_type.query) {
        return generaltypes_1.ServiceType.Query;
    }
    else if (service === binding_1.default.service_type.analytics) {
        return generaltypes_1.ServiceType.Analytics;
    }
    else if (service === binding_1.default.service_type.search) {
        return generaltypes_1.ServiceType.Search;
    }
    else if (service === binding_1.default.service_type.view) {
        return generaltypes_1.ServiceType.Views;
    }
    else if (service === binding_1.default.service_type.management) {
        return generaltypes_1.ServiceType.Management;
    }
    else if (service === binding_1.default.service_type.eventing) {
        return generaltypes_1.ServiceType.Eventing;
    }
    throw new errs.InvalidArgumentError();
}
exports.serviceTypeFromCpp = serviceTypeFromCpp;
/**
 * @internal
 */
function endpointStateFromCpp(service) {
    if (service === binding_1.default.diag_endpoint_state.disconnected) {
        return diagnosticstypes_1.EndpointState.Disconnected;
    }
    else if (service === binding_1.default.diag_endpoint_state.connecting) {
        return diagnosticstypes_1.EndpointState.Connecting;
    }
    else if (service === binding_1.default.diag_endpoint_state.connected) {
        return diagnosticstypes_1.EndpointState.Connected;
    }
    else if (service === binding_1.default.diag_endpoint_state.disconnecting) {
        return diagnosticstypes_1.EndpointState.Disconnecting;
    }
    throw new errs.InvalidArgumentError();
}
exports.endpointStateFromCpp = endpointStateFromCpp;
/**
 * @internal
 */
function txnExternalExceptionStringFromCpp(cause, message) {
    if (cause === binding_1.default.transactions_external_exception.UNKNOWN) {
        if (message) {
            return message;
        }
        return 'unknown';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception
            .ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND) {
        return 'active_transaction_record_entry_not_found';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.ACTIVE_TRANSACTION_RECORD_FULL) {
        return 'active_transaction_record_full';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.ACTIVE_TRANSACTION_RECORD_NOT_FOUND) {
        return 'active_transaction_record_not_found';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.DOCUMENT_ALREADY_IN_TRANSACTION) {
        return 'document_already_in_transaction';
    }
    else if (cause === binding_1.default.transactions_external_exception.DOCUMENT_EXISTS_EXCEPTION) {
        return 'document_exists_exception';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.DOCUMENT_NOT_FOUND_EXCEPTION) {
        return 'document_not_found_exception';
    }
    else if (cause === binding_1.default.transactions_external_exception.NOT_SET) {
        return 'not_set';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.FEATURE_NOT_AVAILABLE_EXCEPTION) {
        return 'feature_not_available_exception';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.TRANSACTION_ABORTED_EXTERNALLY) {
        return 'transaction_aborted_externally';
    }
    else if (cause === binding_1.default.transactions_external_exception.PREVIOUS_OPERATION_FAILED) {
        return 'previous_operation_failed';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.FORWARD_COMPATIBILITY_FAILURE) {
        return 'forward_compatibility_failure';
    }
    else if (cause === binding_1.default.transactions_external_exception.PARSING_FAILURE) {
        return 'parsing_failure';
    }
    else if (cause === binding_1.default.transactions_external_exception.ILLEGAL_STATE_EXCEPTION) {
        return 'illegal_state_exception';
    }
    else if (cause === binding_1.default.transactions_external_exception.COUCHBASE_EXCEPTION) {
        return 'couchbase_exception';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.SERVICE_NOT_AVAILABLE_EXCEPTION) {
        return 'service_not_available_exception';
    }
    else if (cause === binding_1.default.transactions_external_exception.REQUEST_CANCELED_EXCEPTION) {
        return 'request_canceled_exception';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception
            .CONCURRENT_OPERATIONS_DETECTED_ON_SAME_DOCUMENT) {
        return 'concurrent_operations_detected_on_same_document';
    }
    else if (cause === binding_1.default.transactions_external_exception.COMMIT_NOT_PERMITTED) {
        return 'commit_not_permitted';
    }
    else if (cause === binding_1.default.transactions_external_exception.ROLLBACK_NOT_PERMITTED) {
        return 'rollback_not_permitted';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.TRANSACTION_ALREADY_ABORTED) {
        return 'transaction_already_aborted';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.TRANSACTION_ALREADY_COMMITTED) {
        return 'transaction_already_committed';
    }
    else if (cause ===
        binding_1.default.transactions_external_exception.DOCUMENT_UNRETRIEVABLE_EXCEPTION) {
        return 'document_unretrievable_exception';
    }
    return 'unknown';
}
exports.txnExternalExceptionStringFromCpp = txnExternalExceptionStringFromCpp;
/**
 * @internal
 */
function txnOpExeptionFromCpp(err, ctx) {
    if (!err) {
        return null;
    }
    const context = ctx ? ctx : undefined;
    if (err.cause ===
        binding_1.default.transactions_external_exception.DOCUMENT_EXISTS_EXCEPTION) {
        return new errs.DocumentExistsError(new Error(txnExternalExceptionStringFromCpp(err.cause, err.message)), context);
    }
    else if (err.cause ===
        binding_1.default.transactions_external_exception.DOCUMENT_NOT_FOUND_EXCEPTION) {
        return new errs.DocumentNotFoundError(new Error(txnExternalExceptionStringFromCpp(err.cause, err.message)), context);
    }
    else if (err.cause === binding_1.default.transactions_external_exception.PARSING_FAILURE) {
        return new errs.ParsingFailureError(new Error(txnExternalExceptionStringFromCpp(err.cause, err.message)), context);
    }
    else if (err.cause === binding_1.default.transactions_external_exception.COUCHBASE_EXCEPTION) {
        const cause = txnExternalExceptionStringFromCpp(err.cause, err.message);
        return new errs.CouchbaseError(cause, new Error(cause), context);
    }
    else if (err.cause ===
        binding_1.default.transactions_external_exception.DOCUMENT_UNRETRIEVABLE_EXCEPTION) {
        return new errs.DocumentUnretrievableError(new Error(txnExternalExceptionStringFromCpp(err.cause, err.message)), context);
    }
    return err;
}
exports.txnOpExeptionFromCpp = txnOpExeptionFromCpp;
/**
 * @internal
 */
function pingStateFromCpp(service) {
    if (service === binding_1.default.diag_ping_state.ok) {
        return diagnosticstypes_1.PingState.Ok;
    }
    else if (service === binding_1.default.diag_ping_state.timeout) {
        return diagnosticstypes_1.PingState.Timeout;
    }
    else if (service === binding_1.default.diag_ping_state.error) {
        return diagnosticstypes_1.PingState.Error;
    }
    throw new errs.InvalidArgumentError();
}
exports.pingStateFromCpp = pingStateFromCpp;
/**
 * @internal
 */
function contextFromCpp(err) {
    if (!err) {
        return null;
    }
    let retry_reasons = [];
    if ('retry_reasons' in err) {
        retry_reasons = err.retry_reasons.map(retryReasonFromCpp);
    }
    let context = null;
    if (err.ctxtype === 'key_value') {
        context = new errctxs.KeyValueErrorContext({
            status_code: err.status_code,
            opaque: err.opaque,
            cas: err.cas,
            key: err.id ? err.id.key : '',
            bucket: err.id ? err.id.bucket : '',
            collection: err.id ? err.id.collection : '',
            scope: err.id ? err.id.scope : '',
            context: err.enhanced_error_info ? err.enhanced_error_info.context : '',
            ref: err.enhanced_error_info ? err.enhanced_error_info.reference : '',
            last_dispatched_from: err.last_dispatched_from
                ? err.last_dispatched_from
                : '',
            last_dispatched_to: err.last_dispatched_to ? err.last_dispatched_to : '',
            retry_attempts: err.retry_attempts ? err.retry_attempts : 0,
            retry_reasons: retry_reasons,
        });
    }
    else if (err.ctxtype === 'view') {
        context = new errctxs.ViewErrorContext({
            design_document: err.design_document_name,
            view: err.view_name,
            parameters: err.query_string,
            http_response_code: err.http_status,
            http_response_body: err.http_body,
            last_dispatched_from: err.last_dispatched_from
                ? err.last_dispatched_from
                : '',
            last_dispatched_to: err.last_dispatched_to ? err.last_dispatched_to : '',
            retry_attempts: err.retry_attempts ? err.retry_attempts : 0,
            retry_reasons: retry_reasons,
        });
    }
    else if (err.ctxtype === 'query') {
        context = new errctxs.QueryErrorContext({
            statement: err.statement,
            client_context_id: err.client_context_id,
            parameters: err.parameters,
            http_response_code: err.http_status,
            http_response_body: err.http_body,
            last_dispatched_from: err.last_dispatched_from
                ? err.last_dispatched_from
                : '',
            last_dispatched_to: err.last_dispatched_to ? err.last_dispatched_to : '',
            retry_attempts: err.retry_attempts ? err.retry_attempts : 0,
            retry_reasons: retry_reasons,
        });
    }
    else if (err.ctxtype === 'search') {
        context = new errctxs.SearchErrorContext({
            index_name: err.index_name,
            query: err.query,
            parameters: err.parameters,
            http_response_code: err.http_status,
            http_response_body: err.http_body,
            last_dispatched_from: err.last_dispatched_from
                ? err.last_dispatched_from
                : '',
            last_dispatched_to: err.last_dispatched_to ? err.last_dispatched_to : '',
            retry_attempts: err.retry_attempts ? err.retry_attempts : 0,
            retry_reasons: retry_reasons,
        });
    }
    else if (err.ctxtype === 'analytics') {
        context = new errctxs.AnalyticsErrorContext({
            statement: err.statement,
            client_context_id: err.client_context_id,
            parameters: err.parameters,
            http_response_code: err.http_status,
            http_response_body: err.http_body,
            last_dispatched_from: err.last_dispatched_from
                ? err.last_dispatched_from
                : '',
            last_dispatched_to: err.last_dispatched_to ? err.last_dispatched_to : '',
            retry_attempts: err.retry_attempts ? err.retry_attempts : 0,
            retry_reasons: retry_reasons,
        });
    }
    else if (err.ctxtype === 'http') {
        context = new errctxs.HttpErrorContext({
            method: err.method,
            request_path: err.path,
            response_code: err.http_status,
            response_body: err.http_body,
            last_dispatched_from: err.last_dispatched_from
                ? err.last_dispatched_from
                : '',
            last_dispatched_to: err.last_dispatched_to ? err.last_dispatched_to : '',
            retry_attempts: err.retry_attempts ? err.retry_attempts : 0,
            retry_reasons: retry_reasons,
        });
    }
    return context;
}
exports.contextFromCpp = contextFromCpp;
/**
 * @internal
 */
function retryReasonFromCpp(reason) {
    if (reason === binding_1.default.retry_reason.do_not_retry) {
        return 'do_not_retry';
    }
    else if (reason === binding_1.default.retry_reason.unknown) {
        return 'unknown';
    }
    else if (reason === binding_1.default.retry_reason.socket_not_available) {
        return 'socket_not_available';
    }
    else if (reason === binding_1.default.retry_reason.service_not_available) {
        return 'service_not_available';
    }
    else if (reason === binding_1.default.retry_reason.node_not_available) {
        return 'node_not_available';
    }
    else if (reason === binding_1.default.retry_reason.key_value_not_my_vbucket) {
        return 'key_value_not_my_vbucket';
    }
    else if (reason === binding_1.default.retry_reason.key_value_collection_outdated) {
        return 'key_value_collection_outdated';
    }
    else if (reason === binding_1.default.retry_reason.key_value_error_map_retry_indicated) {
        return 'key_value_error_map_retry_indicated';
    }
    else if (reason === binding_1.default.retry_reason.key_value_locked) {
        return 'key_value_locked';
    }
    else if (reason === binding_1.default.retry_reason.key_value_temporary_failure) {
        return 'key_value_temporary_failure';
    }
    else if (reason === binding_1.default.retry_reason.key_value_sync_write_in_progress) {
        return 'key_value_sync_write_in_progress';
    }
    else if (reason === binding_1.default.retry_reason.key_value_sync_write_re_commit_in_progress) {
        return 'key_value_sync_write_re_commit_in_progress';
    }
    else if (reason === binding_1.default.retry_reason.service_response_code_indicated) {
        return 'service_response_code_indicated';
    }
    else if (reason === binding_1.default.retry_reason.socket_closed_while_in_flight) {
        return 'socket_closed_while_in_flight';
    }
    else if (reason === binding_1.default.retry_reason.circuit_breaker_open) {
        return 'circuit_breaker_open';
    }
    else if (reason === binding_1.default.retry_reason.query_prepared_statement_failure) {
        return 'query_prepared_statement_failure';
    }
    else if (reason === binding_1.default.retry_reason.query_index_not_found) {
        return 'query_index_not_found';
    }
    else if (reason === binding_1.default.retry_reason.analytics_temporary_failure) {
        return 'analytics_temporary_failure';
    }
    else if (reason === binding_1.default.retry_reason.search_too_many_requests) {
        return 'search_too_many_requests';
    }
    else if (reason === binding_1.default.retry_reason.views_temporary_failure) {
        return 'views_temporary_failure';
    }
    else if (reason === binding_1.default.retry_reason.views_no_active_partition) {
        return 'views_no_active_partition';
    }
    else {
        return 'unknown';
    }
}
/**
 * @internal
 */
function errorFromCpp(err) {
    var _a;
    if (!err) {
        return null;
    }
    // BUG(JSCBC-1010): We shouldn't need to special case these.
    if (err.ctxtype === 'transaction_operation_failed') {
        const cause = txnExternalExceptionStringFromCpp(err.cause, err.message);
        if (cause == 'feature_not_available_exception') {
            const msg = 'Possibly attempting a binary transaction operation with a server version < 7.6.2';
            return new errs.TransactionOperationFailedError(new errs.FeatureNotAvailableError(new Error(msg)));
        }
        return new errs.TransactionOperationFailedError(new Error(txnExternalExceptionStringFromCpp(err.cause, err.message)));
    }
    else if (err.ctxtype === 'transaction_op_exception') {
        let txnContext = null;
        if ((_a = err.ctx) === null || _a === void 0 ? void 0 : _a.cause) {
            txnContext = contextFromCpp(err.ctx.cause);
        }
        return txnOpExeptionFromCpp(err, txnContext);
    }
    else if (err.ctxtype === 'transaction_exception') {
        if (err.type === binding_1.default.transactions_failure_type.FAIL) {
            return new errs.TransactionFailedError(new Error(txnExternalExceptionStringFromCpp(err.cause, err.message)));
        }
        else if (err.type === binding_1.default.transactions_failure_type.EXPIRY) {
            return new errs.TransactionExpiredError(new Error(txnExternalExceptionStringFromCpp(err.cause, err.message)));
        }
        else if (err.type === binding_1.default.transactions_failure_type.COMMIT_AMBIGUOUS) {
            return new errs.TransactionCommitAmbiguousError(new Error(txnExternalExceptionStringFromCpp(err.cause, err.message)));
        }
        return new errs.TransactionFailedError(new Error(txnExternalExceptionStringFromCpp(err.cause, err.message)));
    }
    const baseErr = err;
    const contextOrNull = contextFromCpp(err);
    const context = contextOrNull ? contextOrNull : undefined;
    if ('retry_reasons' in baseErr && Array.isArray(baseErr.retry_reasons)) {
        baseErr.retry_reasons = baseErr.retry_reasons.map(retryReasonFromCpp);
    }
    switch (err.code) {
        case binding_1.default.errc_common.request_canceled:
            return new errs.RequestCanceledError(baseErr, context);
        case binding_1.default.errc_common.invalid_argument:
            return new errs.InvalidArgumentError(baseErr, context);
        case binding_1.default.errc_common.service_not_available:
            return new errs.ServiceNotAvailableError(baseErr, context);
        case binding_1.default.errc_common.internal_server_failure:
            return new errs.InternalServerFailureError(baseErr, context);
        case binding_1.default.errc_common.authentication_failure:
            return new errs.AuthenticationFailureError(baseErr, context);
        case binding_1.default.errc_common.temporary_failure:
            return new errs.TemporaryFailureError(baseErr, context);
        case binding_1.default.errc_common.parsing_failure:
            return new errs.ParsingFailureError(baseErr, context);
        case binding_1.default.errc_common.cas_mismatch:
            return new errs.CasMismatchError(baseErr, context);
        case binding_1.default.errc_common.bucket_not_found:
            return new errs.BucketNotFoundError(baseErr, context);
        case binding_1.default.errc_common.collection_not_found:
            return new errs.CollectionNotFoundError(baseErr, context);
        case binding_1.default.errc_common.unsupported_operation:
            return new errs.UnsupportedOperationError(baseErr, context);
        case binding_1.default.errc_common.unambiguous_timeout:
            return new errs.UnambiguousTimeoutError(baseErr, context);
        case binding_1.default.errc_common.ambiguous_timeout:
            return new errs.AmbiguousTimeoutError(baseErr, context);
        case binding_1.default.errc_common.feature_not_available:
            return new errs.FeatureNotAvailableError(baseErr, context);
        case binding_1.default.errc_common.scope_not_found:
            return new errs.ScopeNotFoundError(baseErr, context);
        case binding_1.default.errc_common.index_not_found:
            return new errs.IndexNotFoundError(baseErr, context);
        case binding_1.default.errc_common.index_exists:
            return new errs.IndexExistsError(baseErr, context);
        case binding_1.default.errc_common.decoding_failure:
            return new errs.DecodingFailureError(baseErr, context);
        case binding_1.default.errc_common.rate_limited:
            return new errs.RateLimitedError(baseErr, context);
        case binding_1.default.errc_common.quota_limited:
            return new errs.QuotaLimitedError(baseErr, context);
        case binding_1.default.errc_key_value.document_not_found:
            return new errs.DocumentNotFoundError(baseErr, context);
        case binding_1.default.errc_key_value.document_irretrievable:
            return new errs.DocumentUnretrievableError(baseErr, context);
        case binding_1.default.errc_key_value.document_locked:
            return new errs.DocumentLockedError(baseErr, context);
        case binding_1.default.errc_key_value.document_not_locked:
            return new errs.DocumentNotLockedError(baseErr, context);
        case binding_1.default.errc_key_value.value_too_large:
            return new errs.ValueTooLargeError(baseErr, context);
        case binding_1.default.errc_key_value.document_exists:
            return new errs.DocumentExistsError(baseErr, context);
        case binding_1.default.errc_key_value.durability_level_not_available:
            return new errs.DurabilityLevelNotAvailableError(baseErr, context);
        case binding_1.default.errc_key_value.durability_impossible:
            return new errs.DurabilityImpossibleError(baseErr, context);
        case binding_1.default.errc_key_value.durability_ambiguous:
            return new errs.DurabilityAmbiguousError(baseErr, context);
        case binding_1.default.errc_key_value.durable_write_in_progress:
            return new errs.DurableWriteInProgressError(baseErr, context);
        case binding_1.default.errc_key_value.durable_write_re_commit_in_progress:
            return new errs.DurableWriteReCommitInProgressError(baseErr, context);
        case binding_1.default.errc_key_value.path_not_found:
            return new errs.PathNotFoundError(baseErr, context);
        case binding_1.default.errc_key_value.path_mismatch:
            return new errs.PathMismatchError(baseErr, context);
        case binding_1.default.errc_key_value.path_invalid:
            return new errs.PathInvalidError(baseErr, context);
        case binding_1.default.errc_key_value.path_too_big:
            return new errs.PathTooBigError(baseErr, context);
        case binding_1.default.errc_key_value.path_too_deep:
            return new errs.PathTooDeepError(baseErr, context);
        case binding_1.default.errc_key_value.value_too_deep:
            return new errs.ValueTooDeepError(baseErr, context);
        case binding_1.default.errc_key_value.value_invalid:
            return new errs.ValueInvalidError(baseErr, context);
        case binding_1.default.errc_key_value.document_not_json:
            return new errs.DocumentNotJsonError(baseErr, context);
        case binding_1.default.errc_key_value.number_too_big:
            return new errs.NumberTooBigError(baseErr, context);
        case binding_1.default.errc_key_value.delta_invalid:
            return new errs.DeltaInvalidError(baseErr, context);
        case binding_1.default.errc_key_value.path_exists:
            return new errs.PathExistsError(baseErr, context);
        case binding_1.default.errc_key_value.xattr_unknown_macro:
        case binding_1.default.errc_key_value.xattr_invalid_key_combo:
        case binding_1.default.errc_key_value.xattr_unknown_virtual_attribute:
        case binding_1.default.errc_key_value.xattr_cannot_modify_virtual_attribute:
        case binding_1.default.errc_key_value.xattr_no_access:
        case binding_1.default.errc_key_value.cannot_revive_living_document:
            // These error types are converted into generic ones instead.
            break;
        case binding_1.default.errc_query.planning_failure:
            return new errs.PlanningFailureError(baseErr, context);
        case binding_1.default.errc_query.index_failure:
            return new errs.IndexFailureError(baseErr, context);
        case binding_1.default.errc_query.prepared_statement_failure:
            return new errs.PreparedStatementFailureError(baseErr, context);
        case binding_1.default.errc_query.dml_failure:
            return new errs.DmlFailureError(baseErr, context);
        case binding_1.default.errc_analytics.compilation_failure:
            return new errs.CompilationFailureError(baseErr, context);
        case binding_1.default.errc_analytics.job_queue_full:
            return new errs.JobQueueFullError(baseErr, context);
        case binding_1.default.errc_analytics.dataset_not_found:
            return new errs.DatasetNotFoundError(baseErr, context);
        case binding_1.default.errc_analytics.dataverse_not_found:
            return new errs.DataverseNotFoundError(baseErr, context);
        case binding_1.default.errc_analytics.dataset_exists:
            return new errs.DatasetExistsError(baseErr, context);
        case binding_1.default.errc_analytics.dataverse_exists:
            return new errs.DataverseExistsError(baseErr, context);
        case binding_1.default.errc_analytics.link_not_found:
            return new errs.LinkNotFoundError(baseErr, context);
        case binding_1.default.errc_analytics.link_exists:
            return new errs.LinkExistsError(baseErr, context);
        case binding_1.default.errc_search.index_not_ready:
            return new errs.IndexNotReadyError(baseErr, context);
        case binding_1.default.errc_search.consistency_mismatch:
            // These error types are converted into generic ones instead.
            break;
        case binding_1.default.errc_view.view_not_found:
            return new errs.ViewNotFoundError(baseErr, context);
        case binding_1.default.errc_view.design_document_not_found:
            return new errs.DesignDocumentNotFoundError(baseErr, context);
        case binding_1.default.errc_management.collection_exists:
            return new errs.CollectionExistsError(baseErr, context);
        case binding_1.default.errc_management.scope_exists:
            return new errs.ScopeExistsError(baseErr, context);
        case binding_1.default.errc_management.user_not_found:
            return new errs.UserNotFoundError(baseErr, context);
        case binding_1.default.errc_management.group_not_found:
            return new errs.GroupNotFoundError(baseErr, context);
        case binding_1.default.errc_management.bucket_exists:
            return new errs.BucketExistsError(baseErr, context);
        case binding_1.default.errc_management.user_exists:
            return new errs.UserExistsError(baseErr, context);
        case binding_1.default.errc_management.bucket_not_flushable:
            return new errs.BucketNotFlushableError(baseErr, context);
        case binding_1.default.errc_management.eventing_function_not_found:
            return new errs.EventingFunctionNotFoundError(baseErr, context);
        case binding_1.default.errc_management.eventing_function_not_deployed:
            return new errs.EventingFunctionNotDeployedError(baseErr, context);
        case binding_1.default.errc_management.eventing_function_compilation_failure:
            return new errs.EventingFunctionCompilationFailureError(baseErr, context);
        case binding_1.default.errc_management.eventing_function_identical_keyspace:
            return new errs.EventingFunctionIdenticalKeyspaceError(baseErr, context);
        case binding_1.default.errc_management.eventing_function_not_bootstrapped:
            return new errs.EventingFunctionNotBootstrappedError(baseErr, context);
        case binding_1.default.errc_management.eventing_function_deployed:
            return new errs.EventingFunctionDeployedError(baseErr, context);
        case binding_1.default.errc_management.eventing_function_paused:
            return new errs.EventingFunctionPausedError(baseErr, context);
    }
    return baseErr;
}
exports.errorFromCpp = errorFromCpp;
/**
 * @internal
 */
function scanTypeToCpp(scanType) {
    var _a, _b, _c, _d;
    if (scanType instanceof rangeScan_1.RangeScan) {
        return {
            from: scanType.start !== undefined
                ? {
                    term: scanType.start.term,
                    exclusive: (_b = (_a = scanType.start) === null || _a === void 0 ? void 0 : _a.exclusive) !== null && _b !== void 0 ? _b : false,
                }
                : undefined,
            to: scanType.end !== undefined
                ? {
                    term: scanType.end.term,
                    exclusive: (_d = (_c = scanType.end) === null || _c === void 0 ? void 0 : _c.exclusive) !== null && _d !== void 0 ? _d : false,
                }
                : undefined,
        };
    }
    else if (scanType instanceof rangeScan_1.SamplingScan) {
        return {
            limit: scanType.limit,
            seed: scanType.seed,
        };
    }
    else {
        return {
            prefix: scanType.prefix,
        };
    }
}
exports.scanTypeToCpp = scanTypeToCpp;
/**
 * @internal
 */
function bucketTypeToCpp(type) {
    if (type === null || type === undefined) {
        return binding_1.default.management_cluster_bucket_type.couchbase;
    }
    if (type === bucketmanager_1.BucketType.Couchbase) {
        return binding_1.default.management_cluster_bucket_type.couchbase;
    }
    else if (type === bucketmanager_1.BucketType.Ephemeral) {
        return binding_1.default.management_cluster_bucket_type.ephemeral;
    }
    else if (type === bucketmanager_1.BucketType.Memcached) {
        return binding_1.default.management_cluster_bucket_type.memcached;
    }
    throw new errs.InvalidArgumentError();
}
exports.bucketTypeToCpp = bucketTypeToCpp;
/**
 * @internal
 */
function bucketTypeFromCpp(type) {
    if (type === binding_1.default.management_cluster_bucket_type.couchbase) {
        return bucketmanager_1.BucketType.Couchbase;
    }
    else if (type === binding_1.default.management_cluster_bucket_type.ephemeral) {
        return bucketmanager_1.BucketType.Ephemeral;
    }
    else if (type === binding_1.default.management_cluster_bucket_type.memcached) {
        return bucketmanager_1.BucketType.Memcached;
    }
    else if (type === binding_1.default.management_cluster_bucket_type.unknown) {
        return undefined;
    }
    throw new errs.InvalidArgumentError();
}
exports.bucketTypeFromCpp = bucketTypeFromCpp;
/**
 * @internal
 */
function bucketCompressionModeToCpp(mode) {
    if (mode === null || mode === undefined) {
        return binding_1.default.management_cluster_bucket_compression.unknown;
    }
    if (mode === bucketmanager_1.CompressionMode.Active) {
        return binding_1.default.management_cluster_bucket_compression.active;
    }
    else if (mode === bucketmanager_1.CompressionMode.Passive) {
        return binding_1.default.management_cluster_bucket_compression.passive;
    }
    else if (mode === bucketmanager_1.CompressionMode.Off) {
        return binding_1.default.management_cluster_bucket_compression.off;
    }
    throw new errs.InvalidArgumentError();
}
exports.bucketCompressionModeToCpp = bucketCompressionModeToCpp;
/**
 * @internal
 */
function bucketCompressionModeFromCpp(mode) {
    if (mode === binding_1.default.management_cluster_bucket_compression.active) {
        return bucketmanager_1.CompressionMode.Active;
    }
    else if (mode === binding_1.default.management_cluster_bucket_compression.passive) {
        return bucketmanager_1.CompressionMode.Passive;
    }
    else if (mode === binding_1.default.management_cluster_bucket_compression.off) {
        return bucketmanager_1.CompressionMode.Off;
    }
    else if (mode === binding_1.default.management_cluster_bucket_compression.unknown) {
        return undefined;
    }
    throw new errs.InvalidArgumentError();
}
exports.bucketCompressionModeFromCpp = bucketCompressionModeFromCpp;
/**
 * @internal
 */
function bucketEvictionPolicyToCpp(policy) {
    if (policy === null || policy === undefined) {
        return binding_1.default.management_cluster_bucket_eviction_policy.unknown;
    }
    if (policy === bucketmanager_1.EvictionPolicy.FullEviction) {
        return binding_1.default.management_cluster_bucket_eviction_policy.full;
    }
    else if (policy === bucketmanager_1.EvictionPolicy.ValueOnly) {
        return binding_1.default.management_cluster_bucket_eviction_policy.value_only;
    }
    else if (policy === bucketmanager_1.EvictionPolicy.NotRecentlyUsed) {
        return binding_1.default.management_cluster_bucket_eviction_policy.not_recently_used;
    }
    else if (policy === bucketmanager_1.EvictionPolicy.NoEviction) {
        return binding_1.default.management_cluster_bucket_eviction_policy.no_eviction;
    }
    throw new errs.InvalidArgumentError();
}
exports.bucketEvictionPolicyToCpp = bucketEvictionPolicyToCpp;
/**
 * @internal
 */
function bucketEvictionPolicyFromCpp(policy) {
    if (policy === binding_1.default.management_cluster_bucket_eviction_policy.full) {
        return bucketmanager_1.EvictionPolicy.FullEviction;
    }
    else if (policy === binding_1.default.management_cluster_bucket_eviction_policy.value_only) {
        return bucketmanager_1.EvictionPolicy.ValueOnly;
    }
    else if (policy ===
        binding_1.default.management_cluster_bucket_eviction_policy.not_recently_used) {
        return bucketmanager_1.EvictionPolicy.NotRecentlyUsed;
    }
    else if (policy === binding_1.default.management_cluster_bucket_eviction_policy.no_eviction) {
        return bucketmanager_1.EvictionPolicy.NoEviction;
    }
    else if (policy === binding_1.default.management_cluster_bucket_eviction_policy.unknown) {
        return undefined;
    }
    throw new errs.InvalidArgumentError();
}
exports.bucketEvictionPolicyFromCpp = bucketEvictionPolicyFromCpp;
/**
 * @internal
 */
function bucketStorageBackendToCpp(backend) {
    if (backend === null || backend === undefined) {
        return binding_1.default.management_cluster_bucket_storage_backend.unknown;
    }
    if (backend === bucketmanager_1.StorageBackend.Couchstore) {
        return binding_1.default.management_cluster_bucket_storage_backend.couchstore;
    }
    else if (backend === bucketmanager_1.StorageBackend.Magma) {
        return binding_1.default.management_cluster_bucket_storage_backend.magma;
    }
    throw new errs.InvalidArgumentError();
}
exports.bucketStorageBackendToCpp = bucketStorageBackendToCpp;
/**
 * @internal
 */
function bucketStorageBackendFromCpp(backend) {
    if (backend === binding_1.default.management_cluster_bucket_storage_backend.couchstore) {
        return bucketmanager_1.StorageBackend.Couchstore;
    }
    else if (backend === binding_1.default.management_cluster_bucket_storage_backend.magma) {
        return bucketmanager_1.StorageBackend.Magma;
    }
    else if (backend === binding_1.default.management_cluster_bucket_storage_backend.unknown) {
        return undefined;
    }
    throw new errs.InvalidArgumentError();
}
exports.bucketStorageBackendFromCpp = bucketStorageBackendFromCpp;
/**
 * @internal
 */
function bucketConflictResolutionTypeToCpp(type) {
    if (type === null || type === undefined) {
        return binding_1.default.management_cluster_bucket_conflict_resolution.unknown;
    }
    if (type === bucketmanager_1.ConflictResolutionType.SequenceNumber) {
        return binding_1.default.management_cluster_bucket_conflict_resolution.sequence_number;
    }
    else if (type === bucketmanager_1.ConflictResolutionType.Timestamp) {
        return binding_1.default.management_cluster_bucket_conflict_resolution.timestamp;
    }
    else if (type === bucketmanager_1.ConflictResolutionType.Custom) {
        return binding_1.default.management_cluster_bucket_conflict_resolution.custom;
    }
    throw new errs.InvalidArgumentError();
}
exports.bucketConflictResolutionTypeToCpp = bucketConflictResolutionTypeToCpp;
/**
 * @internal
 */
function bucketConflictResolutionTypeFromCpp(type) {
    if (type ===
        binding_1.default.management_cluster_bucket_conflict_resolution.sequence_number) {
        return bucketmanager_1.ConflictResolutionType.SequenceNumber;
    }
    else if (type === binding_1.default.management_cluster_bucket_conflict_resolution.timestamp) {
        return bucketmanager_1.ConflictResolutionType.Timestamp;
    }
    else if (type === binding_1.default.management_cluster_bucket_conflict_resolution.custom) {
        return bucketmanager_1.ConflictResolutionType.Custom;
    }
    else if (type === binding_1.default.management_cluster_bucket_conflict_resolution.unknown) {
        return undefined;
    }
    throw new errs.InvalidArgumentError();
}
exports.bucketConflictResolutionTypeFromCpp = bucketConflictResolutionTypeFromCpp;
/**
 * @internal
 */
function vectorQueryCombinationToCpp(combination) {
    if (combination === vectorsearch_1.VectorQueryCombination.AND) {
        return binding_1.default.vector_query_combination.combination_and;
    }
    else if (combination === vectorsearch_1.VectorQueryCombination.OR) {
        return binding_1.default.vector_query_combination.combination_or;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized VectorQueryCombination.'));
}
exports.vectorQueryCombinationToCpp = vectorQueryCombinationToCpp;
/**
 * @internal
 */
function designDocumentNamespaceFromCpp(namespace) {
    if (namespace === binding_1.default.design_document_namespace.production) {
        return viewtypes_1.DesignDocumentNamespace.Production;
    }
    else if (namespace === binding_1.default.design_document_namespace.development) {
        return viewtypes_1.DesignDocumentNamespace.Development;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized DesignDocumentNamespace.'));
}
exports.designDocumentNamespaceFromCpp = designDocumentNamespaceFromCpp;
/**
 * @internal
 */
function designDocumentNamespaceToCpp(namespace) {
    if (namespace === viewtypes_1.DesignDocumentNamespace.Production) {
        return binding_1.default.design_document_namespace.production;
    }
    else if (namespace === viewtypes_1.DesignDocumentNamespace.Development) {
        return binding_1.default.design_document_namespace.development;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized DesignDocumentNamespace.'));
}
exports.designDocumentNamespaceToCpp = designDocumentNamespaceToCpp;
/**
 * @internal
 */
function transactionKeyspaceToCpp(keyspace) {
    var _a, _b;
    if (!keyspace)
        return undefined;
    return {
        bucket_name: keyspace.bucket,
        scope_name: (_a = keyspace.scope) !== null && _a !== void 0 ? _a : '_default',
        collection_name: (_b = keyspace.collection) !== null && _b !== void 0 ? _b : '_default',
    };
}
exports.transactionKeyspaceToCpp = transactionKeyspaceToCpp;
/**
 * @internal
 */
function eventingBucketBindingAccessToCpp(access) {
    if (access === eventingfunctionmanager_1.EventingFunctionBucketAccess.ReadOnly) {
        return binding_1.default.management_eventing_function_bucket_access.read_only;
    }
    if (access === eventingfunctionmanager_1.EventingFunctionBucketAccess.ReadWrite) {
        return binding_1.default.management_eventing_function_bucket_access.read_write;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionBucketAccess'));
}
exports.eventingBucketBindingAccessToCpp = eventingBucketBindingAccessToCpp;
/**
 * @internal
 */
function eventingBucketBindingAccessFromCpp(access) {
    if (access === binding_1.default.management_eventing_function_bucket_access.read_only) {
        return eventingfunctionmanager_1.EventingFunctionBucketAccess.ReadOnly;
    }
    if (access === binding_1.default.management_eventing_function_bucket_access.read_write) {
        return eventingfunctionmanager_1.EventingFunctionBucketAccess.ReadWrite;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionBucketAccess'));
}
exports.eventingBucketBindingAccessFromCpp = eventingBucketBindingAccessFromCpp;
/**
 * @internal
 */
function eventingFunctionDcpBoundaryToCpp(boundary) {
    if (!boundary)
        return undefined;
    if (boundary === eventingfunctionmanager_1.EventingFunctionDcpBoundary.Everything) {
        return binding_1.default.management_eventing_function_dcp_boundary.everything;
    }
    if (boundary === eventingfunctionmanager_1.EventingFunctionDcpBoundary.FromNow) {
        return binding_1.default.management_eventing_function_dcp_boundary.from_now;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionDcpBoundary'));
}
exports.eventingFunctionDcpBoundaryToCpp = eventingFunctionDcpBoundaryToCpp;
/**
 * @internal
 */
function eventingFunctionDcpBoundaryFromCpp(boundary) {
    if (!boundary)
        return undefined;
    if (boundary === binding_1.default.management_eventing_function_dcp_boundary.everything) {
        return eventingfunctionmanager_1.EventingFunctionDcpBoundary.Everything;
    }
    if (boundary === binding_1.default.management_eventing_function_dcp_boundary.from_now) {
        return eventingfunctionmanager_1.EventingFunctionDcpBoundary.FromNow;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionDcpBoundary'));
}
exports.eventingFunctionDcpBoundaryFromCpp = eventingFunctionDcpBoundaryFromCpp;
/**
 * @internal
 */
function eventingFunctionDeploymentStatusToCpp(status) {
    if (!status)
        return undefined;
    if (status === eventingfunctionmanager_1.EventingFunctionDeploymentStatus.Deployed) {
        return binding_1.default.management_eventing_function_deployment_status.deployed;
    }
    if (status === eventingfunctionmanager_1.EventingFunctionDeploymentStatus.Undeployed) {
        return binding_1.default.management_eventing_function_deployment_status.undeployed;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionDeploymentStatus'));
}
exports.eventingFunctionDeploymentStatusToCpp = eventingFunctionDeploymentStatusToCpp;
/**
 * @internal
 */
function eventingFunctionDeploymentStatusFromCpp(status) {
    if (!status)
        return undefined;
    if (status === binding_1.default.management_eventing_function_deployment_status.deployed) {
        return eventingfunctionmanager_1.EventingFunctionDeploymentStatus.Deployed;
    }
    if (status === binding_1.default.management_eventing_function_deployment_status.undeployed) {
        return eventingfunctionmanager_1.EventingFunctionDeploymentStatus.Undeployed;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionDeploymentStatus'));
}
exports.eventingFunctionDeploymentStatusFromCpp = eventingFunctionDeploymentStatusFromCpp;
/**
 * @internal
 */
function eventingFunctionProcessingStatusToCpp(status) {
    if (!status)
        return undefined;
    if (status === eventingfunctionmanager_1.EventingFunctionProcessingStatus.Running) {
        return binding_1.default.management_eventing_function_processing_status.running;
    }
    if (status === eventingfunctionmanager_1.EventingFunctionProcessingStatus.Paused) {
        return binding_1.default.management_eventing_function_processing_status.paused;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionProcessingStatus'));
}
exports.eventingFunctionProcessingStatusToCpp = eventingFunctionProcessingStatusToCpp;
/**
 * @internal
 */
function eventingFunctionProcessingStatusFromCpp(status) {
    if (!status)
        return undefined;
    if (status === binding_1.default.management_eventing_function_processing_status.running) {
        return eventingfunctionmanager_1.EventingFunctionProcessingStatus.Running;
    }
    if (status === binding_1.default.management_eventing_function_processing_status.paused) {
        return eventingfunctionmanager_1.EventingFunctionProcessingStatus.Paused;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionProcessingStatus'));
}
exports.eventingFunctionProcessingStatusFromCpp = eventingFunctionProcessingStatusFromCpp;
/**
 * @internal
 */
function eventingFunctionLogLevelToCpp(level) {
    if (!level)
        return undefined;
    if (level === eventingfunctionmanager_1.EventingFunctionLogLevel.Debug) {
        return binding_1.default.management_eventing_function_log_level.debug;
    }
    if (level === eventingfunctionmanager_1.EventingFunctionLogLevel.Error) {
        return binding_1.default.management_eventing_function_log_level.error;
    }
    if (level === eventingfunctionmanager_1.EventingFunctionLogLevel.Info) {
        return binding_1.default.management_eventing_function_log_level.info;
    }
    if (level === eventingfunctionmanager_1.EventingFunctionLogLevel.Trace) {
        return binding_1.default.management_eventing_function_log_level.trace;
    }
    if (level === eventingfunctionmanager_1.EventingFunctionLogLevel.Warning) {
        return binding_1.default.management_eventing_function_log_level.warning;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionLogLevel'));
}
exports.eventingFunctionLogLevelToCpp = eventingFunctionLogLevelToCpp;
/**
 * @internal
 */
function eventingFunctionLogLevelFromCpp(level) {
    if (!level)
        return undefined;
    if (level === binding_1.default.management_eventing_function_log_level.debug) {
        return eventingfunctionmanager_1.EventingFunctionLogLevel.Debug;
    }
    if (level === binding_1.default.management_eventing_function_log_level.error) {
        return eventingfunctionmanager_1.EventingFunctionLogLevel.Error;
    }
    if (level === binding_1.default.management_eventing_function_log_level.info) {
        return eventingfunctionmanager_1.EventingFunctionLogLevel.Info;
    }
    if (level === binding_1.default.management_eventing_function_log_level.trace) {
        return eventingfunctionmanager_1.EventingFunctionLogLevel.Trace;
    }
    if (level === binding_1.default.management_eventing_function_log_level.warning) {
        return eventingfunctionmanager_1.EventingFunctionLogLevel.Warning;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionLogLevel'));
}
exports.eventingFunctionLogLevelFromCpp = eventingFunctionLogLevelFromCpp;
/**
 * @internal
 */
function eventingFunctionLanguageCompatibilityToCpp(compatibility) {
    if (!compatibility)
        return undefined;
    if (compatibility === eventingfunctionmanager_1.EventingFunctionLanguageCompatibility.Version_6_0_0) {
        return binding_1.default.management_eventing_function_language_compatibility
            .version_6_0_0;
    }
    if (compatibility === eventingfunctionmanager_1.EventingFunctionLanguageCompatibility.Version_6_5_0) {
        return binding_1.default.management_eventing_function_language_compatibility
            .version_6_5_0;
    }
    if (compatibility === eventingfunctionmanager_1.EventingFunctionLanguageCompatibility.Version_6_6_2) {
        return binding_1.default.management_eventing_function_language_compatibility
            .version_6_6_2;
    }
    if (compatibility === eventingfunctionmanager_1.EventingFunctionLanguageCompatibility.Version_7_2_0) {
        return binding_1.default.management_eventing_function_language_compatibility
            .version_7_2_0;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionLanguageCompatibility'));
}
exports.eventingFunctionLanguageCompatibilityToCpp = eventingFunctionLanguageCompatibilityToCpp;
/**
 * @internal
 */
function eventingFunctionLanguageCompatibilityFromCpp(compatibility) {
    if (!compatibility)
        return undefined;
    if (compatibility ===
        binding_1.default.management_eventing_function_language_compatibility.version_6_0_0) {
        return eventingfunctionmanager_1.EventingFunctionLanguageCompatibility.Version_6_0_0;
    }
    if (compatibility ===
        binding_1.default.management_eventing_function_language_compatibility.version_6_5_0) {
        return eventingfunctionmanager_1.EventingFunctionLanguageCompatibility.Version_6_5_0;
    }
    if (compatibility ===
        binding_1.default.management_eventing_function_language_compatibility.version_6_6_2) {
        return eventingfunctionmanager_1.EventingFunctionLanguageCompatibility.Version_6_6_2;
    }
    if (compatibility ===
        binding_1.default.management_eventing_function_language_compatibility.version_7_2_0) {
        return eventingfunctionmanager_1.EventingFunctionLanguageCompatibility.Version_7_2_0;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionLanguageCompatibility'));
}
exports.eventingFunctionLanguageCompatibilityFromCpp = eventingFunctionLanguageCompatibilityFromCpp;
/**
 * @internal
 */
function eventingFunctionStatusFromCpp(status) {
    if (status === binding_1.default.management_eventing_function_status.undeployed) {
        return eventingfunctionmanager_1.EventingFunctionStatus.Undeployed;
    }
    if (status === binding_1.default.management_eventing_function_status.deploying) {
        return eventingfunctionmanager_1.EventingFunctionStatus.Deploying;
    }
    if (status === binding_1.default.management_eventing_function_status.deployed) {
        return eventingfunctionmanager_1.EventingFunctionStatus.Deployed;
    }
    if (status === binding_1.default.management_eventing_function_status.undeploying) {
        return eventingfunctionmanager_1.EventingFunctionStatus.Undeploying;
    }
    if (status === binding_1.default.management_eventing_function_status.paused) {
        return eventingfunctionmanager_1.EventingFunctionStatus.Paused;
    }
    if (status === binding_1.default.management_eventing_function_status.pausing) {
        return eventingfunctionmanager_1.EventingFunctionStatus.Pausing;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized EventingFunctionStatus'));
}
exports.eventingFunctionStatusFromCpp = eventingFunctionStatusFromCpp;
/**
 * @internal
 */
function couchbaseLinkEncryptionLevelFromCpp(level) {
    if (level === binding_1.default.management_analytics_couchbase_link_encryption_level.none) {
        return analyticsindexmanager_1.AnalyticsEncryptionLevel.None;
    }
    if (level === binding_1.default.management_analytics_couchbase_link_encryption_level.half) {
        return analyticsindexmanager_1.AnalyticsEncryptionLevel.Half;
    }
    if (level === binding_1.default.management_analytics_couchbase_link_encryption_level.full) {
        return analyticsindexmanager_1.AnalyticsEncryptionLevel.Full;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized CppManagementAnalyticsCouchbaseLinkEncryptionLevel'));
}
exports.couchbaseLinkEncryptionLevelFromCpp = couchbaseLinkEncryptionLevelFromCpp;
/**
 * @internal
 */
function encryptionLevelToCpp(level) {
    if (level === analyticsindexmanager_1.AnalyticsEncryptionLevel.None) {
        return binding_1.default.management_analytics_couchbase_link_encryption_level.none;
    }
    if (level === analyticsindexmanager_1.AnalyticsEncryptionLevel.Half) {
        return binding_1.default.management_analytics_couchbase_link_encryption_level.half;
    }
    if (level === analyticsindexmanager_1.AnalyticsEncryptionLevel.Full) {
        return binding_1.default.management_analytics_couchbase_link_encryption_level.full;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized AnalyticsEncryptionLevel'));
}
exports.encryptionLevelToCpp = encryptionLevelToCpp;
/**
 * @internal
 */
function encryptionSettingsToCpp(settings) {
    if (!settings) {
        return {
            level: binding_1.default.management_analytics_couchbase_link_encryption_level.none,
        };
    }
    return {
        level: encryptionLevelToCpp(settings.encryptionLevel),
        certificate: settings.certificate
            ? settings.certificate.toString()
            : undefined,
        client_certificate: settings.clientCertificate
            ? settings.clientCertificate.toString()
            : undefined,
        client_key: settings.clientKey ? settings.clientKey.toString() : undefined,
    };
}
exports.encryptionSettingsToCpp = encryptionSettingsToCpp;
/**
 * @internal
 */
function encryptionSettingsFromCpp(settings) {
    return new analyticsindexmanager_1.CouchbaseAnalyticsEncryptionSettings({
        encryptionLevel: couchbaseLinkEncryptionLevelFromCpp(settings.level),
        certificate: settings.certificate
            ? Buffer.from(settings.certificate)
            : undefined,
        clientCertificate: settings.client_certificate
            ? Buffer.from(settings.client_certificate)
            : undefined,
        clientKey: undefined,
    });
}
exports.encryptionSettingsFromCpp = encryptionSettingsFromCpp;
/**
 * @internal
 */
function authDomainToCpp(domain) {
    if (domain === 'unknown') {
        return binding_1.default.management_rbac_auth_domain.unknown;
    }
    if (domain === 'local') {
        return binding_1.default.management_rbac_auth_domain.local;
    }
    if (domain === 'external') {
        return binding_1.default.management_rbac_auth_domain.external;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized auth domain.'));
}
exports.authDomainToCpp = authDomainToCpp;
/**
 * @internal
 */
function authDomainFromCpp(domain) {
    if (domain === binding_1.default.management_rbac_auth_domain.unknown) {
        return 'unknown';
    }
    if (domain === binding_1.default.management_rbac_auth_domain.local) {
        return 'local';
    }
    if (domain === binding_1.default.management_rbac_auth_domain.external) {
        return 'external';
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized CppManagementRbacAuthDomain.'));
}
exports.authDomainFromCpp = authDomainFromCpp;
/**
 * @internal
 */
function readPreferenceToCpp(preference) {
    // Unspecified is allowed, and means no preference.
    if (preference === null || preference === undefined) {
        return binding_1.default.read_preference.no_preference;
    }
    if (preference === generaltypes_1.ReadPreference.NoPreference) {
        return binding_1.default.read_preference.no_preference;
    }
    else if (preference === generaltypes_1.ReadPreference.SelectedServerGroup) {
        return binding_1.default.read_preference.selected_server_group;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized ReadPreference.'));
}
exports.readPreferenceToCpp = readPreferenceToCpp;
/**
 * @internal
 */
function transactionGetMultiModeToCpp(mode) {
    if (mode === null || mode === undefined) {
        return undefined;
    }
    if (mode === transactions_1.TransactionGetMultiMode.PrioritiseLatency) {
        return binding_1.default.transactions_transaction_get_multi_mode.prioritise_latency;
    }
    else if (mode === transactions_1.TransactionGetMultiMode.DisableReadSkewDetection) {
        return binding_1.default.transactions_transaction_get_multi_mode
            .disable_read_skew_detection;
    }
    else if (mode === transactions_1.TransactionGetMultiMode.PrioritiseReadSkewDetection) {
        return binding_1.default.transactions_transaction_get_multi_mode
            .prioritise_read_skew_detection;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized TransactionGetMultiMode.'));
}
exports.transactionGetMultiModeToCpp = transactionGetMultiModeToCpp;
/**
 * @internal
 */
function transactionGetMultiReplicasFromPreferredServerGroupModeToCpp(mode) {
    if (mode === null || mode === undefined) {
        return undefined;
    }
    if (mode ===
        transactions_1.TransactionGetMultiReplicasFromPreferredServerGroupMode.PrioritiseLatency) {
        return binding_1.default
            .transactions_transaction_get_multi_replicas_from_preferred_server_group_mode
            .prioritise_latency;
    }
    else if (mode ===
        transactions_1.TransactionGetMultiReplicasFromPreferredServerGroupMode.DisableReadSkewDetection) {
        return binding_1.default
            .transactions_transaction_get_multi_replicas_from_preferred_server_group_mode
            .disable_read_skew_detection;
    }
    else if (mode ===
        transactions_1.TransactionGetMultiReplicasFromPreferredServerGroupMode.PrioritiseReadSkewDetection) {
        return binding_1.default
            .transactions_transaction_get_multi_replicas_from_preferred_server_group_mode
            .prioritise_read_skew_detection;
    }
    throw new errs.InvalidArgumentError(new Error('Unrecognized TransactionGetMultiReplicasFromPreferredServerGroupMode.'));
}
exports.transactionGetMultiReplicasFromPreferredServerGroupModeToCpp = transactionGetMultiReplicasFromPreferredServerGroupModeToCpp;
