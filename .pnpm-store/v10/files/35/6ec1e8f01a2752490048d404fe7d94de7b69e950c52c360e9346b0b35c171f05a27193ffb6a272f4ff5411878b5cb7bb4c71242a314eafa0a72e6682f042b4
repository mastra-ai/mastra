'use strict';

var accountIdEndpoint = require('@aws-sdk/core/account-id-endpoint');
var middlewareEndpointDiscovery = require('@aws-sdk/middleware-endpoint-discovery');
var middlewareHostHeader = require('@aws-sdk/middleware-host-header');
var middlewareLogger = require('@aws-sdk/middleware-logger');
var middlewareRecursionDetection = require('@aws-sdk/middleware-recursion-detection');
var middlewareUserAgent = require('@aws-sdk/middleware-user-agent');
var configResolver = require('@smithy/config-resolver');
var core$1 = require('@smithy/core');
var middlewareContentLength = require('@smithy/middleware-content-length');
var middlewareEndpoint = require('@smithy/middleware-endpoint');
var middlewareRetry = require('@smithy/middleware-retry');
var smithyClient = require('@smithy/smithy-client');
var httpAuthSchemeProvider = require('./auth/httpAuthSchemeProvider');
var middlewareSerde = require('@smithy/middleware-serde');
var core = require('@aws-sdk/core');
var protocolHttp = require('@smithy/protocol-http');
var uuid = require('@smithy/uuid');
var runtimeConfig = require('./runtimeConfig');
var regionConfigResolver = require('@aws-sdk/region-config-resolver');
var utilWaiter = require('@smithy/util-waiter');

const resolveClientEndpointParameters = (options) => {
    return Object.assign(options, {
        useDualstackEndpoint: options.useDualstackEndpoint ?? false,
        useFipsEndpoint: options.useFipsEndpoint ?? false,
        defaultSigningName: "dynamodb",
    });
};
const commonParams = {
    UseFIPS: { type: "builtInParams", name: "useFipsEndpoint" },
    AccountId: { type: "builtInParams", name: "accountId" },
    Endpoint: { type: "builtInParams", name: "endpoint" },
    Region: { type: "builtInParams", name: "region" },
    UseDualStack: { type: "builtInParams", name: "useDualstackEndpoint" },
    AccountIdEndpointMode: { type: "builtInParams", name: "accountIdEndpointMode" },
};

class DynamoDBServiceException extends smithyClient.ServiceException {
    constructor(options) {
        super(options);
        Object.setPrototypeOf(this, DynamoDBServiceException.prototype);
    }
}

const ApproximateCreationDateTimePrecision = {
    MICROSECOND: "MICROSECOND",
    MILLISECOND: "MILLISECOND",
};
const AttributeAction = {
    ADD: "ADD",
    DELETE: "DELETE",
    PUT: "PUT",
};
const ScalarAttributeType = {
    B: "B",
    N: "N",
    S: "S",
};
const BackupStatus = {
    AVAILABLE: "AVAILABLE",
    CREATING: "CREATING",
    DELETED: "DELETED",
};
const BackupType = {
    AWS_BACKUP: "AWS_BACKUP",
    SYSTEM: "SYSTEM",
    USER: "USER",
};
const BillingMode = {
    PAY_PER_REQUEST: "PAY_PER_REQUEST",
    PROVISIONED: "PROVISIONED",
};
const KeyType = {
    HASH: "HASH",
    RANGE: "RANGE",
};
const ProjectionType = {
    ALL: "ALL",
    INCLUDE: "INCLUDE",
    KEYS_ONLY: "KEYS_ONLY",
};
const SSEType = {
    AES256: "AES256",
    KMS: "KMS",
};
const SSEStatus = {
    DISABLED: "DISABLED",
    DISABLING: "DISABLING",
    ENABLED: "ENABLED",
    ENABLING: "ENABLING",
    UPDATING: "UPDATING",
};
const StreamViewType = {
    KEYS_ONLY: "KEYS_ONLY",
    NEW_AND_OLD_IMAGES: "NEW_AND_OLD_IMAGES",
    NEW_IMAGE: "NEW_IMAGE",
    OLD_IMAGE: "OLD_IMAGE",
};
const TimeToLiveStatus = {
    DISABLED: "DISABLED",
    DISABLING: "DISABLING",
    ENABLED: "ENABLED",
    ENABLING: "ENABLING",
};
class BackupInUseException extends DynamoDBServiceException {
    name = "BackupInUseException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "BackupInUseException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, BackupInUseException.prototype);
    }
}
class BackupNotFoundException extends DynamoDBServiceException {
    name = "BackupNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "BackupNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, BackupNotFoundException.prototype);
    }
}
const BackupTypeFilter = {
    ALL: "ALL",
    AWS_BACKUP: "AWS_BACKUP",
    SYSTEM: "SYSTEM",
    USER: "USER",
};
const ReturnConsumedCapacity = {
    INDEXES: "INDEXES",
    NONE: "NONE",
    TOTAL: "TOTAL",
};
const ReturnValuesOnConditionCheckFailure = {
    ALL_OLD: "ALL_OLD",
    NONE: "NONE",
};
const BatchStatementErrorCodeEnum = {
    AccessDenied: "AccessDenied",
    ConditionalCheckFailed: "ConditionalCheckFailed",
    DuplicateItem: "DuplicateItem",
    InternalServerError: "InternalServerError",
    ItemCollectionSizeLimitExceeded: "ItemCollectionSizeLimitExceeded",
    ProvisionedThroughputExceeded: "ProvisionedThroughputExceeded",
    RequestLimitExceeded: "RequestLimitExceeded",
    ResourceNotFound: "ResourceNotFound",
    ThrottlingError: "ThrottlingError",
    TransactionConflict: "TransactionConflict",
    ValidationError: "ValidationError",
};
class InternalServerError extends DynamoDBServiceException {
    name = "InternalServerError";
    $fault = "server";
    constructor(opts) {
        super({
            name: "InternalServerError",
            $fault: "server",
            ...opts,
        });
        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
}
class RequestLimitExceeded extends DynamoDBServiceException {
    name = "RequestLimitExceeded";
    $fault = "client";
    ThrottlingReasons;
    constructor(opts) {
        super({
            name: "RequestLimitExceeded",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, RequestLimitExceeded.prototype);
        this.ThrottlingReasons = opts.ThrottlingReasons;
    }
}
class ThrottlingException extends DynamoDBServiceException {
    name = "ThrottlingException";
    $fault = "client";
    throttlingReasons;
    constructor(opts) {
        super({
            name: "ThrottlingException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ThrottlingException.prototype);
        this.throttlingReasons = opts.throttlingReasons;
    }
}
class InvalidEndpointException extends DynamoDBServiceException {
    name = "InvalidEndpointException";
    $fault = "client";
    Message;
    constructor(opts) {
        super({
            name: "InvalidEndpointException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidEndpointException.prototype);
        this.Message = opts.Message;
    }
}
class ProvisionedThroughputExceededException extends DynamoDBServiceException {
    name = "ProvisionedThroughputExceededException";
    $fault = "client";
    ThrottlingReasons;
    constructor(opts) {
        super({
            name: "ProvisionedThroughputExceededException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ProvisionedThroughputExceededException.prototype);
        this.ThrottlingReasons = opts.ThrottlingReasons;
    }
}
class ResourceNotFoundException extends DynamoDBServiceException {
    name = "ResourceNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ResourceNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ResourceNotFoundException.prototype);
    }
}
const ReturnItemCollectionMetrics = {
    NONE: "NONE",
    SIZE: "SIZE",
};
class ItemCollectionSizeLimitExceededException extends DynamoDBServiceException {
    name = "ItemCollectionSizeLimitExceededException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ItemCollectionSizeLimitExceededException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ItemCollectionSizeLimitExceededException.prototype);
    }
}
class ReplicatedWriteConflictException extends DynamoDBServiceException {
    name = "ReplicatedWriteConflictException";
    $fault = "client";
    $retryable = {};
    constructor(opts) {
        super({
            name: "ReplicatedWriteConflictException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ReplicatedWriteConflictException.prototype);
    }
}
const ComparisonOperator = {
    BEGINS_WITH: "BEGINS_WITH",
    BETWEEN: "BETWEEN",
    CONTAINS: "CONTAINS",
    EQ: "EQ",
    GE: "GE",
    GT: "GT",
    IN: "IN",
    LE: "LE",
    LT: "LT",
    NE: "NE",
    NOT_CONTAINS: "NOT_CONTAINS",
    NOT_NULL: "NOT_NULL",
    NULL: "NULL",
};
const ConditionalOperator = {
    AND: "AND",
    OR: "OR",
};
const ContinuousBackupsStatus = {
    DISABLED: "DISABLED",
    ENABLED: "ENABLED",
};
const PointInTimeRecoveryStatus = {
    DISABLED: "DISABLED",
    ENABLED: "ENABLED",
};
class ContinuousBackupsUnavailableException extends DynamoDBServiceException {
    name = "ContinuousBackupsUnavailableException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ContinuousBackupsUnavailableException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ContinuousBackupsUnavailableException.prototype);
    }
}
const ContributorInsightsAction = {
    DISABLE: "DISABLE",
    ENABLE: "ENABLE",
};
const ContributorInsightsMode = {
    ACCESSED_AND_THROTTLED_KEYS: "ACCESSED_AND_THROTTLED_KEYS",
    THROTTLED_KEYS: "THROTTLED_KEYS",
};
const ContributorInsightsStatus = {
    DISABLED: "DISABLED",
    DISABLING: "DISABLING",
    ENABLED: "ENABLED",
    ENABLING: "ENABLING",
    FAILED: "FAILED",
};
class LimitExceededException extends DynamoDBServiceException {
    name = "LimitExceededException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "LimitExceededException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, LimitExceededException.prototype);
    }
}
class TableInUseException extends DynamoDBServiceException {
    name = "TableInUseException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "TableInUseException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TableInUseException.prototype);
    }
}
class TableNotFoundException extends DynamoDBServiceException {
    name = "TableNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "TableNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TableNotFoundException.prototype);
    }
}
const GlobalTableStatus = {
    ACTIVE: "ACTIVE",
    CREATING: "CREATING",
    DELETING: "DELETING",
    UPDATING: "UPDATING",
};
const IndexStatus = {
    ACTIVE: "ACTIVE",
    CREATING: "CREATING",
    DELETING: "DELETING",
    UPDATING: "UPDATING",
};
const ReplicaStatus = {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    ARCHIVING: "ARCHIVING",
    CREATING: "CREATING",
    CREATION_FAILED: "CREATION_FAILED",
    DELETING: "DELETING",
    INACCESSIBLE_ENCRYPTION_CREDENTIALS: "INACCESSIBLE_ENCRYPTION_CREDENTIALS",
    REGION_DISABLED: "REGION_DISABLED",
    REPLICATION_NOT_AUTHORIZED: "REPLICATION_NOT_AUTHORIZED",
    UPDATING: "UPDATING",
};
const TableClass = {
    STANDARD: "STANDARD",
    STANDARD_INFREQUENT_ACCESS: "STANDARD_INFREQUENT_ACCESS",
};
const TableStatus = {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    ARCHIVING: "ARCHIVING",
    CREATING: "CREATING",
    DELETING: "DELETING",
    INACCESSIBLE_ENCRYPTION_CREDENTIALS: "INACCESSIBLE_ENCRYPTION_CREDENTIALS",
    REPLICATION_NOT_AUTHORIZED: "REPLICATION_NOT_AUTHORIZED",
    UPDATING: "UPDATING",
};
class GlobalTableAlreadyExistsException extends DynamoDBServiceException {
    name = "GlobalTableAlreadyExistsException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "GlobalTableAlreadyExistsException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, GlobalTableAlreadyExistsException.prototype);
    }
}
const WitnessStatus = {
    ACTIVE: "ACTIVE",
    CREATING: "CREATING",
    DELETING: "DELETING",
};
const MultiRegionConsistency = {
    EVENTUAL: "EVENTUAL",
    STRONG: "STRONG",
};
class ResourceInUseException extends DynamoDBServiceException {
    name = "ResourceInUseException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ResourceInUseException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ResourceInUseException.prototype);
    }
}
const ReturnValue = {
    ALL_NEW: "ALL_NEW",
    ALL_OLD: "ALL_OLD",
    NONE: "NONE",
    UPDATED_NEW: "UPDATED_NEW",
    UPDATED_OLD: "UPDATED_OLD",
};
class TransactionConflictException extends DynamoDBServiceException {
    name = "TransactionConflictException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "TransactionConflictException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TransactionConflictException.prototype);
    }
}
class PolicyNotFoundException extends DynamoDBServiceException {
    name = "PolicyNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "PolicyNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, PolicyNotFoundException.prototype);
    }
}
const ExportFormat = {
    DYNAMODB_JSON: "DYNAMODB_JSON",
    ION: "ION",
};
const ExportStatus = {
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    IN_PROGRESS: "IN_PROGRESS",
};
const ExportType = {
    FULL_EXPORT: "FULL_EXPORT",
    INCREMENTAL_EXPORT: "INCREMENTAL_EXPORT",
};
const ExportViewType = {
    NEW_AND_OLD_IMAGES: "NEW_AND_OLD_IMAGES",
    NEW_IMAGE: "NEW_IMAGE",
};
const S3SseAlgorithm = {
    AES256: "AES256",
    KMS: "KMS",
};
class ExportNotFoundException extends DynamoDBServiceException {
    name = "ExportNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ExportNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ExportNotFoundException.prototype);
    }
}
class GlobalTableNotFoundException extends DynamoDBServiceException {
    name = "GlobalTableNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "GlobalTableNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, GlobalTableNotFoundException.prototype);
    }
}
const ImportStatus = {
    CANCELLED: "CANCELLED",
    CANCELLING: "CANCELLING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    IN_PROGRESS: "IN_PROGRESS",
};
const InputCompressionType = {
    GZIP: "GZIP",
    NONE: "NONE",
    ZSTD: "ZSTD",
};
const InputFormat = {
    CSV: "CSV",
    DYNAMODB_JSON: "DYNAMODB_JSON",
    ION: "ION",
};
class ImportNotFoundException extends DynamoDBServiceException {
    name = "ImportNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ImportNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ImportNotFoundException.prototype);
    }
}
const DestinationStatus = {
    ACTIVE: "ACTIVE",
    DISABLED: "DISABLED",
    DISABLING: "DISABLING",
    ENABLE_FAILED: "ENABLE_FAILED",
    ENABLING: "ENABLING",
    UPDATING: "UPDATING",
};
class DuplicateItemException extends DynamoDBServiceException {
    name = "DuplicateItemException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "DuplicateItemException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, DuplicateItemException.prototype);
    }
}
class IdempotentParameterMismatchException extends DynamoDBServiceException {
    name = "IdempotentParameterMismatchException";
    $fault = "client";
    Message;
    constructor(opts) {
        super({
            name: "IdempotentParameterMismatchException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, IdempotentParameterMismatchException.prototype);
        this.Message = opts.Message;
    }
}
class TransactionInProgressException extends DynamoDBServiceException {
    name = "TransactionInProgressException";
    $fault = "client";
    Message;
    constructor(opts) {
        super({
            name: "TransactionInProgressException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TransactionInProgressException.prototype);
        this.Message = opts.Message;
    }
}
class ExportConflictException extends DynamoDBServiceException {
    name = "ExportConflictException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ExportConflictException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ExportConflictException.prototype);
    }
}
class InvalidExportTimeException extends DynamoDBServiceException {
    name = "InvalidExportTimeException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidExportTimeException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidExportTimeException.prototype);
    }
}
class PointInTimeRecoveryUnavailableException extends DynamoDBServiceException {
    name = "PointInTimeRecoveryUnavailableException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "PointInTimeRecoveryUnavailableException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, PointInTimeRecoveryUnavailableException.prototype);
    }
}
class ImportConflictException extends DynamoDBServiceException {
    name = "ImportConflictException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ImportConflictException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ImportConflictException.prototype);
    }
}
const Select = {
    ALL_ATTRIBUTES: "ALL_ATTRIBUTES",
    ALL_PROJECTED_ATTRIBUTES: "ALL_PROJECTED_ATTRIBUTES",
    COUNT: "COUNT",
    SPECIFIC_ATTRIBUTES: "SPECIFIC_ATTRIBUTES",
};
class TableAlreadyExistsException extends DynamoDBServiceException {
    name = "TableAlreadyExistsException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "TableAlreadyExistsException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TableAlreadyExistsException.prototype);
    }
}
class InvalidRestoreTimeException extends DynamoDBServiceException {
    name = "InvalidRestoreTimeException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidRestoreTimeException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidRestoreTimeException.prototype);
    }
}
class ReplicaAlreadyExistsException extends DynamoDBServiceException {
    name = "ReplicaAlreadyExistsException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ReplicaAlreadyExistsException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ReplicaAlreadyExistsException.prototype);
    }
}
class ReplicaNotFoundException extends DynamoDBServiceException {
    name = "ReplicaNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ReplicaNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ReplicaNotFoundException.prototype);
    }
}
class IndexNotFoundException extends DynamoDBServiceException {
    name = "IndexNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "IndexNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, IndexNotFoundException.prototype);
    }
}
exports.AttributeValue = void 0;
(function (AttributeValue) {
    AttributeValue.visit = (value, visitor) => {
        if (value.S !== undefined)
            return visitor.S(value.S);
        if (value.N !== undefined)
            return visitor.N(value.N);
        if (value.B !== undefined)
            return visitor.B(value.B);
        if (value.SS !== undefined)
            return visitor.SS(value.SS);
        if (value.NS !== undefined)
            return visitor.NS(value.NS);
        if (value.BS !== undefined)
            return visitor.BS(value.BS);
        if (value.M !== undefined)
            return visitor.M(value.M);
        if (value.L !== undefined)
            return visitor.L(value.L);
        if (value.NULL !== undefined)
            return visitor.NULL(value.NULL);
        if (value.BOOL !== undefined)
            return visitor.BOOL(value.BOOL);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(exports.AttributeValue || (exports.AttributeValue = {}));
class ConditionalCheckFailedException extends DynamoDBServiceException {
    name = "ConditionalCheckFailedException";
    $fault = "client";
    Item;
    constructor(opts) {
        super({
            name: "ConditionalCheckFailedException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ConditionalCheckFailedException.prototype);
        this.Item = opts.Item;
    }
}
class TransactionCanceledException extends DynamoDBServiceException {
    name = "TransactionCanceledException";
    $fault = "client";
    Message;
    CancellationReasons;
    constructor(opts) {
        super({
            name: "TransactionCanceledException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TransactionCanceledException.prototype);
        this.Message = opts.Message;
        this.CancellationReasons = opts.CancellationReasons;
    }
}

const se_BatchExecuteStatementCommand = async (input, context) => {
    const headers = sharedHeaders("BatchExecuteStatement");
    let body;
    body = JSON.stringify(se_BatchExecuteStatementInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_BatchGetItemCommand = async (input, context) => {
    const headers = sharedHeaders("BatchGetItem");
    let body;
    body = JSON.stringify(se_BatchGetItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_BatchWriteItemCommand = async (input, context) => {
    const headers = sharedHeaders("BatchWriteItem");
    let body;
    body = JSON.stringify(se_BatchWriteItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_CreateBackupCommand = async (input, context) => {
    const headers = sharedHeaders("CreateBackup");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_CreateGlobalTableCommand = async (input, context) => {
    const headers = sharedHeaders("CreateGlobalTable");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_CreateTableCommand = async (input, context) => {
    const headers = sharedHeaders("CreateTable");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DeleteBackupCommand = async (input, context) => {
    const headers = sharedHeaders("DeleteBackup");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DeleteItemCommand = async (input, context) => {
    const headers = sharedHeaders("DeleteItem");
    let body;
    body = JSON.stringify(se_DeleteItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DeleteResourcePolicyCommand = async (input, context) => {
    const headers = sharedHeaders("DeleteResourcePolicy");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DeleteTableCommand = async (input, context) => {
    const headers = sharedHeaders("DeleteTable");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeBackupCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeBackup");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeContinuousBackupsCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeContinuousBackups");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeContributorInsightsCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeContributorInsights");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeEndpointsCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeEndpoints");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeExportCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeExport");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeGlobalTableCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeGlobalTable");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeGlobalTableSettingsCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeGlobalTableSettings");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeImportCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeImport");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeKinesisStreamingDestinationCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeKinesisStreamingDestination");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeLimitsCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeLimits");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeTableCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeTable");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeTableReplicaAutoScalingCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeTableReplicaAutoScaling");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DescribeTimeToLiveCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeTimeToLive");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_DisableKinesisStreamingDestinationCommand = async (input, context) => {
    const headers = sharedHeaders("DisableKinesisStreamingDestination");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_EnableKinesisStreamingDestinationCommand = async (input, context) => {
    const headers = sharedHeaders("EnableKinesisStreamingDestination");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ExecuteStatementCommand = async (input, context) => {
    const headers = sharedHeaders("ExecuteStatement");
    let body;
    body = JSON.stringify(se_ExecuteStatementInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ExecuteTransactionCommand = async (input, context) => {
    const headers = sharedHeaders("ExecuteTransaction");
    let body;
    body = JSON.stringify(se_ExecuteTransactionInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ExportTableToPointInTimeCommand = async (input, context) => {
    const headers = sharedHeaders("ExportTableToPointInTime");
    let body;
    body = JSON.stringify(se_ExportTableToPointInTimeInput(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_GetItemCommand = async (input, context) => {
    const headers = sharedHeaders("GetItem");
    let body;
    body = JSON.stringify(se_GetItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_GetResourcePolicyCommand = async (input, context) => {
    const headers = sharedHeaders("GetResourcePolicy");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ImportTableCommand = async (input, context) => {
    const headers = sharedHeaders("ImportTable");
    let body;
    body = JSON.stringify(se_ImportTableInput(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ListBackupsCommand = async (input, context) => {
    const headers = sharedHeaders("ListBackups");
    let body;
    body = JSON.stringify(se_ListBackupsInput(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ListContributorInsightsCommand = async (input, context) => {
    const headers = sharedHeaders("ListContributorInsights");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ListExportsCommand = async (input, context) => {
    const headers = sharedHeaders("ListExports");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ListGlobalTablesCommand = async (input, context) => {
    const headers = sharedHeaders("ListGlobalTables");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ListImportsCommand = async (input, context) => {
    const headers = sharedHeaders("ListImports");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ListTablesCommand = async (input, context) => {
    const headers = sharedHeaders("ListTables");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ListTagsOfResourceCommand = async (input, context) => {
    const headers = sharedHeaders("ListTagsOfResource");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_PutItemCommand = async (input, context) => {
    const headers = sharedHeaders("PutItem");
    let body;
    body = JSON.stringify(se_PutItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_PutResourcePolicyCommand = async (input, context) => {
    const headers = sharedHeaders("PutResourcePolicy");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_QueryCommand = async (input, context) => {
    const headers = sharedHeaders("Query");
    let body;
    body = JSON.stringify(se_QueryInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_RestoreTableFromBackupCommand = async (input, context) => {
    const headers = sharedHeaders("RestoreTableFromBackup");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_RestoreTableToPointInTimeCommand = async (input, context) => {
    const headers = sharedHeaders("RestoreTableToPointInTime");
    let body;
    body = JSON.stringify(se_RestoreTableToPointInTimeInput(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_ScanCommand = async (input, context) => {
    const headers = sharedHeaders("Scan");
    let body;
    body = JSON.stringify(se_ScanInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_TagResourceCommand = async (input, context) => {
    const headers = sharedHeaders("TagResource");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_TransactGetItemsCommand = async (input, context) => {
    const headers = sharedHeaders("TransactGetItems");
    let body;
    body = JSON.stringify(se_TransactGetItemsInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_TransactWriteItemsCommand = async (input, context) => {
    const headers = sharedHeaders("TransactWriteItems");
    let body;
    body = JSON.stringify(se_TransactWriteItemsInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_UntagResourceCommand = async (input, context) => {
    const headers = sharedHeaders("UntagResource");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_UpdateContinuousBackupsCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateContinuousBackups");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_UpdateContributorInsightsCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateContributorInsights");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_UpdateGlobalTableCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateGlobalTable");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_UpdateGlobalTableSettingsCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateGlobalTableSettings");
    let body;
    body = JSON.stringify(se_UpdateGlobalTableSettingsInput(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_UpdateItemCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateItem");
    let body;
    body = JSON.stringify(se_UpdateItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_UpdateKinesisStreamingDestinationCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateKinesisStreamingDestination");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_UpdateTableCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateTable");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_UpdateTableReplicaAutoScalingCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateTableReplicaAutoScaling");
    let body;
    body = JSON.stringify(se_UpdateTableReplicaAutoScalingInput(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_UpdateTimeToLiveCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateTimeToLive");
    let body;
    body = JSON.stringify(smithyClient._json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const de_BatchExecuteStatementCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_BatchExecuteStatementOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_BatchGetItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_BatchGetItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_BatchWriteItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_BatchWriteItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_CreateBackupCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_CreateBackupOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_CreateGlobalTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_CreateGlobalTableOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_CreateTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_CreateTableOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DeleteBackupCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DeleteBackupOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DeleteItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DeleteItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DeleteResourcePolicyCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DeleteTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DeleteTableOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeBackupCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DescribeBackupOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeContinuousBackupsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DescribeContinuousBackupsOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeContributorInsightsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DescribeContributorInsightsOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeEndpointsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeExportCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DescribeExportOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeGlobalTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DescribeGlobalTableOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeGlobalTableSettingsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DescribeGlobalTableSettingsOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeImportCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DescribeImportOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeKinesisStreamingDestinationCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeLimitsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DescribeTableOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeTableReplicaAutoScalingCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_DescribeTableReplicaAutoScalingOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DescribeTimeToLiveCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_DisableKinesisStreamingDestinationCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_EnableKinesisStreamingDestinationCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ExecuteStatementCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_ExecuteStatementOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ExecuteTransactionCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_ExecuteTransactionOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ExportTableToPointInTimeCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_ExportTableToPointInTimeOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_GetItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_GetItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_GetResourcePolicyCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ImportTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_ImportTableOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ListBackupsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_ListBackupsOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ListContributorInsightsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ListExportsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ListGlobalTablesCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ListImportsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_ListImportsOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ListTablesCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ListTagsOfResourceCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_PutItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_PutItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_PutResourcePolicyCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_QueryCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_QueryOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_RestoreTableFromBackupCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_RestoreTableFromBackupOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_RestoreTableToPointInTimeCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_RestoreTableToPointInTimeOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_ScanCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_ScanOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_TagResourceCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    await smithyClient.collectBody(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
const de_TransactGetItemsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_TransactGetItemsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_TransactWriteItemsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_TransactWriteItemsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_UntagResourceCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    await smithyClient.collectBody(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
const de_UpdateContinuousBackupsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_UpdateContinuousBackupsOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_UpdateContributorInsightsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_UpdateGlobalTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_UpdateGlobalTableOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_UpdateGlobalTableSettingsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_UpdateGlobalTableSettingsOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_UpdateItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_UpdateItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_UpdateKinesisStreamingDestinationCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_UpdateTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_UpdateTableOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_UpdateTableReplicaAutoScalingCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = de_UpdateTableReplicaAutoScalingOutput(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_UpdateTimeToLiveCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await core.parseJsonBody(output.body, context);
    let contents = {};
    contents = smithyClient._json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_CommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await core.parseJsonErrorBody(output.body, context),
    };
    const errorCode = core.loadRestJsonErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "InternalServerError":
        case "com.amazonaws.dynamodb#InternalServerError":
            throw await de_InternalServerErrorRes(parsedOutput);
        case "RequestLimitExceeded":
        case "com.amazonaws.dynamodb#RequestLimitExceeded":
            throw await de_RequestLimitExceededRes(parsedOutput);
        case "ThrottlingException":
        case "com.amazonaws.dynamodb#ThrottlingException":
            throw await de_ThrottlingExceptionRes(parsedOutput);
        case "InvalidEndpointException":
        case "com.amazonaws.dynamodb#InvalidEndpointException":
            throw await de_InvalidEndpointExceptionRes(parsedOutput);
        case "ProvisionedThroughputExceededException":
        case "com.amazonaws.dynamodb#ProvisionedThroughputExceededException":
            throw await de_ProvisionedThroughputExceededExceptionRes(parsedOutput);
        case "ResourceNotFoundException":
        case "com.amazonaws.dynamodb#ResourceNotFoundException":
            throw await de_ResourceNotFoundExceptionRes(parsedOutput);
        case "ItemCollectionSizeLimitExceededException":
        case "com.amazonaws.dynamodb#ItemCollectionSizeLimitExceededException":
            throw await de_ItemCollectionSizeLimitExceededExceptionRes(parsedOutput);
        case "ReplicatedWriteConflictException":
        case "com.amazonaws.dynamodb#ReplicatedWriteConflictException":
            throw await de_ReplicatedWriteConflictExceptionRes(parsedOutput);
        case "BackupInUseException":
        case "com.amazonaws.dynamodb#BackupInUseException":
            throw await de_BackupInUseExceptionRes(parsedOutput);
        case "ContinuousBackupsUnavailableException":
        case "com.amazonaws.dynamodb#ContinuousBackupsUnavailableException":
            throw await de_ContinuousBackupsUnavailableExceptionRes(parsedOutput);
        case "LimitExceededException":
        case "com.amazonaws.dynamodb#LimitExceededException":
            throw await de_LimitExceededExceptionRes(parsedOutput);
        case "TableInUseException":
        case "com.amazonaws.dynamodb#TableInUseException":
            throw await de_TableInUseExceptionRes(parsedOutput);
        case "TableNotFoundException":
        case "com.amazonaws.dynamodb#TableNotFoundException":
            throw await de_TableNotFoundExceptionRes(parsedOutput);
        case "GlobalTableAlreadyExistsException":
        case "com.amazonaws.dynamodb#GlobalTableAlreadyExistsException":
            throw await de_GlobalTableAlreadyExistsExceptionRes(parsedOutput);
        case "ResourceInUseException":
        case "com.amazonaws.dynamodb#ResourceInUseException":
            throw await de_ResourceInUseExceptionRes(parsedOutput);
        case "BackupNotFoundException":
        case "com.amazonaws.dynamodb#BackupNotFoundException":
            throw await de_BackupNotFoundExceptionRes(parsedOutput);
        case "ConditionalCheckFailedException":
        case "com.amazonaws.dynamodb#ConditionalCheckFailedException":
            throw await de_ConditionalCheckFailedExceptionRes(parsedOutput, context);
        case "TransactionConflictException":
        case "com.amazonaws.dynamodb#TransactionConflictException":
            throw await de_TransactionConflictExceptionRes(parsedOutput);
        case "PolicyNotFoundException":
        case "com.amazonaws.dynamodb#PolicyNotFoundException":
            throw await de_PolicyNotFoundExceptionRes(parsedOutput);
        case "ExportNotFoundException":
        case "com.amazonaws.dynamodb#ExportNotFoundException":
            throw await de_ExportNotFoundExceptionRes(parsedOutput);
        case "GlobalTableNotFoundException":
        case "com.amazonaws.dynamodb#GlobalTableNotFoundException":
            throw await de_GlobalTableNotFoundExceptionRes(parsedOutput);
        case "ImportNotFoundException":
        case "com.amazonaws.dynamodb#ImportNotFoundException":
            throw await de_ImportNotFoundExceptionRes(parsedOutput);
        case "DuplicateItemException":
        case "com.amazonaws.dynamodb#DuplicateItemException":
            throw await de_DuplicateItemExceptionRes(parsedOutput);
        case "IdempotentParameterMismatchException":
        case "com.amazonaws.dynamodb#IdempotentParameterMismatchException":
            throw await de_IdempotentParameterMismatchExceptionRes(parsedOutput);
        case "TransactionCanceledException":
        case "com.amazonaws.dynamodb#TransactionCanceledException":
            throw await de_TransactionCanceledExceptionRes(parsedOutput, context);
        case "TransactionInProgressException":
        case "com.amazonaws.dynamodb#TransactionInProgressException":
            throw await de_TransactionInProgressExceptionRes(parsedOutput);
        case "ExportConflictException":
        case "com.amazonaws.dynamodb#ExportConflictException":
            throw await de_ExportConflictExceptionRes(parsedOutput);
        case "InvalidExportTimeException":
        case "com.amazonaws.dynamodb#InvalidExportTimeException":
            throw await de_InvalidExportTimeExceptionRes(parsedOutput);
        case "PointInTimeRecoveryUnavailableException":
        case "com.amazonaws.dynamodb#PointInTimeRecoveryUnavailableException":
            throw await de_PointInTimeRecoveryUnavailableExceptionRes(parsedOutput);
        case "ImportConflictException":
        case "com.amazonaws.dynamodb#ImportConflictException":
            throw await de_ImportConflictExceptionRes(parsedOutput);
        case "TableAlreadyExistsException":
        case "com.amazonaws.dynamodb#TableAlreadyExistsException":
            throw await de_TableAlreadyExistsExceptionRes(parsedOutput);
        case "InvalidRestoreTimeException":
        case "com.amazonaws.dynamodb#InvalidRestoreTimeException":
            throw await de_InvalidRestoreTimeExceptionRes(parsedOutput);
        case "ReplicaAlreadyExistsException":
        case "com.amazonaws.dynamodb#ReplicaAlreadyExistsException":
            throw await de_ReplicaAlreadyExistsExceptionRes(parsedOutput);
        case "ReplicaNotFoundException":
        case "com.amazonaws.dynamodb#ReplicaNotFoundException":
            throw await de_ReplicaNotFoundExceptionRes(parsedOutput);
        case "IndexNotFoundException":
        case "com.amazonaws.dynamodb#IndexNotFoundException":
            throw await de_IndexNotFoundExceptionRes(parsedOutput);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody,
                errorCode,
            });
    }
};
const de_BackupInUseExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new BackupInUseException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_BackupNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new BackupNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ConditionalCheckFailedExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_ConditionalCheckFailedException(body, context);
    const exception = new ConditionalCheckFailedException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ContinuousBackupsUnavailableExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ContinuousBackupsUnavailableException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_DuplicateItemExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new DuplicateItemException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ExportConflictExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ExportConflictException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ExportNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ExportNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_GlobalTableAlreadyExistsExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new GlobalTableAlreadyExistsException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_GlobalTableNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new GlobalTableNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_IdempotentParameterMismatchExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new IdempotentParameterMismatchException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ImportConflictExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ImportConflictException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ImportNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ImportNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_IndexNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new IndexNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_InternalServerErrorRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new InternalServerError({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_InvalidEndpointExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new InvalidEndpointException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_InvalidExportTimeExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new InvalidExportTimeException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_InvalidRestoreTimeExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new InvalidRestoreTimeException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ItemCollectionSizeLimitExceededExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ItemCollectionSizeLimitExceededException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_LimitExceededExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new LimitExceededException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_PointInTimeRecoveryUnavailableExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new PointInTimeRecoveryUnavailableException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_PolicyNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new PolicyNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ProvisionedThroughputExceededExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ProvisionedThroughputExceededException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ReplicaAlreadyExistsExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ReplicaAlreadyExistsException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ReplicaNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ReplicaNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ReplicatedWriteConflictExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ReplicatedWriteConflictException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_RequestLimitExceededRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new RequestLimitExceeded({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ResourceInUseExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ResourceInUseException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ResourceNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ResourceNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_TableAlreadyExistsExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new TableAlreadyExistsException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_TableInUseExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new TableInUseException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_TableNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new TableNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_ThrottlingExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new ThrottlingException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_TransactionCanceledExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_TransactionCanceledException(body, context);
    const exception = new TransactionCanceledException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_TransactionConflictExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new TransactionConflictException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const de_TransactionInProgressExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = smithyClient._json(body);
    const exception = new TransactionInProgressException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return smithyClient.decorateServiceException(exception, body);
};
const se_AttributeUpdates = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_AttributeValueUpdate(value, context);
        return acc;
    }, {});
};
const se_AttributeValue = (input, context) => {
    return exports.AttributeValue.visit(input, {
        B: (value) => ({ B: context.base64Encoder(value) }),
        BOOL: (value) => ({ BOOL: value }),
        BS: (value) => ({ BS: se_BinarySetAttributeValue(value, context) }),
        L: (value) => ({ L: se_ListAttributeValue(value, context) }),
        M: (value) => ({ M: se_MapAttributeValue(value, context) }),
        N: (value) => ({ N: value }),
        NS: (value) => ({ NS: smithyClient._json(value) }),
        NULL: (value) => ({ NULL: value }),
        S: (value) => ({ S: value }),
        SS: (value) => ({ SS: smithyClient._json(value) }),
        _: (name, value) => ({ [name]: value }),
    });
};
const se_AttributeValueList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_AttributeValue(entry, context);
    });
};
const se_AttributeValueUpdate = (input, context) => {
    return smithyClient.take(input, {
        Action: [],
        Value: (_) => se_AttributeValue(_, context),
    });
};
const se_AutoScalingPolicyUpdate = (input, context) => {
    return smithyClient.take(input, {
        PolicyName: [],
        TargetTrackingScalingPolicyConfiguration: (_) => se_AutoScalingTargetTrackingScalingPolicyConfigurationUpdate(_),
    });
};
const se_AutoScalingSettingsUpdate = (input, context) => {
    return smithyClient.take(input, {
        AutoScalingDisabled: [],
        AutoScalingRoleArn: [],
        MaximumUnits: [],
        MinimumUnits: [],
        ScalingPolicyUpdate: (_) => se_AutoScalingPolicyUpdate(_),
    });
};
const se_AutoScalingTargetTrackingScalingPolicyConfigurationUpdate = (input, context) => {
    return smithyClient.take(input, {
        DisableScaleIn: [],
        ScaleInCooldown: [],
        ScaleOutCooldown: [],
        TargetValue: smithyClient.serializeFloat,
    });
};
const se_BatchExecuteStatementInput = (input, context) => {
    return smithyClient.take(input, {
        ReturnConsumedCapacity: [],
        Statements: (_) => se_PartiQLBatchRequest(_, context),
    });
};
const se_BatchGetItemInput = (input, context) => {
    return smithyClient.take(input, {
        RequestItems: (_) => se_BatchGetRequestMap(_, context),
        ReturnConsumedCapacity: [],
    });
};
const se_BatchGetRequestMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_KeysAndAttributes(value, context);
        return acc;
    }, {});
};
const se_BatchStatementRequest = (input, context) => {
    return smithyClient.take(input, {
        ConsistentRead: [],
        Parameters: (_) => se_PreparedStatementParameters(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        Statement: [],
    });
};
const se_BatchWriteItemInput = (input, context) => {
    return smithyClient.take(input, {
        RequestItems: (_) => se_BatchWriteItemRequestMap(_, context),
        ReturnConsumedCapacity: [],
        ReturnItemCollectionMetrics: [],
    });
};
const se_BatchWriteItemRequestMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_WriteRequests(value, context);
        return acc;
    }, {});
};
const se_BinarySetAttributeValue = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return context.base64Encoder(entry);
    });
};
const se_Condition = (input, context) => {
    return smithyClient.take(input, {
        AttributeValueList: (_) => se_AttributeValueList(_, context),
        ComparisonOperator: [],
    });
};
const se_ConditionCheck = (input, context) => {
    return smithyClient.take(input, {
        ConditionExpression: [],
        ExpressionAttributeNames: smithyClient._json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Key: (_) => se_Key(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
    });
};
const se_Delete = (input, context) => {
    return smithyClient.take(input, {
        ConditionExpression: [],
        ExpressionAttributeNames: smithyClient._json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Key: (_) => se_Key(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
    });
};
const se_DeleteItemInput = (input, context) => {
    return smithyClient.take(input, {
        ConditionExpression: [],
        ConditionalOperator: [],
        Expected: (_) => se_ExpectedAttributeMap(_, context),
        ExpressionAttributeNames: smithyClient._json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Key: (_) => se_Key(_, context),
        ReturnConsumedCapacity: [],
        ReturnItemCollectionMetrics: [],
        ReturnValues: [],
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
    });
};
const se_DeleteRequest = (input, context) => {
    return smithyClient.take(input, {
        Key: (_) => se_Key(_, context),
    });
};
const se_ExecuteStatementInput = (input, context) => {
    return smithyClient.take(input, {
        ConsistentRead: [],
        Limit: [],
        NextToken: [],
        Parameters: (_) => se_PreparedStatementParameters(_, context),
        ReturnConsumedCapacity: [],
        ReturnValuesOnConditionCheckFailure: [],
        Statement: [],
    });
};
const se_ExecuteTransactionInput = (input, context) => {
    return smithyClient.take(input, {
        ClientRequestToken: [true, (_) => _ ?? uuid.v4()],
        ReturnConsumedCapacity: [],
        TransactStatements: (_) => se_ParameterizedStatements(_, context),
    });
};
const se_ExpectedAttributeMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_ExpectedAttributeValue(value, context);
        return acc;
    }, {});
};
const se_ExpectedAttributeValue = (input, context) => {
    return smithyClient.take(input, {
        AttributeValueList: (_) => se_AttributeValueList(_, context),
        ComparisonOperator: [],
        Exists: [],
        Value: (_) => se_AttributeValue(_, context),
    });
};
const se_ExportTableToPointInTimeInput = (input, context) => {
    return smithyClient.take(input, {
        ClientToken: [true, (_) => _ ?? uuid.v4()],
        ExportFormat: [],
        ExportTime: (_) => _.getTime() / 1_000,
        ExportType: [],
        IncrementalExportSpecification: (_) => se_IncrementalExportSpecification(_),
        S3Bucket: [],
        S3BucketOwner: [],
        S3Prefix: [],
        S3SseAlgorithm: [],
        S3SseKmsKeyId: [],
        TableArn: [],
    });
};
const se_ExpressionAttributeValueMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_AttributeValue(value, context);
        return acc;
    }, {});
};
const se_FilterConditionMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_Condition(value, context);
        return acc;
    }, {});
};
const se_Get = (input, context) => {
    return smithyClient.take(input, {
        ExpressionAttributeNames: smithyClient._json,
        Key: (_) => se_Key(_, context),
        ProjectionExpression: [],
        TableName: [],
    });
};
const se_GetItemInput = (input, context) => {
    return smithyClient.take(input, {
        AttributesToGet: smithyClient._json,
        ConsistentRead: [],
        ExpressionAttributeNames: smithyClient._json,
        Key: (_) => se_Key(_, context),
        ProjectionExpression: [],
        ReturnConsumedCapacity: [],
        TableName: [],
    });
};
const se_GlobalSecondaryIndexAutoScalingUpdate = (input, context) => {
    return smithyClient.take(input, {
        IndexName: [],
        ProvisionedWriteCapacityAutoScalingUpdate: (_) => se_AutoScalingSettingsUpdate(_),
    });
};
const se_GlobalSecondaryIndexAutoScalingUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_GlobalSecondaryIndexAutoScalingUpdate(entry);
    });
};
const se_GlobalTableGlobalSecondaryIndexSettingsUpdate = (input, context) => {
    return smithyClient.take(input, {
        IndexName: [],
        ProvisionedWriteCapacityAutoScalingSettingsUpdate: (_) => se_AutoScalingSettingsUpdate(_),
        ProvisionedWriteCapacityUnits: [],
    });
};
const se_GlobalTableGlobalSecondaryIndexSettingsUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_GlobalTableGlobalSecondaryIndexSettingsUpdate(entry);
    });
};
const se_ImportTableInput = (input, context) => {
    return smithyClient.take(input, {
        ClientToken: [true, (_) => _ ?? uuid.v4()],
        InputCompressionType: [],
        InputFormat: [],
        InputFormatOptions: smithyClient._json,
        S3BucketSource: smithyClient._json,
        TableCreationParameters: smithyClient._json,
    });
};
const se_IncrementalExportSpecification = (input, context) => {
    return smithyClient.take(input, {
        ExportFromTime: (_) => _.getTime() / 1_000,
        ExportToTime: (_) => _.getTime() / 1_000,
        ExportViewType: [],
    });
};
const se_Key = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_AttributeValue(value, context);
        return acc;
    }, {});
};
const se_KeyConditions = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_Condition(value, context);
        return acc;
    }, {});
};
const se_KeyList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_Key(entry, context);
    });
};
const se_KeysAndAttributes = (input, context) => {
    return smithyClient.take(input, {
        AttributesToGet: smithyClient._json,
        ConsistentRead: [],
        ExpressionAttributeNames: smithyClient._json,
        Keys: (_) => se_KeyList(_, context),
        ProjectionExpression: [],
    });
};
const se_ListAttributeValue = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_AttributeValue(entry, context);
    });
};
const se_ListBackupsInput = (input, context) => {
    return smithyClient.take(input, {
        BackupType: [],
        ExclusiveStartBackupArn: [],
        Limit: [],
        TableName: [],
        TimeRangeLowerBound: (_) => _.getTime() / 1_000,
        TimeRangeUpperBound: (_) => _.getTime() / 1_000,
    });
};
const se_MapAttributeValue = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_AttributeValue(value, context);
        return acc;
    }, {});
};
const se_ParameterizedStatement = (input, context) => {
    return smithyClient.take(input, {
        Parameters: (_) => se_PreparedStatementParameters(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        Statement: [],
    });
};
const se_ParameterizedStatements = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_ParameterizedStatement(entry, context);
    });
};
const se_PartiQLBatchRequest = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_BatchStatementRequest(entry, context);
    });
};
const se_PreparedStatementParameters = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_AttributeValue(entry, context);
    });
};
const se_Put = (input, context) => {
    return smithyClient.take(input, {
        ConditionExpression: [],
        ExpressionAttributeNames: smithyClient._json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Item: (_) => se_PutItemInputAttributeMap(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
    });
};
const se_PutItemInput = (input, context) => {
    return smithyClient.take(input, {
        ConditionExpression: [],
        ConditionalOperator: [],
        Expected: (_) => se_ExpectedAttributeMap(_, context),
        ExpressionAttributeNames: smithyClient._json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Item: (_) => se_PutItemInputAttributeMap(_, context),
        ReturnConsumedCapacity: [],
        ReturnItemCollectionMetrics: [],
        ReturnValues: [],
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
    });
};
const se_PutItemInputAttributeMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_AttributeValue(value, context);
        return acc;
    }, {});
};
const se_PutRequest = (input, context) => {
    return smithyClient.take(input, {
        Item: (_) => se_PutItemInputAttributeMap(_, context),
    });
};
const se_QueryInput = (input, context) => {
    return smithyClient.take(input, {
        AttributesToGet: smithyClient._json,
        ConditionalOperator: [],
        ConsistentRead: [],
        ExclusiveStartKey: (_) => se_Key(_, context),
        ExpressionAttributeNames: smithyClient._json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        FilterExpression: [],
        IndexName: [],
        KeyConditionExpression: [],
        KeyConditions: (_) => se_KeyConditions(_, context),
        Limit: [],
        ProjectionExpression: [],
        QueryFilter: (_) => se_FilterConditionMap(_, context),
        ReturnConsumedCapacity: [],
        ScanIndexForward: [],
        Select: [],
        TableName: [],
    });
};
const se_ReplicaAutoScalingUpdate = (input, context) => {
    return smithyClient.take(input, {
        RegionName: [],
        ReplicaGlobalSecondaryIndexUpdates: (_) => se_ReplicaGlobalSecondaryIndexAutoScalingUpdateList(_),
        ReplicaProvisionedReadCapacityAutoScalingUpdate: (_) => se_AutoScalingSettingsUpdate(_),
    });
};
const se_ReplicaAutoScalingUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_ReplicaAutoScalingUpdate(entry);
    });
};
const se_ReplicaGlobalSecondaryIndexAutoScalingUpdate = (input, context) => {
    return smithyClient.take(input, {
        IndexName: [],
        ProvisionedReadCapacityAutoScalingUpdate: (_) => se_AutoScalingSettingsUpdate(_),
    });
};
const se_ReplicaGlobalSecondaryIndexAutoScalingUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_ReplicaGlobalSecondaryIndexAutoScalingUpdate(entry);
    });
};
const se_ReplicaGlobalSecondaryIndexSettingsUpdate = (input, context) => {
    return smithyClient.take(input, {
        IndexName: [],
        ProvisionedReadCapacityAutoScalingSettingsUpdate: (_) => se_AutoScalingSettingsUpdate(_),
        ProvisionedReadCapacityUnits: [],
    });
};
const se_ReplicaGlobalSecondaryIndexSettingsUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_ReplicaGlobalSecondaryIndexSettingsUpdate(entry);
    });
};
const se_ReplicaSettingsUpdate = (input, context) => {
    return smithyClient.take(input, {
        RegionName: [],
        ReplicaGlobalSecondaryIndexSettingsUpdate: (_) => se_ReplicaGlobalSecondaryIndexSettingsUpdateList(_),
        ReplicaProvisionedReadCapacityAutoScalingSettingsUpdate: (_) => se_AutoScalingSettingsUpdate(_),
        ReplicaProvisionedReadCapacityUnits: [],
        ReplicaTableClass: [],
    });
};
const se_ReplicaSettingsUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_ReplicaSettingsUpdate(entry);
    });
};
const se_RestoreTableToPointInTimeInput = (input, context) => {
    return smithyClient.take(input, {
        BillingModeOverride: [],
        GlobalSecondaryIndexOverride: smithyClient._json,
        LocalSecondaryIndexOverride: smithyClient._json,
        OnDemandThroughputOverride: smithyClient._json,
        ProvisionedThroughputOverride: smithyClient._json,
        RestoreDateTime: (_) => _.getTime() / 1_000,
        SSESpecificationOverride: smithyClient._json,
        SourceTableArn: [],
        SourceTableName: [],
        TargetTableName: [],
        UseLatestRestorableTime: [],
    });
};
const se_ScanInput = (input, context) => {
    return smithyClient.take(input, {
        AttributesToGet: smithyClient._json,
        ConditionalOperator: [],
        ConsistentRead: [],
        ExclusiveStartKey: (_) => se_Key(_, context),
        ExpressionAttributeNames: smithyClient._json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        FilterExpression: [],
        IndexName: [],
        Limit: [],
        ProjectionExpression: [],
        ReturnConsumedCapacity: [],
        ScanFilter: (_) => se_FilterConditionMap(_, context),
        Segment: [],
        Select: [],
        TableName: [],
        TotalSegments: [],
    });
};
const se_TransactGetItem = (input, context) => {
    return smithyClient.take(input, {
        Get: (_) => se_Get(_, context),
    });
};
const se_TransactGetItemList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_TransactGetItem(entry, context);
    });
};
const se_TransactGetItemsInput = (input, context) => {
    return smithyClient.take(input, {
        ReturnConsumedCapacity: [],
        TransactItems: (_) => se_TransactGetItemList(_, context),
    });
};
const se_TransactWriteItem = (input, context) => {
    return smithyClient.take(input, {
        ConditionCheck: (_) => se_ConditionCheck(_, context),
        Delete: (_) => se_Delete(_, context),
        Put: (_) => se_Put(_, context),
        Update: (_) => se_Update(_, context),
    });
};
const se_TransactWriteItemList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_TransactWriteItem(entry, context);
    });
};
const se_TransactWriteItemsInput = (input, context) => {
    return smithyClient.take(input, {
        ClientRequestToken: [true, (_) => _ ?? uuid.v4()],
        ReturnConsumedCapacity: [],
        ReturnItemCollectionMetrics: [],
        TransactItems: (_) => se_TransactWriteItemList(_, context),
    });
};
const se_Update = (input, context) => {
    return smithyClient.take(input, {
        ConditionExpression: [],
        ExpressionAttributeNames: smithyClient._json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Key: (_) => se_Key(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
        UpdateExpression: [],
    });
};
const se_UpdateGlobalTableSettingsInput = (input, context) => {
    return smithyClient.take(input, {
        GlobalTableBillingMode: [],
        GlobalTableGlobalSecondaryIndexSettingsUpdate: (_) => se_GlobalTableGlobalSecondaryIndexSettingsUpdateList(_),
        GlobalTableName: [],
        GlobalTableProvisionedWriteCapacityAutoScalingSettingsUpdate: (_) => se_AutoScalingSettingsUpdate(_),
        GlobalTableProvisionedWriteCapacityUnits: [],
        ReplicaSettingsUpdate: (_) => se_ReplicaSettingsUpdateList(_),
    });
};
const se_UpdateItemInput = (input, context) => {
    return smithyClient.take(input, {
        AttributeUpdates: (_) => se_AttributeUpdates(_, context),
        ConditionExpression: [],
        ConditionalOperator: [],
        Expected: (_) => se_ExpectedAttributeMap(_, context),
        ExpressionAttributeNames: smithyClient._json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Key: (_) => se_Key(_, context),
        ReturnConsumedCapacity: [],
        ReturnItemCollectionMetrics: [],
        ReturnValues: [],
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
        UpdateExpression: [],
    });
};
const se_UpdateTableReplicaAutoScalingInput = (input, context) => {
    return smithyClient.take(input, {
        GlobalSecondaryIndexUpdates: (_) => se_GlobalSecondaryIndexAutoScalingUpdateList(_),
        ProvisionedWriteCapacityAutoScalingUpdate: (_) => se_AutoScalingSettingsUpdate(_),
        ReplicaUpdates: (_) => se_ReplicaAutoScalingUpdateList(_),
        TableName: [],
    });
};
const se_WriteRequest = (input, context) => {
    return smithyClient.take(input, {
        DeleteRequest: (_) => se_DeleteRequest(_, context),
        PutRequest: (_) => se_PutRequest(_, context),
    });
};
const se_WriteRequests = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_WriteRequest(entry, context);
    });
};
const de_ArchivalSummary = (output, context) => {
    return smithyClient.take(output, {
        ArchivalBackupArn: smithyClient.expectString,
        ArchivalDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        ArchivalReason: smithyClient.expectString,
    });
};
const de_AttributeMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_AttributeValue(core.awsExpectUnion(value), context);
        return acc;
    }, {});
};
const de_AttributeValue = (output, context) => {
    if (output.B != null) {
        return {
            B: context.base64Decoder(output.B),
        };
    }
    if (smithyClient.expectBoolean(output.BOOL) !== undefined) {
        return { BOOL: smithyClient.expectBoolean(output.BOOL) };
    }
    if (output.BS != null) {
        return {
            BS: de_BinarySetAttributeValue(output.BS, context),
        };
    }
    if (output.L != null) {
        return {
            L: de_ListAttributeValue(output.L, context),
        };
    }
    if (output.M != null) {
        return {
            M: de_MapAttributeValue(output.M, context),
        };
    }
    if (smithyClient.expectString(output.N) !== undefined) {
        return { N: smithyClient.expectString(output.N) };
    }
    if (output.NS != null) {
        return {
            NS: smithyClient._json(output.NS),
        };
    }
    if (smithyClient.expectBoolean(output.NULL) !== undefined) {
        return { NULL: smithyClient.expectBoolean(output.NULL) };
    }
    if (smithyClient.expectString(output.S) !== undefined) {
        return { S: smithyClient.expectString(output.S) };
    }
    if (output.SS != null) {
        return {
            SS: smithyClient._json(output.SS),
        };
    }
    return { $unknown: Object.entries(output)[0] };
};
const de_AutoScalingPolicyDescription = (output, context) => {
    return smithyClient.take(output, {
        PolicyName: smithyClient.expectString,
        TargetTrackingScalingPolicyConfiguration: (_) => de_AutoScalingTargetTrackingScalingPolicyConfigurationDescription(_),
    });
};
const de_AutoScalingPolicyDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_AutoScalingPolicyDescription(entry);
    });
    return retVal;
};
const de_AutoScalingSettingsDescription = (output, context) => {
    return smithyClient.take(output, {
        AutoScalingDisabled: smithyClient.expectBoolean,
        AutoScalingRoleArn: smithyClient.expectString,
        MaximumUnits: smithyClient.expectLong,
        MinimumUnits: smithyClient.expectLong,
        ScalingPolicies: (_) => de_AutoScalingPolicyDescriptionList(_),
    });
};
const de_AutoScalingTargetTrackingScalingPolicyConfigurationDescription = (output, context) => {
    return smithyClient.take(output, {
        DisableScaleIn: smithyClient.expectBoolean,
        ScaleInCooldown: smithyClient.expectInt32,
        ScaleOutCooldown: smithyClient.expectInt32,
        TargetValue: smithyClient.limitedParseDouble,
    });
};
const de_BackupDescription = (output, context) => {
    return smithyClient.take(output, {
        BackupDetails: (_) => de_BackupDetails(_),
        SourceTableDetails: (_) => de_SourceTableDetails(_),
        SourceTableFeatureDetails: (_) => de_SourceTableFeatureDetails(_),
    });
};
const de_BackupDetails = (output, context) => {
    return smithyClient.take(output, {
        BackupArn: smithyClient.expectString,
        BackupCreationDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        BackupExpiryDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        BackupName: smithyClient.expectString,
        BackupSizeBytes: smithyClient.expectLong,
        BackupStatus: smithyClient.expectString,
        BackupType: smithyClient.expectString,
    });
};
const de_BackupSummaries = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_BackupSummary(entry);
    });
    return retVal;
};
const de_BackupSummary = (output, context) => {
    return smithyClient.take(output, {
        BackupArn: smithyClient.expectString,
        BackupCreationDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        BackupExpiryDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        BackupName: smithyClient.expectString,
        BackupSizeBytes: smithyClient.expectLong,
        BackupStatus: smithyClient.expectString,
        BackupType: smithyClient.expectString,
        TableArn: smithyClient.expectString,
        TableId: smithyClient.expectString,
        TableName: smithyClient.expectString,
    });
};
const de_BatchExecuteStatementOutput = (output, context) => {
    return smithyClient.take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_),
        Responses: (_) => de_PartiQLBatchResponse(_, context),
    });
};
const de_BatchGetItemOutput = (output, context) => {
    return smithyClient.take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_),
        Responses: (_) => de_BatchGetResponseMap(_, context),
        UnprocessedKeys: (_) => de_BatchGetRequestMap(_, context),
    });
};
const de_BatchGetRequestMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_KeysAndAttributes(value, context);
        return acc;
    }, {});
};
const de_BatchGetResponseMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_ItemList(value, context);
        return acc;
    }, {});
};
const de_BatchStatementError = (output, context) => {
    return smithyClient.take(output, {
        Code: smithyClient.expectString,
        Item: (_) => de_AttributeMap(_, context),
        Message: smithyClient.expectString,
    });
};
const de_BatchStatementResponse = (output, context) => {
    return smithyClient.take(output, {
        Error: (_) => de_BatchStatementError(_, context),
        Item: (_) => de_AttributeMap(_, context),
        TableName: smithyClient.expectString,
    });
};
const de_BatchWriteItemOutput = (output, context) => {
    return smithyClient.take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_),
        ItemCollectionMetrics: (_) => de_ItemCollectionMetricsPerTable(_, context),
        UnprocessedItems: (_) => de_BatchWriteItemRequestMap(_, context),
    });
};
const de_BatchWriteItemRequestMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_WriteRequests(value, context);
        return acc;
    }, {});
};
const de_BillingModeSummary = (output, context) => {
    return smithyClient.take(output, {
        BillingMode: smithyClient.expectString,
        LastUpdateToPayPerRequestDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
    });
};
const de_BinarySetAttributeValue = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return context.base64Decoder(entry);
    });
    return retVal;
};
const de_CancellationReason = (output, context) => {
    return smithyClient.take(output, {
        Code: smithyClient.expectString,
        Item: (_) => de_AttributeMap(_, context),
        Message: smithyClient.expectString,
    });
};
const de_CancellationReasonList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_CancellationReason(entry, context);
    });
    return retVal;
};
const de_Capacity = (output, context) => {
    return smithyClient.take(output, {
        CapacityUnits: smithyClient.limitedParseDouble,
        ReadCapacityUnits: smithyClient.limitedParseDouble,
        WriteCapacityUnits: smithyClient.limitedParseDouble,
    });
};
const de_ConditionalCheckFailedException = (output, context) => {
    return smithyClient.take(output, {
        Item: (_) => de_AttributeMap(_, context),
        message: smithyClient.expectString,
    });
};
const de_ConsumedCapacity = (output, context) => {
    return smithyClient.take(output, {
        CapacityUnits: smithyClient.limitedParseDouble,
        GlobalSecondaryIndexes: (_) => de_SecondaryIndexesCapacityMap(_),
        LocalSecondaryIndexes: (_) => de_SecondaryIndexesCapacityMap(_),
        ReadCapacityUnits: smithyClient.limitedParseDouble,
        Table: (_) => de_Capacity(_),
        TableName: smithyClient.expectString,
        WriteCapacityUnits: smithyClient.limitedParseDouble,
    });
};
const de_ConsumedCapacityMultiple = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ConsumedCapacity(entry);
    });
    return retVal;
};
const de_ContinuousBackupsDescription = (output, context) => {
    return smithyClient.take(output, {
        ContinuousBackupsStatus: smithyClient.expectString,
        PointInTimeRecoveryDescription: (_) => de_PointInTimeRecoveryDescription(_),
    });
};
const de_CreateBackupOutput = (output, context) => {
    return smithyClient.take(output, {
        BackupDetails: (_) => de_BackupDetails(_),
    });
};
const de_CreateGlobalTableOutput = (output, context) => {
    return smithyClient.take(output, {
        GlobalTableDescription: (_) => de_GlobalTableDescription(_),
    });
};
const de_CreateTableOutput = (output, context) => {
    return smithyClient.take(output, {
        TableDescription: (_) => de_TableDescription(_),
    });
};
const de_DeleteBackupOutput = (output, context) => {
    return smithyClient.take(output, {
        BackupDescription: (_) => de_BackupDescription(_),
    });
};
const de_DeleteItemOutput = (output, context) => {
    return smithyClient.take(output, {
        Attributes: (_) => de_AttributeMap(_, context),
        ConsumedCapacity: (_) => de_ConsumedCapacity(_),
        ItemCollectionMetrics: (_) => de_ItemCollectionMetrics(_, context),
    });
};
const de_DeleteRequest = (output, context) => {
    return smithyClient.take(output, {
        Key: (_) => de_Key(_, context),
    });
};
const de_DeleteTableOutput = (output, context) => {
    return smithyClient.take(output, {
        TableDescription: (_) => de_TableDescription(_),
    });
};
const de_DescribeBackupOutput = (output, context) => {
    return smithyClient.take(output, {
        BackupDescription: (_) => de_BackupDescription(_),
    });
};
const de_DescribeContinuousBackupsOutput = (output, context) => {
    return smithyClient.take(output, {
        ContinuousBackupsDescription: (_) => de_ContinuousBackupsDescription(_),
    });
};
const de_DescribeContributorInsightsOutput = (output, context) => {
    return smithyClient.take(output, {
        ContributorInsightsMode: smithyClient.expectString,
        ContributorInsightsRuleList: smithyClient._json,
        ContributorInsightsStatus: smithyClient.expectString,
        FailureException: smithyClient._json,
        IndexName: smithyClient.expectString,
        LastUpdateDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        TableName: smithyClient.expectString,
    });
};
const de_DescribeExportOutput = (output, context) => {
    return smithyClient.take(output, {
        ExportDescription: (_) => de_ExportDescription(_),
    });
};
const de_DescribeGlobalTableOutput = (output, context) => {
    return smithyClient.take(output, {
        GlobalTableDescription: (_) => de_GlobalTableDescription(_),
    });
};
const de_DescribeGlobalTableSettingsOutput = (output, context) => {
    return smithyClient.take(output, {
        GlobalTableName: smithyClient.expectString,
        ReplicaSettings: (_) => de_ReplicaSettingsDescriptionList(_),
    });
};
const de_DescribeImportOutput = (output, context) => {
    return smithyClient.take(output, {
        ImportTableDescription: (_) => de_ImportTableDescription(_),
    });
};
const de_DescribeTableOutput = (output, context) => {
    return smithyClient.take(output, {
        Table: (_) => de_TableDescription(_),
    });
};
const de_DescribeTableReplicaAutoScalingOutput = (output, context) => {
    return smithyClient.take(output, {
        TableAutoScalingDescription: (_) => de_TableAutoScalingDescription(_),
    });
};
const de_ExecuteStatementOutput = (output, context) => {
    return smithyClient.take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacity(_),
        Items: (_) => de_ItemList(_, context),
        LastEvaluatedKey: (_) => de_Key(_, context),
        NextToken: smithyClient.expectString,
    });
};
const de_ExecuteTransactionOutput = (output, context) => {
    return smithyClient.take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_),
        Responses: (_) => de_ItemResponseList(_, context),
    });
};
const de_ExportDescription = (output, context) => {
    return smithyClient.take(output, {
        BilledSizeBytes: smithyClient.expectLong,
        ClientToken: smithyClient.expectString,
        EndTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        ExportArn: smithyClient.expectString,
        ExportFormat: smithyClient.expectString,
        ExportManifest: smithyClient.expectString,
        ExportStatus: smithyClient.expectString,
        ExportTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        ExportType: smithyClient.expectString,
        FailureCode: smithyClient.expectString,
        FailureMessage: smithyClient.expectString,
        IncrementalExportSpecification: (_) => de_IncrementalExportSpecification(_),
        ItemCount: smithyClient.expectLong,
        S3Bucket: smithyClient.expectString,
        S3BucketOwner: smithyClient.expectString,
        S3Prefix: smithyClient.expectString,
        S3SseAlgorithm: smithyClient.expectString,
        S3SseKmsKeyId: smithyClient.expectString,
        StartTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        TableArn: smithyClient.expectString,
        TableId: smithyClient.expectString,
    });
};
const de_ExportTableToPointInTimeOutput = (output, context) => {
    return smithyClient.take(output, {
        ExportDescription: (_) => de_ExportDescription(_),
    });
};
const de_GetItemOutput = (output, context) => {
    return smithyClient.take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacity(_),
        Item: (_) => de_AttributeMap(_, context),
    });
};
const de_GlobalSecondaryIndexDescription = (output, context) => {
    return smithyClient.take(output, {
        Backfilling: smithyClient.expectBoolean,
        IndexArn: smithyClient.expectString,
        IndexName: smithyClient.expectString,
        IndexSizeBytes: smithyClient.expectLong,
        IndexStatus: smithyClient.expectString,
        ItemCount: smithyClient.expectLong,
        KeySchema: smithyClient._json,
        OnDemandThroughput: smithyClient._json,
        Projection: smithyClient._json,
        ProvisionedThroughput: (_) => de_ProvisionedThroughputDescription(_),
        WarmThroughput: smithyClient._json,
    });
};
const de_GlobalSecondaryIndexDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_GlobalSecondaryIndexDescription(entry);
    });
    return retVal;
};
const de_GlobalTableDescription = (output, context) => {
    return smithyClient.take(output, {
        CreationDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        GlobalTableArn: smithyClient.expectString,
        GlobalTableName: smithyClient.expectString,
        GlobalTableStatus: smithyClient.expectString,
        ReplicationGroup: (_) => de_ReplicaDescriptionList(_),
    });
};
const de_ImportSummary = (output, context) => {
    return smithyClient.take(output, {
        CloudWatchLogGroupArn: smithyClient.expectString,
        EndTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        ImportArn: smithyClient.expectString,
        ImportStatus: smithyClient.expectString,
        InputFormat: smithyClient.expectString,
        S3BucketSource: smithyClient._json,
        StartTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        TableArn: smithyClient.expectString,
    });
};
const de_ImportSummaryList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ImportSummary(entry);
    });
    return retVal;
};
const de_ImportTableDescription = (output, context) => {
    return smithyClient.take(output, {
        ClientToken: smithyClient.expectString,
        CloudWatchLogGroupArn: smithyClient.expectString,
        EndTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        ErrorCount: smithyClient.expectLong,
        FailureCode: smithyClient.expectString,
        FailureMessage: smithyClient.expectString,
        ImportArn: smithyClient.expectString,
        ImportStatus: smithyClient.expectString,
        ImportedItemCount: smithyClient.expectLong,
        InputCompressionType: smithyClient.expectString,
        InputFormat: smithyClient.expectString,
        InputFormatOptions: smithyClient._json,
        ProcessedItemCount: smithyClient.expectLong,
        ProcessedSizeBytes: smithyClient.expectLong,
        S3BucketSource: smithyClient._json,
        StartTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        TableArn: smithyClient.expectString,
        TableCreationParameters: smithyClient._json,
        TableId: smithyClient.expectString,
    });
};
const de_ImportTableOutput = (output, context) => {
    return smithyClient.take(output, {
        ImportTableDescription: (_) => de_ImportTableDescription(_),
    });
};
const de_IncrementalExportSpecification = (output, context) => {
    return smithyClient.take(output, {
        ExportFromTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        ExportToTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        ExportViewType: smithyClient.expectString,
    });
};
const de_ItemCollectionKeyAttributeMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_AttributeValue(core.awsExpectUnion(value), context);
        return acc;
    }, {});
};
const de_ItemCollectionMetrics = (output, context) => {
    return smithyClient.take(output, {
        ItemCollectionKey: (_) => de_ItemCollectionKeyAttributeMap(_, context),
        SizeEstimateRangeGB: (_) => de_ItemCollectionSizeEstimateRange(_),
    });
};
const de_ItemCollectionMetricsMultiple = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ItemCollectionMetrics(entry, context);
    });
    return retVal;
};
const de_ItemCollectionMetricsPerTable = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_ItemCollectionMetricsMultiple(value, context);
        return acc;
    }, {});
};
const de_ItemCollectionSizeEstimateRange = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return smithyClient.limitedParseDouble(entry);
    });
    return retVal;
};
const de_ItemList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_AttributeMap(entry, context);
    });
    return retVal;
};
const de_ItemResponse = (output, context) => {
    return smithyClient.take(output, {
        Item: (_) => de_AttributeMap(_, context),
    });
};
const de_ItemResponseList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ItemResponse(entry, context);
    });
    return retVal;
};
const de_Key = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_AttributeValue(core.awsExpectUnion(value), context);
        return acc;
    }, {});
};
const de_KeyList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_Key(entry, context);
    });
    return retVal;
};
const de_KeysAndAttributes = (output, context) => {
    return smithyClient.take(output, {
        AttributesToGet: smithyClient._json,
        ConsistentRead: smithyClient.expectBoolean,
        ExpressionAttributeNames: smithyClient._json,
        Keys: (_) => de_KeyList(_, context),
        ProjectionExpression: smithyClient.expectString,
    });
};
const de_ListAttributeValue = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_AttributeValue(core.awsExpectUnion(entry), context);
    });
    return retVal;
};
const de_ListBackupsOutput = (output, context) => {
    return smithyClient.take(output, {
        BackupSummaries: (_) => de_BackupSummaries(_),
        LastEvaluatedBackupArn: smithyClient.expectString,
    });
};
const de_ListImportsOutput = (output, context) => {
    return smithyClient.take(output, {
        ImportSummaryList: (_) => de_ImportSummaryList(_),
        NextToken: smithyClient.expectString,
    });
};
const de_MapAttributeValue = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_AttributeValue(core.awsExpectUnion(value), context);
        return acc;
    }, {});
};
const de_PartiQLBatchResponse = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_BatchStatementResponse(entry, context);
    });
    return retVal;
};
const de_PointInTimeRecoveryDescription = (output, context) => {
    return smithyClient.take(output, {
        EarliestRestorableDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        LatestRestorableDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        PointInTimeRecoveryStatus: smithyClient.expectString,
        RecoveryPeriodInDays: smithyClient.expectInt32,
    });
};
const de_ProvisionedThroughputDescription = (output, context) => {
    return smithyClient.take(output, {
        LastDecreaseDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        LastIncreaseDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        NumberOfDecreasesToday: smithyClient.expectLong,
        ReadCapacityUnits: smithyClient.expectLong,
        WriteCapacityUnits: smithyClient.expectLong,
    });
};
const de_PutItemInputAttributeMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_AttributeValue(core.awsExpectUnion(value), context);
        return acc;
    }, {});
};
const de_PutItemOutput = (output, context) => {
    return smithyClient.take(output, {
        Attributes: (_) => de_AttributeMap(_, context),
        ConsumedCapacity: (_) => de_ConsumedCapacity(_),
        ItemCollectionMetrics: (_) => de_ItemCollectionMetrics(_, context),
    });
};
const de_PutRequest = (output, context) => {
    return smithyClient.take(output, {
        Item: (_) => de_PutItemInputAttributeMap(_, context),
    });
};
const de_QueryOutput = (output, context) => {
    return smithyClient.take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacity(_),
        Count: smithyClient.expectInt32,
        Items: (_) => de_ItemList(_, context),
        LastEvaluatedKey: (_) => de_Key(_, context),
        ScannedCount: smithyClient.expectInt32,
    });
};
const de_ReplicaAutoScalingDescription = (output, context) => {
    return smithyClient.take(output, {
        GlobalSecondaryIndexes: (_) => de_ReplicaGlobalSecondaryIndexAutoScalingDescriptionList(_),
        RegionName: smithyClient.expectString,
        ReplicaProvisionedReadCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_),
        ReplicaProvisionedWriteCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_),
        ReplicaStatus: smithyClient.expectString,
    });
};
const de_ReplicaAutoScalingDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ReplicaAutoScalingDescription(entry);
    });
    return retVal;
};
const de_ReplicaDescription = (output, context) => {
    return smithyClient.take(output, {
        GlobalSecondaryIndexes: smithyClient._json,
        KMSMasterKeyId: smithyClient.expectString,
        OnDemandThroughputOverride: smithyClient._json,
        ProvisionedThroughputOverride: smithyClient._json,
        RegionName: smithyClient.expectString,
        ReplicaInaccessibleDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        ReplicaStatus: smithyClient.expectString,
        ReplicaStatusDescription: smithyClient.expectString,
        ReplicaStatusPercentProgress: smithyClient.expectString,
        ReplicaTableClassSummary: (_) => de_TableClassSummary(_),
        WarmThroughput: smithyClient._json,
    });
};
const de_ReplicaDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ReplicaDescription(entry);
    });
    return retVal;
};
const de_ReplicaGlobalSecondaryIndexAutoScalingDescription = (output, context) => {
    return smithyClient.take(output, {
        IndexName: smithyClient.expectString,
        IndexStatus: smithyClient.expectString,
        ProvisionedReadCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_),
        ProvisionedWriteCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_),
    });
};
const de_ReplicaGlobalSecondaryIndexAutoScalingDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ReplicaGlobalSecondaryIndexAutoScalingDescription(entry);
    });
    return retVal;
};
const de_ReplicaGlobalSecondaryIndexSettingsDescription = (output, context) => {
    return smithyClient.take(output, {
        IndexName: smithyClient.expectString,
        IndexStatus: smithyClient.expectString,
        ProvisionedReadCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_),
        ProvisionedReadCapacityUnits: smithyClient.expectLong,
        ProvisionedWriteCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_),
        ProvisionedWriteCapacityUnits: smithyClient.expectLong,
    });
};
const de_ReplicaGlobalSecondaryIndexSettingsDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ReplicaGlobalSecondaryIndexSettingsDescription(entry);
    });
    return retVal;
};
const de_ReplicaSettingsDescription = (output, context) => {
    return smithyClient.take(output, {
        RegionName: smithyClient.expectString,
        ReplicaBillingModeSummary: (_) => de_BillingModeSummary(_),
        ReplicaGlobalSecondaryIndexSettings: (_) => de_ReplicaGlobalSecondaryIndexSettingsDescriptionList(_),
        ReplicaProvisionedReadCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_),
        ReplicaProvisionedReadCapacityUnits: smithyClient.expectLong,
        ReplicaProvisionedWriteCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_),
        ReplicaProvisionedWriteCapacityUnits: smithyClient.expectLong,
        ReplicaStatus: smithyClient.expectString,
        ReplicaTableClassSummary: (_) => de_TableClassSummary(_),
    });
};
const de_ReplicaSettingsDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ReplicaSettingsDescription(entry);
    });
    return retVal;
};
const de_RestoreSummary = (output, context) => {
    return smithyClient.take(output, {
        RestoreDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        RestoreInProgress: smithyClient.expectBoolean,
        SourceBackupArn: smithyClient.expectString,
        SourceTableArn: smithyClient.expectString,
    });
};
const de_RestoreTableFromBackupOutput = (output, context) => {
    return smithyClient.take(output, {
        TableDescription: (_) => de_TableDescription(_),
    });
};
const de_RestoreTableToPointInTimeOutput = (output, context) => {
    return smithyClient.take(output, {
        TableDescription: (_) => de_TableDescription(_),
    });
};
const de_ScanOutput = (output, context) => {
    return smithyClient.take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacity(_),
        Count: smithyClient.expectInt32,
        Items: (_) => de_ItemList(_, context),
        LastEvaluatedKey: (_) => de_Key(_, context),
        ScannedCount: smithyClient.expectInt32,
    });
};
const de_SecondaryIndexesCapacityMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_Capacity(value);
        return acc;
    }, {});
};
const de_SourceTableDetails = (output, context) => {
    return smithyClient.take(output, {
        BillingMode: smithyClient.expectString,
        ItemCount: smithyClient.expectLong,
        KeySchema: smithyClient._json,
        OnDemandThroughput: smithyClient._json,
        ProvisionedThroughput: smithyClient._json,
        TableArn: smithyClient.expectString,
        TableCreationDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        TableId: smithyClient.expectString,
        TableName: smithyClient.expectString,
        TableSizeBytes: smithyClient.expectLong,
    });
};
const de_SourceTableFeatureDetails = (output, context) => {
    return smithyClient.take(output, {
        GlobalSecondaryIndexes: smithyClient._json,
        LocalSecondaryIndexes: smithyClient._json,
        SSEDescription: (_) => de_SSEDescription(_),
        StreamDescription: smithyClient._json,
        TimeToLiveDescription: smithyClient._json,
    });
};
const de_SSEDescription = (output, context) => {
    return smithyClient.take(output, {
        InaccessibleEncryptionDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        KMSMasterKeyArn: smithyClient.expectString,
        SSEType: smithyClient.expectString,
        Status: smithyClient.expectString,
    });
};
const de_TableAutoScalingDescription = (output, context) => {
    return smithyClient.take(output, {
        Replicas: (_) => de_ReplicaAutoScalingDescriptionList(_),
        TableName: smithyClient.expectString,
        TableStatus: smithyClient.expectString,
    });
};
const de_TableClassSummary = (output, context) => {
    return smithyClient.take(output, {
        LastUpdateDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        TableClass: smithyClient.expectString,
    });
};
const de_TableDescription = (output, context) => {
    return smithyClient.take(output, {
        ArchivalSummary: (_) => de_ArchivalSummary(_),
        AttributeDefinitions: smithyClient._json,
        BillingModeSummary: (_) => de_BillingModeSummary(_),
        CreationDateTime: (_) => smithyClient.expectNonNull(smithyClient.parseEpochTimestamp(smithyClient.expectNumber(_))),
        DeletionProtectionEnabled: smithyClient.expectBoolean,
        GlobalSecondaryIndexes: (_) => de_GlobalSecondaryIndexDescriptionList(_),
        GlobalTableVersion: smithyClient.expectString,
        GlobalTableWitnesses: smithyClient._json,
        ItemCount: smithyClient.expectLong,
        KeySchema: smithyClient._json,
        LatestStreamArn: smithyClient.expectString,
        LatestStreamLabel: smithyClient.expectString,
        LocalSecondaryIndexes: smithyClient._json,
        MultiRegionConsistency: smithyClient.expectString,
        OnDemandThroughput: smithyClient._json,
        ProvisionedThroughput: (_) => de_ProvisionedThroughputDescription(_),
        Replicas: (_) => de_ReplicaDescriptionList(_),
        RestoreSummary: (_) => de_RestoreSummary(_),
        SSEDescription: (_) => de_SSEDescription(_),
        StreamSpecification: smithyClient._json,
        TableArn: smithyClient.expectString,
        TableClassSummary: (_) => de_TableClassSummary(_),
        TableId: smithyClient.expectString,
        TableName: smithyClient.expectString,
        TableSizeBytes: smithyClient.expectLong,
        TableStatus: smithyClient.expectString,
        WarmThroughput: smithyClient._json,
    });
};
const de_TransactGetItemsOutput = (output, context) => {
    return smithyClient.take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_),
        Responses: (_) => de_ItemResponseList(_, context),
    });
};
const de_TransactionCanceledException = (output, context) => {
    return smithyClient.take(output, {
        CancellationReasons: (_) => de_CancellationReasonList(_, context),
        Message: smithyClient.expectString,
    });
};
const de_TransactWriteItemsOutput = (output, context) => {
    return smithyClient.take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_),
        ItemCollectionMetrics: (_) => de_ItemCollectionMetricsPerTable(_, context),
    });
};
const de_UpdateContinuousBackupsOutput = (output, context) => {
    return smithyClient.take(output, {
        ContinuousBackupsDescription: (_) => de_ContinuousBackupsDescription(_),
    });
};
const de_UpdateGlobalTableOutput = (output, context) => {
    return smithyClient.take(output, {
        GlobalTableDescription: (_) => de_GlobalTableDescription(_),
    });
};
const de_UpdateGlobalTableSettingsOutput = (output, context) => {
    return smithyClient.take(output, {
        GlobalTableName: smithyClient.expectString,
        ReplicaSettings: (_) => de_ReplicaSettingsDescriptionList(_),
    });
};
const de_UpdateItemOutput = (output, context) => {
    return smithyClient.take(output, {
        Attributes: (_) => de_AttributeMap(_, context),
        ConsumedCapacity: (_) => de_ConsumedCapacity(_),
        ItemCollectionMetrics: (_) => de_ItemCollectionMetrics(_, context),
    });
};
const de_UpdateTableOutput = (output, context) => {
    return smithyClient.take(output, {
        TableDescription: (_) => de_TableDescription(_),
    });
};
const de_UpdateTableReplicaAutoScalingOutput = (output, context) => {
    return smithyClient.take(output, {
        TableAutoScalingDescription: (_) => de_TableAutoScalingDescription(_),
    });
};
const de_WriteRequest = (output, context) => {
    return smithyClient.take(output, {
        DeleteRequest: (_) => de_DeleteRequest(_, context),
        PutRequest: (_) => de_PutRequest(_, context),
    });
};
const de_WriteRequests = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_WriteRequest(entry, context);
    });
    return retVal;
};
const deserializeMetadata = (output) => ({
    httpStatusCode: output.statusCode,
    requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
    extendedRequestId: output.headers["x-amz-id-2"],
    cfId: output.headers["x-amz-cf-id"],
});
const throwDefaultError = smithyClient.withBaseException(DynamoDBServiceException);
const buildHttpRpcRequest = async (context, headers, path, resolvedHostname, body) => {
    const { hostname, protocol = "https", port, path: basePath } = await context.endpoint();
    const contents = {
        protocol,
        hostname,
        port,
        method: "POST",
        path: basePath.endsWith("/") ? basePath.slice(0, -1) + path : basePath + path,
        headers,
    };
    if (body !== undefined) {
        contents.body = body;
    }
    return new protocolHttp.HttpRequest(contents);
};
function sharedHeaders(operation) {
    return {
        "content-type": "application/x-amz-json-1.0",
        "x-amz-target": `DynamoDB_20120810.${operation}`,
    };
}

class DescribeEndpointsCommand extends smithyClient.Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeEndpoints", {})
    .n("DynamoDBClient", "DescribeEndpointsCommand")
    .f(void 0, void 0)
    .ser(se_DescribeEndpointsCommand)
    .de(de_DescribeEndpointsCommand)
    .build() {
}

const getHttpAuthExtensionConfiguration = (runtimeConfig) => {
    const _httpAuthSchemes = runtimeConfig.httpAuthSchemes;
    let _httpAuthSchemeProvider = runtimeConfig.httpAuthSchemeProvider;
    let _credentials = runtimeConfig.credentials;
    return {
        setHttpAuthScheme(httpAuthScheme) {
            const index = _httpAuthSchemes.findIndex((scheme) => scheme.schemeId === httpAuthScheme.schemeId);
            if (index === -1) {
                _httpAuthSchemes.push(httpAuthScheme);
            }
            else {
                _httpAuthSchemes.splice(index, 1, httpAuthScheme);
            }
        },
        httpAuthSchemes() {
            return _httpAuthSchemes;
        },
        setHttpAuthSchemeProvider(httpAuthSchemeProvider) {
            _httpAuthSchemeProvider = httpAuthSchemeProvider;
        },
        httpAuthSchemeProvider() {
            return _httpAuthSchemeProvider;
        },
        setCredentials(credentials) {
            _credentials = credentials;
        },
        credentials() {
            return _credentials;
        },
    };
};
const resolveHttpAuthRuntimeConfig = (config) => {
    return {
        httpAuthSchemes: config.httpAuthSchemes(),
        httpAuthSchemeProvider: config.httpAuthSchemeProvider(),
        credentials: config.credentials(),
    };
};

const resolveRuntimeExtensions = (runtimeConfig, extensions) => {
    const extensionConfiguration = Object.assign(regionConfigResolver.getAwsRegionExtensionConfiguration(runtimeConfig), smithyClient.getDefaultExtensionConfiguration(runtimeConfig), protocolHttp.getHttpHandlerExtensionConfiguration(runtimeConfig), getHttpAuthExtensionConfiguration(runtimeConfig));
    extensions.forEach((extension) => extension.configure(extensionConfiguration));
    return Object.assign(runtimeConfig, regionConfigResolver.resolveAwsRegionExtensionConfiguration(extensionConfiguration), smithyClient.resolveDefaultRuntimeConfig(extensionConfiguration), protocolHttp.resolveHttpHandlerRuntimeConfig(extensionConfiguration), resolveHttpAuthRuntimeConfig(extensionConfiguration));
};

class DynamoDBClient extends smithyClient.Client {
    config;
    constructor(...[configuration]) {
        const _config_0 = runtimeConfig.getRuntimeConfig(configuration || {});
        super(_config_0);
        this.initConfig = _config_0;
        const _config_1 = resolveClientEndpointParameters(_config_0);
        const _config_2 = accountIdEndpoint.resolveAccountIdEndpointModeConfig(_config_1);
        const _config_3 = middlewareUserAgent.resolveUserAgentConfig(_config_2);
        const _config_4 = middlewareRetry.resolveRetryConfig(_config_3);
        const _config_5 = configResolver.resolveRegionConfig(_config_4);
        const _config_6 = middlewareHostHeader.resolveHostHeaderConfig(_config_5);
        const _config_7 = middlewareEndpoint.resolveEndpointConfig(_config_6);
        const _config_8 = httpAuthSchemeProvider.resolveHttpAuthSchemeConfig(_config_7);
        const _config_9 = middlewareEndpointDiscovery.resolveEndpointDiscoveryConfig(_config_8, {
            endpointDiscoveryCommandCtor: DescribeEndpointsCommand,
        });
        const _config_10 = resolveRuntimeExtensions(_config_9, configuration?.extensions || []);
        this.config = _config_10;
        this.middlewareStack.use(middlewareUserAgent.getUserAgentPlugin(this.config));
        this.middlewareStack.use(middlewareRetry.getRetryPlugin(this.config));
        this.middlewareStack.use(middlewareContentLength.getContentLengthPlugin(this.config));
        this.middlewareStack.use(middlewareHostHeader.getHostHeaderPlugin(this.config));
        this.middlewareStack.use(middlewareLogger.getLoggerPlugin(this.config));
        this.middlewareStack.use(middlewareRecursionDetection.getRecursionDetectionPlugin(this.config));
        this.middlewareStack.use(core$1.getHttpAuthSchemeEndpointRuleSetPlugin(this.config, {
            httpAuthSchemeParametersProvider: httpAuthSchemeProvider.defaultDynamoDBHttpAuthSchemeParametersProvider,
            identityProviderConfigProvider: async (config) => new core$1.DefaultIdentityProviderConfig({
                "aws.auth#sigv4": config.credentials,
            }),
        }));
        this.middlewareStack.use(core$1.getHttpSigningPlugin(this.config));
    }
    destroy() {
        super.destroy();
    }
}

class BatchExecuteStatementCommand extends smithyClient.Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "BatchExecuteStatement", {})
    .n("DynamoDBClient", "BatchExecuteStatementCommand")
    .f(void 0, void 0)
    .ser(se_BatchExecuteStatementCommand)
    .de(de_BatchExecuteStatementCommand)
    .build() {
}

class BatchGetItemCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArnList: { type: "operationContextParams", get: (input) => Object.keys(input?.RequestItems ?? {}) },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "BatchGetItem", {})
    .n("DynamoDBClient", "BatchGetItemCommand")
    .f(void 0, void 0)
    .ser(se_BatchGetItemCommand)
    .de(de_BatchGetItemCommand)
    .build() {
}

class BatchWriteItemCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArnList: { type: "operationContextParams", get: (input) => Object.keys(input?.RequestItems ?? {}) },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "BatchWriteItem", {})
    .n("DynamoDBClient", "BatchWriteItemCommand")
    .f(void 0, void 0)
    .ser(se_BatchWriteItemCommand)
    .de(de_BatchWriteItemCommand)
    .build() {
}

class CreateBackupCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "CreateBackup", {})
    .n("DynamoDBClient", "CreateBackupCommand")
    .f(void 0, void 0)
    .ser(se_CreateBackupCommand)
    .de(de_CreateBackupCommand)
    .build() {
}

class CreateGlobalTableCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "GlobalTableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "CreateGlobalTable", {})
    .n("DynamoDBClient", "CreateGlobalTableCommand")
    .f(void 0, void 0)
    .ser(se_CreateGlobalTableCommand)
    .de(de_CreateGlobalTableCommand)
    .build() {
}

class CreateTableCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "CreateTable", {})
    .n("DynamoDBClient", "CreateTableCommand")
    .f(void 0, void 0)
    .ser(se_CreateTableCommand)
    .de(de_CreateTableCommand)
    .build() {
}

class DeleteBackupCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "BackupArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DeleteBackup", {})
    .n("DynamoDBClient", "DeleteBackupCommand")
    .f(void 0, void 0)
    .ser(se_DeleteBackupCommand)
    .de(de_DeleteBackupCommand)
    .build() {
}

class DeleteItemCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DeleteItem", {})
    .n("DynamoDBClient", "DeleteItemCommand")
    .f(void 0, void 0)
    .ser(se_DeleteItemCommand)
    .de(de_DeleteItemCommand)
    .build() {
}

class DeleteResourcePolicyCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "ResourceArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DeleteResourcePolicy", {})
    .n("DynamoDBClient", "DeleteResourcePolicyCommand")
    .f(void 0, void 0)
    .ser(se_DeleteResourcePolicyCommand)
    .de(de_DeleteResourcePolicyCommand)
    .build() {
}

class DeleteTableCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DeleteTable", {})
    .n("DynamoDBClient", "DeleteTableCommand")
    .f(void 0, void 0)
    .ser(se_DeleteTableCommand)
    .de(de_DeleteTableCommand)
    .build() {
}

class DescribeBackupCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "BackupArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeBackup", {})
    .n("DynamoDBClient", "DescribeBackupCommand")
    .f(void 0, void 0)
    .ser(se_DescribeBackupCommand)
    .de(de_DescribeBackupCommand)
    .build() {
}

class DescribeContinuousBackupsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeContinuousBackups", {})
    .n("DynamoDBClient", "DescribeContinuousBackupsCommand")
    .f(void 0, void 0)
    .ser(se_DescribeContinuousBackupsCommand)
    .de(de_DescribeContinuousBackupsCommand)
    .build() {
}

class DescribeContributorInsightsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeContributorInsights", {})
    .n("DynamoDBClient", "DescribeContributorInsightsCommand")
    .f(void 0, void 0)
    .ser(se_DescribeContributorInsightsCommand)
    .de(de_DescribeContributorInsightsCommand)
    .build() {
}

class DescribeExportCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "ExportArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeExport", {})
    .n("DynamoDBClient", "DescribeExportCommand")
    .f(void 0, void 0)
    .ser(se_DescribeExportCommand)
    .de(de_DescribeExportCommand)
    .build() {
}

class DescribeGlobalTableCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "GlobalTableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeGlobalTable", {})
    .n("DynamoDBClient", "DescribeGlobalTableCommand")
    .f(void 0, void 0)
    .ser(se_DescribeGlobalTableCommand)
    .de(de_DescribeGlobalTableCommand)
    .build() {
}

class DescribeGlobalTableSettingsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "GlobalTableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeGlobalTableSettings", {})
    .n("DynamoDBClient", "DescribeGlobalTableSettingsCommand")
    .f(void 0, void 0)
    .ser(se_DescribeGlobalTableSettingsCommand)
    .de(de_DescribeGlobalTableSettingsCommand)
    .build() {
}

class DescribeImportCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "ImportArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeImport", {})
    .n("DynamoDBClient", "DescribeImportCommand")
    .f(void 0, void 0)
    .ser(se_DescribeImportCommand)
    .de(de_DescribeImportCommand)
    .build() {
}

class DescribeKinesisStreamingDestinationCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeKinesisStreamingDestination", {})
    .n("DynamoDBClient", "DescribeKinesisStreamingDestinationCommand")
    .f(void 0, void 0)
    .ser(se_DescribeKinesisStreamingDestinationCommand)
    .de(de_DescribeKinesisStreamingDestinationCommand)
    .build() {
}

class DescribeLimitsCommand extends smithyClient.Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeLimits", {})
    .n("DynamoDBClient", "DescribeLimitsCommand")
    .f(void 0, void 0)
    .ser(se_DescribeLimitsCommand)
    .de(de_DescribeLimitsCommand)
    .build() {
}

class DescribeTableCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeTable", {})
    .n("DynamoDBClient", "DescribeTableCommand")
    .f(void 0, void 0)
    .ser(se_DescribeTableCommand)
    .de(de_DescribeTableCommand)
    .build() {
}

class DescribeTableReplicaAutoScalingCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeTableReplicaAutoScaling", {})
    .n("DynamoDBClient", "DescribeTableReplicaAutoScalingCommand")
    .f(void 0, void 0)
    .ser(se_DescribeTableReplicaAutoScalingCommand)
    .de(de_DescribeTableReplicaAutoScalingCommand)
    .build() {
}

class DescribeTimeToLiveCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeTimeToLive", {})
    .n("DynamoDBClient", "DescribeTimeToLiveCommand")
    .f(void 0, void 0)
    .ser(se_DescribeTimeToLiveCommand)
    .de(de_DescribeTimeToLiveCommand)
    .build() {
}

class DisableKinesisStreamingDestinationCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DisableKinesisStreamingDestination", {})
    .n("DynamoDBClient", "DisableKinesisStreamingDestinationCommand")
    .f(void 0, void 0)
    .ser(se_DisableKinesisStreamingDestinationCommand)
    .de(de_DisableKinesisStreamingDestinationCommand)
    .build() {
}

class EnableKinesisStreamingDestinationCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "EnableKinesisStreamingDestination", {})
    .n("DynamoDBClient", "EnableKinesisStreamingDestinationCommand")
    .f(void 0, void 0)
    .ser(se_EnableKinesisStreamingDestinationCommand)
    .de(de_EnableKinesisStreamingDestinationCommand)
    .build() {
}

class ExecuteStatementCommand extends smithyClient.Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ExecuteStatement", {})
    .n("DynamoDBClient", "ExecuteStatementCommand")
    .f(void 0, void 0)
    .ser(se_ExecuteStatementCommand)
    .de(de_ExecuteStatementCommand)
    .build() {
}

class ExecuteTransactionCommand extends smithyClient.Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ExecuteTransaction", {})
    .n("DynamoDBClient", "ExecuteTransactionCommand")
    .f(void 0, void 0)
    .ser(se_ExecuteTransactionCommand)
    .de(de_ExecuteTransactionCommand)
    .build() {
}

class ExportTableToPointInTimeCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ExportTableToPointInTime", {})
    .n("DynamoDBClient", "ExportTableToPointInTimeCommand")
    .f(void 0, void 0)
    .ser(se_ExportTableToPointInTimeCommand)
    .de(de_ExportTableToPointInTimeCommand)
    .build() {
}

class GetItemCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "GetItem", {})
    .n("DynamoDBClient", "GetItemCommand")
    .f(void 0, void 0)
    .ser(se_GetItemCommand)
    .de(de_GetItemCommand)
    .build() {
}

class GetResourcePolicyCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "ResourceArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "GetResourcePolicy", {})
    .n("DynamoDBClient", "GetResourcePolicyCommand")
    .f(void 0, void 0)
    .ser(se_GetResourcePolicyCommand)
    .de(de_GetResourcePolicyCommand)
    .build() {
}

class ImportTableCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "operationContextParams", get: (input) => input?.TableCreationParameters?.TableName },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ImportTable", {})
    .n("DynamoDBClient", "ImportTableCommand")
    .f(void 0, void 0)
    .ser(se_ImportTableCommand)
    .de(de_ImportTableCommand)
    .build() {
}

class ListBackupsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ListBackups", {})
    .n("DynamoDBClient", "ListBackupsCommand")
    .f(void 0, void 0)
    .ser(se_ListBackupsCommand)
    .de(de_ListBackupsCommand)
    .build() {
}

class ListContributorInsightsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ListContributorInsights", {})
    .n("DynamoDBClient", "ListContributorInsightsCommand")
    .f(void 0, void 0)
    .ser(se_ListContributorInsightsCommand)
    .de(de_ListContributorInsightsCommand)
    .build() {
}

class ListExportsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ListExports", {})
    .n("DynamoDBClient", "ListExportsCommand")
    .f(void 0, void 0)
    .ser(se_ListExportsCommand)
    .de(de_ListExportsCommand)
    .build() {
}

class ListGlobalTablesCommand extends smithyClient.Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ListGlobalTables", {})
    .n("DynamoDBClient", "ListGlobalTablesCommand")
    .f(void 0, void 0)
    .ser(se_ListGlobalTablesCommand)
    .de(de_ListGlobalTablesCommand)
    .build() {
}

class ListImportsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ListImports", {})
    .n("DynamoDBClient", "ListImportsCommand")
    .f(void 0, void 0)
    .ser(se_ListImportsCommand)
    .de(de_ListImportsCommand)
    .build() {
}

class ListTablesCommand extends smithyClient.Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ListTables", {})
    .n("DynamoDBClient", "ListTablesCommand")
    .f(void 0, void 0)
    .ser(se_ListTablesCommand)
    .de(de_ListTablesCommand)
    .build() {
}

class ListTagsOfResourceCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "ResourceArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ListTagsOfResource", {})
    .n("DynamoDBClient", "ListTagsOfResourceCommand")
    .f(void 0, void 0)
    .ser(se_ListTagsOfResourceCommand)
    .de(de_ListTagsOfResourceCommand)
    .build() {
}

class PutItemCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "PutItem", {})
    .n("DynamoDBClient", "PutItemCommand")
    .f(void 0, void 0)
    .ser(se_PutItemCommand)
    .de(de_PutItemCommand)
    .build() {
}

class PutResourcePolicyCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "ResourceArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "PutResourcePolicy", {})
    .n("DynamoDBClient", "PutResourcePolicyCommand")
    .f(void 0, void 0)
    .ser(se_PutResourcePolicyCommand)
    .de(de_PutResourcePolicyCommand)
    .build() {
}

class QueryCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "Query", {})
    .n("DynamoDBClient", "QueryCommand")
    .f(void 0, void 0)
    .ser(se_QueryCommand)
    .de(de_QueryCommand)
    .build() {
}

class RestoreTableFromBackupCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TargetTableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "RestoreTableFromBackup", {})
    .n("DynamoDBClient", "RestoreTableFromBackupCommand")
    .f(void 0, void 0)
    .ser(se_RestoreTableFromBackupCommand)
    .de(de_RestoreTableFromBackupCommand)
    .build() {
}

class RestoreTableToPointInTimeCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TargetTableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "RestoreTableToPointInTime", {})
    .n("DynamoDBClient", "RestoreTableToPointInTimeCommand")
    .f(void 0, void 0)
    .ser(se_RestoreTableToPointInTimeCommand)
    .de(de_RestoreTableToPointInTimeCommand)
    .build() {
}

class ScanCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "Scan", {})
    .n("DynamoDBClient", "ScanCommand")
    .f(void 0, void 0)
    .ser(se_ScanCommand)
    .de(de_ScanCommand)
    .build() {
}

class TagResourceCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "ResourceArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "TagResource", {})
    .n("DynamoDBClient", "TagResourceCommand")
    .f(void 0, void 0)
    .ser(se_TagResourceCommand)
    .de(de_TagResourceCommand)
    .build() {
}

class TransactGetItemsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArnList: {
        type: "operationContextParams",
        get: (input) => input?.TransactItems?.map((obj) => obj?.Get?.TableName),
    },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "TransactGetItems", {})
    .n("DynamoDBClient", "TransactGetItemsCommand")
    .f(void 0, void 0)
    .ser(se_TransactGetItemsCommand)
    .de(de_TransactGetItemsCommand)
    .build() {
}

class TransactWriteItemsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArnList: {
        type: "operationContextParams",
        get: (input) => input?.TransactItems?.map((obj) => [obj?.ConditionCheck?.TableName, obj?.Put?.TableName, obj?.Delete?.TableName, obj?.Update?.TableName].filter((i) => i)).flat(),
    },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "TransactWriteItems", {})
    .n("DynamoDBClient", "TransactWriteItemsCommand")
    .f(void 0, void 0)
    .ser(se_TransactWriteItemsCommand)
    .de(de_TransactWriteItemsCommand)
    .build() {
}

class UntagResourceCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "ResourceArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UntagResource", {})
    .n("DynamoDBClient", "UntagResourceCommand")
    .f(void 0, void 0)
    .ser(se_UntagResourceCommand)
    .de(de_UntagResourceCommand)
    .build() {
}

class UpdateContinuousBackupsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UpdateContinuousBackups", {})
    .n("DynamoDBClient", "UpdateContinuousBackupsCommand")
    .f(void 0, void 0)
    .ser(se_UpdateContinuousBackupsCommand)
    .de(de_UpdateContinuousBackupsCommand)
    .build() {
}

class UpdateContributorInsightsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UpdateContributorInsights", {})
    .n("DynamoDBClient", "UpdateContributorInsightsCommand")
    .f(void 0, void 0)
    .ser(se_UpdateContributorInsightsCommand)
    .de(de_UpdateContributorInsightsCommand)
    .build() {
}

class UpdateGlobalTableCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "GlobalTableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UpdateGlobalTable", {})
    .n("DynamoDBClient", "UpdateGlobalTableCommand")
    .f(void 0, void 0)
    .ser(se_UpdateGlobalTableCommand)
    .de(de_UpdateGlobalTableCommand)
    .build() {
}

class UpdateGlobalTableSettingsCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "GlobalTableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UpdateGlobalTableSettings", {})
    .n("DynamoDBClient", "UpdateGlobalTableSettingsCommand")
    .f(void 0, void 0)
    .ser(se_UpdateGlobalTableSettingsCommand)
    .de(de_UpdateGlobalTableSettingsCommand)
    .build() {
}

class UpdateItemCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UpdateItem", {})
    .n("DynamoDBClient", "UpdateItemCommand")
    .f(void 0, void 0)
    .ser(se_UpdateItemCommand)
    .de(de_UpdateItemCommand)
    .build() {
}

class UpdateKinesisStreamingDestinationCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UpdateKinesisStreamingDestination", {})
    .n("DynamoDBClient", "UpdateKinesisStreamingDestinationCommand")
    .f(void 0, void 0)
    .ser(se_UpdateKinesisStreamingDestinationCommand)
    .de(de_UpdateKinesisStreamingDestinationCommand)
    .build() {
}

class UpdateTableCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UpdateTable", {})
    .n("DynamoDBClient", "UpdateTableCommand")
    .f(void 0, void 0)
    .ser(se_UpdateTableCommand)
    .de(de_UpdateTableCommand)
    .build() {
}

class UpdateTableReplicaAutoScalingCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UpdateTableReplicaAutoScaling", {})
    .n("DynamoDBClient", "UpdateTableReplicaAutoScalingCommand")
    .f(void 0, void 0)
    .ser(se_UpdateTableReplicaAutoScalingCommand)
    .de(de_UpdateTableReplicaAutoScalingCommand)
    .build() {
}

class UpdateTimeToLiveCommand extends smithyClient.Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        middlewareSerde.getSerdePlugin(config, this.serialize, this.deserialize),
        middlewareEndpoint.getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UpdateTimeToLive", {})
    .n("DynamoDBClient", "UpdateTimeToLiveCommand")
    .f(void 0, void 0)
    .ser(se_UpdateTimeToLiveCommand)
    .de(de_UpdateTimeToLiveCommand)
    .build() {
}

const commands = {
    BatchExecuteStatementCommand,
    BatchGetItemCommand,
    BatchWriteItemCommand,
    CreateBackupCommand,
    CreateGlobalTableCommand,
    CreateTableCommand,
    DeleteBackupCommand,
    DeleteItemCommand,
    DeleteResourcePolicyCommand,
    DeleteTableCommand,
    DescribeBackupCommand,
    DescribeContinuousBackupsCommand,
    DescribeContributorInsightsCommand,
    DescribeEndpointsCommand,
    DescribeExportCommand,
    DescribeGlobalTableCommand,
    DescribeGlobalTableSettingsCommand,
    DescribeImportCommand,
    DescribeKinesisStreamingDestinationCommand,
    DescribeLimitsCommand,
    DescribeTableCommand,
    DescribeTableReplicaAutoScalingCommand,
    DescribeTimeToLiveCommand,
    DisableKinesisStreamingDestinationCommand,
    EnableKinesisStreamingDestinationCommand,
    ExecuteStatementCommand,
    ExecuteTransactionCommand,
    ExportTableToPointInTimeCommand,
    GetItemCommand,
    GetResourcePolicyCommand,
    ImportTableCommand,
    ListBackupsCommand,
    ListContributorInsightsCommand,
    ListExportsCommand,
    ListGlobalTablesCommand,
    ListImportsCommand,
    ListTablesCommand,
    ListTagsOfResourceCommand,
    PutItemCommand,
    PutResourcePolicyCommand,
    QueryCommand,
    RestoreTableFromBackupCommand,
    RestoreTableToPointInTimeCommand,
    ScanCommand,
    TagResourceCommand,
    TransactGetItemsCommand,
    TransactWriteItemsCommand,
    UntagResourceCommand,
    UpdateContinuousBackupsCommand,
    UpdateContributorInsightsCommand,
    UpdateGlobalTableCommand,
    UpdateGlobalTableSettingsCommand,
    UpdateItemCommand,
    UpdateKinesisStreamingDestinationCommand,
    UpdateTableCommand,
    UpdateTableReplicaAutoScalingCommand,
    UpdateTimeToLiveCommand,
};
class DynamoDB extends DynamoDBClient {
}
smithyClient.createAggregatedClient(commands, DynamoDB);

const paginateListContributorInsights = core$1.createPaginator(DynamoDBClient, ListContributorInsightsCommand, "NextToken", "NextToken", "MaxResults");

const paginateListExports = core$1.createPaginator(DynamoDBClient, ListExportsCommand, "NextToken", "NextToken", "MaxResults");

const paginateListImports = core$1.createPaginator(DynamoDBClient, ListImportsCommand, "NextToken", "NextToken", "PageSize");

const paginateListTables = core$1.createPaginator(DynamoDBClient, ListTablesCommand, "ExclusiveStartTableName", "LastEvaluatedTableName", "Limit");

const paginateQuery = core$1.createPaginator(DynamoDBClient, QueryCommand, "ExclusiveStartKey", "LastEvaluatedKey", "Limit");

const paginateScan = core$1.createPaginator(DynamoDBClient, ScanCommand, "ExclusiveStartKey", "LastEvaluatedKey", "Limit");

const checkState$1 = async (client, input) => {
    let reason;
    try {
        const result = await client.send(new DescribeTableCommand(input));
        reason = result;
        try {
            const returnComparator = () => {
                return result.Table.TableStatus;
            };
            if (returnComparator() === "ACTIVE") {
                return { state: utilWaiter.WaiterState.SUCCESS, reason };
            }
        }
        catch (e) { }
    }
    catch (exception) {
        reason = exception;
        if (exception.name && exception.name == "ResourceNotFoundException") {
            return { state: utilWaiter.WaiterState.RETRY, reason };
        }
    }
    return { state: utilWaiter.WaiterState.RETRY, reason };
};
const waitForTableExists = async (params, input) => {
    const serviceDefaults = { minDelay: 20, maxDelay: 120 };
    return utilWaiter.createWaiter({ ...serviceDefaults, ...params }, input, checkState$1);
};
const waitUntilTableExists = async (params, input) => {
    const serviceDefaults = { minDelay: 20, maxDelay: 120 };
    const result = await utilWaiter.createWaiter({ ...serviceDefaults, ...params }, input, checkState$1);
    return utilWaiter.checkExceptions(result);
};

const checkState = async (client, input) => {
    let reason;
    try {
        const result = await client.send(new DescribeTableCommand(input));
        reason = result;
    }
    catch (exception) {
        reason = exception;
        if (exception.name && exception.name == "ResourceNotFoundException") {
            return { state: utilWaiter.WaiterState.SUCCESS, reason };
        }
    }
    return { state: utilWaiter.WaiterState.RETRY, reason };
};
const waitForTableNotExists = async (params, input) => {
    const serviceDefaults = { minDelay: 20, maxDelay: 120 };
    return utilWaiter.createWaiter({ ...serviceDefaults, ...params }, input, checkState);
};
const waitUntilTableNotExists = async (params, input) => {
    const serviceDefaults = { minDelay: 20, maxDelay: 120 };
    const result = await utilWaiter.createWaiter({ ...serviceDefaults, ...params }, input, checkState);
    return utilWaiter.checkExceptions(result);
};

Object.defineProperty(exports, "$Command", {
    enumerable: true,
    get: function () { return smithyClient.Command; }
});
Object.defineProperty(exports, "__Client", {
    enumerable: true,
    get: function () { return smithyClient.Client; }
});
exports.ApproximateCreationDateTimePrecision = ApproximateCreationDateTimePrecision;
exports.AttributeAction = AttributeAction;
exports.BackupInUseException = BackupInUseException;
exports.BackupNotFoundException = BackupNotFoundException;
exports.BackupStatus = BackupStatus;
exports.BackupType = BackupType;
exports.BackupTypeFilter = BackupTypeFilter;
exports.BatchExecuteStatementCommand = BatchExecuteStatementCommand;
exports.BatchGetItemCommand = BatchGetItemCommand;
exports.BatchStatementErrorCodeEnum = BatchStatementErrorCodeEnum;
exports.BatchWriteItemCommand = BatchWriteItemCommand;
exports.BillingMode = BillingMode;
exports.ComparisonOperator = ComparisonOperator;
exports.ConditionalCheckFailedException = ConditionalCheckFailedException;
exports.ConditionalOperator = ConditionalOperator;
exports.ContinuousBackupsStatus = ContinuousBackupsStatus;
exports.ContinuousBackupsUnavailableException = ContinuousBackupsUnavailableException;
exports.ContributorInsightsAction = ContributorInsightsAction;
exports.ContributorInsightsMode = ContributorInsightsMode;
exports.ContributorInsightsStatus = ContributorInsightsStatus;
exports.CreateBackupCommand = CreateBackupCommand;
exports.CreateGlobalTableCommand = CreateGlobalTableCommand;
exports.CreateTableCommand = CreateTableCommand;
exports.DeleteBackupCommand = DeleteBackupCommand;
exports.DeleteItemCommand = DeleteItemCommand;
exports.DeleteResourcePolicyCommand = DeleteResourcePolicyCommand;
exports.DeleteTableCommand = DeleteTableCommand;
exports.DescribeBackupCommand = DescribeBackupCommand;
exports.DescribeContinuousBackupsCommand = DescribeContinuousBackupsCommand;
exports.DescribeContributorInsightsCommand = DescribeContributorInsightsCommand;
exports.DescribeEndpointsCommand = DescribeEndpointsCommand;
exports.DescribeExportCommand = DescribeExportCommand;
exports.DescribeGlobalTableCommand = DescribeGlobalTableCommand;
exports.DescribeGlobalTableSettingsCommand = DescribeGlobalTableSettingsCommand;
exports.DescribeImportCommand = DescribeImportCommand;
exports.DescribeKinesisStreamingDestinationCommand = DescribeKinesisStreamingDestinationCommand;
exports.DescribeLimitsCommand = DescribeLimitsCommand;
exports.DescribeTableCommand = DescribeTableCommand;
exports.DescribeTableReplicaAutoScalingCommand = DescribeTableReplicaAutoScalingCommand;
exports.DescribeTimeToLiveCommand = DescribeTimeToLiveCommand;
exports.DestinationStatus = DestinationStatus;
exports.DisableKinesisStreamingDestinationCommand = DisableKinesisStreamingDestinationCommand;
exports.DuplicateItemException = DuplicateItemException;
exports.DynamoDB = DynamoDB;
exports.DynamoDBClient = DynamoDBClient;
exports.DynamoDBServiceException = DynamoDBServiceException;
exports.EnableKinesisStreamingDestinationCommand = EnableKinesisStreamingDestinationCommand;
exports.ExecuteStatementCommand = ExecuteStatementCommand;
exports.ExecuteTransactionCommand = ExecuteTransactionCommand;
exports.ExportConflictException = ExportConflictException;
exports.ExportFormat = ExportFormat;
exports.ExportNotFoundException = ExportNotFoundException;
exports.ExportStatus = ExportStatus;
exports.ExportTableToPointInTimeCommand = ExportTableToPointInTimeCommand;
exports.ExportType = ExportType;
exports.ExportViewType = ExportViewType;
exports.GetItemCommand = GetItemCommand;
exports.GetResourcePolicyCommand = GetResourcePolicyCommand;
exports.GlobalTableAlreadyExistsException = GlobalTableAlreadyExistsException;
exports.GlobalTableNotFoundException = GlobalTableNotFoundException;
exports.GlobalTableStatus = GlobalTableStatus;
exports.IdempotentParameterMismatchException = IdempotentParameterMismatchException;
exports.ImportConflictException = ImportConflictException;
exports.ImportNotFoundException = ImportNotFoundException;
exports.ImportStatus = ImportStatus;
exports.ImportTableCommand = ImportTableCommand;
exports.IndexNotFoundException = IndexNotFoundException;
exports.IndexStatus = IndexStatus;
exports.InputCompressionType = InputCompressionType;
exports.InputFormat = InputFormat;
exports.InternalServerError = InternalServerError;
exports.InvalidEndpointException = InvalidEndpointException;
exports.InvalidExportTimeException = InvalidExportTimeException;
exports.InvalidRestoreTimeException = InvalidRestoreTimeException;
exports.ItemCollectionSizeLimitExceededException = ItemCollectionSizeLimitExceededException;
exports.KeyType = KeyType;
exports.LimitExceededException = LimitExceededException;
exports.ListBackupsCommand = ListBackupsCommand;
exports.ListContributorInsightsCommand = ListContributorInsightsCommand;
exports.ListExportsCommand = ListExportsCommand;
exports.ListGlobalTablesCommand = ListGlobalTablesCommand;
exports.ListImportsCommand = ListImportsCommand;
exports.ListTablesCommand = ListTablesCommand;
exports.ListTagsOfResourceCommand = ListTagsOfResourceCommand;
exports.MultiRegionConsistency = MultiRegionConsistency;
exports.PointInTimeRecoveryStatus = PointInTimeRecoveryStatus;
exports.PointInTimeRecoveryUnavailableException = PointInTimeRecoveryUnavailableException;
exports.PolicyNotFoundException = PolicyNotFoundException;
exports.ProjectionType = ProjectionType;
exports.ProvisionedThroughputExceededException = ProvisionedThroughputExceededException;
exports.PutItemCommand = PutItemCommand;
exports.PutResourcePolicyCommand = PutResourcePolicyCommand;
exports.QueryCommand = QueryCommand;
exports.ReplicaAlreadyExistsException = ReplicaAlreadyExistsException;
exports.ReplicaNotFoundException = ReplicaNotFoundException;
exports.ReplicaStatus = ReplicaStatus;
exports.ReplicatedWriteConflictException = ReplicatedWriteConflictException;
exports.RequestLimitExceeded = RequestLimitExceeded;
exports.ResourceInUseException = ResourceInUseException;
exports.ResourceNotFoundException = ResourceNotFoundException;
exports.RestoreTableFromBackupCommand = RestoreTableFromBackupCommand;
exports.RestoreTableToPointInTimeCommand = RestoreTableToPointInTimeCommand;
exports.ReturnConsumedCapacity = ReturnConsumedCapacity;
exports.ReturnItemCollectionMetrics = ReturnItemCollectionMetrics;
exports.ReturnValue = ReturnValue;
exports.ReturnValuesOnConditionCheckFailure = ReturnValuesOnConditionCheckFailure;
exports.S3SseAlgorithm = S3SseAlgorithm;
exports.SSEStatus = SSEStatus;
exports.SSEType = SSEType;
exports.ScalarAttributeType = ScalarAttributeType;
exports.ScanCommand = ScanCommand;
exports.Select = Select;
exports.StreamViewType = StreamViewType;
exports.TableAlreadyExistsException = TableAlreadyExistsException;
exports.TableClass = TableClass;
exports.TableInUseException = TableInUseException;
exports.TableNotFoundException = TableNotFoundException;
exports.TableStatus = TableStatus;
exports.TagResourceCommand = TagResourceCommand;
exports.ThrottlingException = ThrottlingException;
exports.TimeToLiveStatus = TimeToLiveStatus;
exports.TransactGetItemsCommand = TransactGetItemsCommand;
exports.TransactWriteItemsCommand = TransactWriteItemsCommand;
exports.TransactionCanceledException = TransactionCanceledException;
exports.TransactionConflictException = TransactionConflictException;
exports.TransactionInProgressException = TransactionInProgressException;
exports.UntagResourceCommand = UntagResourceCommand;
exports.UpdateContinuousBackupsCommand = UpdateContinuousBackupsCommand;
exports.UpdateContributorInsightsCommand = UpdateContributorInsightsCommand;
exports.UpdateGlobalTableCommand = UpdateGlobalTableCommand;
exports.UpdateGlobalTableSettingsCommand = UpdateGlobalTableSettingsCommand;
exports.UpdateItemCommand = UpdateItemCommand;
exports.UpdateKinesisStreamingDestinationCommand = UpdateKinesisStreamingDestinationCommand;
exports.UpdateTableCommand = UpdateTableCommand;
exports.UpdateTableReplicaAutoScalingCommand = UpdateTableReplicaAutoScalingCommand;
exports.UpdateTimeToLiveCommand = UpdateTimeToLiveCommand;
exports.WitnessStatus = WitnessStatus;
exports.paginateListContributorInsights = paginateListContributorInsights;
exports.paginateListExports = paginateListExports;
exports.paginateListImports = paginateListImports;
exports.paginateListTables = paginateListTables;
exports.paginateQuery = paginateQuery;
exports.paginateScan = paginateScan;
exports.waitForTableExists = waitForTableExists;
exports.waitForTableNotExists = waitForTableNotExists;
exports.waitUntilTableExists = waitUntilTableExists;
exports.waitUntilTableNotExists = waitUntilTableNotExists;
