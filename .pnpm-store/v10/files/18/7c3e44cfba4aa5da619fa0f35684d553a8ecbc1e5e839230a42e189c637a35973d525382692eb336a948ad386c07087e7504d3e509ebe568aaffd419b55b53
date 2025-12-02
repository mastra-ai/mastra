import { DynamoDBServiceException as __BaseException } from "./DynamoDBServiceException";
export const ApproximateCreationDateTimePrecision = {
    MICROSECOND: "MICROSECOND",
    MILLISECOND: "MILLISECOND",
};
export const AttributeAction = {
    ADD: "ADD",
    DELETE: "DELETE",
    PUT: "PUT",
};
export const ScalarAttributeType = {
    B: "B",
    N: "N",
    S: "S",
};
export const BackupStatus = {
    AVAILABLE: "AVAILABLE",
    CREATING: "CREATING",
    DELETED: "DELETED",
};
export const BackupType = {
    AWS_BACKUP: "AWS_BACKUP",
    SYSTEM: "SYSTEM",
    USER: "USER",
};
export const BillingMode = {
    PAY_PER_REQUEST: "PAY_PER_REQUEST",
    PROVISIONED: "PROVISIONED",
};
export const KeyType = {
    HASH: "HASH",
    RANGE: "RANGE",
};
export const ProjectionType = {
    ALL: "ALL",
    INCLUDE: "INCLUDE",
    KEYS_ONLY: "KEYS_ONLY",
};
export const SSEType = {
    AES256: "AES256",
    KMS: "KMS",
};
export const SSEStatus = {
    DISABLED: "DISABLED",
    DISABLING: "DISABLING",
    ENABLED: "ENABLED",
    ENABLING: "ENABLING",
    UPDATING: "UPDATING",
};
export const StreamViewType = {
    KEYS_ONLY: "KEYS_ONLY",
    NEW_AND_OLD_IMAGES: "NEW_AND_OLD_IMAGES",
    NEW_IMAGE: "NEW_IMAGE",
    OLD_IMAGE: "OLD_IMAGE",
};
export const TimeToLiveStatus = {
    DISABLED: "DISABLED",
    DISABLING: "DISABLING",
    ENABLED: "ENABLED",
    ENABLING: "ENABLING",
};
export class BackupInUseException extends __BaseException {
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
export class BackupNotFoundException extends __BaseException {
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
export const BackupTypeFilter = {
    ALL: "ALL",
    AWS_BACKUP: "AWS_BACKUP",
    SYSTEM: "SYSTEM",
    USER: "USER",
};
export const ReturnConsumedCapacity = {
    INDEXES: "INDEXES",
    NONE: "NONE",
    TOTAL: "TOTAL",
};
export const ReturnValuesOnConditionCheckFailure = {
    ALL_OLD: "ALL_OLD",
    NONE: "NONE",
};
export const BatchStatementErrorCodeEnum = {
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
export class InternalServerError extends __BaseException {
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
export class RequestLimitExceeded extends __BaseException {
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
export class ThrottlingException extends __BaseException {
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
export class InvalidEndpointException extends __BaseException {
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
export class ProvisionedThroughputExceededException extends __BaseException {
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
export class ResourceNotFoundException extends __BaseException {
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
export const ReturnItemCollectionMetrics = {
    NONE: "NONE",
    SIZE: "SIZE",
};
export class ItemCollectionSizeLimitExceededException extends __BaseException {
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
export class ReplicatedWriteConflictException extends __BaseException {
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
export const ComparisonOperator = {
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
export const ConditionalOperator = {
    AND: "AND",
    OR: "OR",
};
export const ContinuousBackupsStatus = {
    DISABLED: "DISABLED",
    ENABLED: "ENABLED",
};
export const PointInTimeRecoveryStatus = {
    DISABLED: "DISABLED",
    ENABLED: "ENABLED",
};
export class ContinuousBackupsUnavailableException extends __BaseException {
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
export const ContributorInsightsAction = {
    DISABLE: "DISABLE",
    ENABLE: "ENABLE",
};
export const ContributorInsightsMode = {
    ACCESSED_AND_THROTTLED_KEYS: "ACCESSED_AND_THROTTLED_KEYS",
    THROTTLED_KEYS: "THROTTLED_KEYS",
};
export const ContributorInsightsStatus = {
    DISABLED: "DISABLED",
    DISABLING: "DISABLING",
    ENABLED: "ENABLED",
    ENABLING: "ENABLING",
    FAILED: "FAILED",
};
export class LimitExceededException extends __BaseException {
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
export class TableInUseException extends __BaseException {
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
export class TableNotFoundException extends __BaseException {
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
export const GlobalTableStatus = {
    ACTIVE: "ACTIVE",
    CREATING: "CREATING",
    DELETING: "DELETING",
    UPDATING: "UPDATING",
};
export const IndexStatus = {
    ACTIVE: "ACTIVE",
    CREATING: "CREATING",
    DELETING: "DELETING",
    UPDATING: "UPDATING",
};
export const ReplicaStatus = {
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
export const TableClass = {
    STANDARD: "STANDARD",
    STANDARD_INFREQUENT_ACCESS: "STANDARD_INFREQUENT_ACCESS",
};
export const TableStatus = {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    ARCHIVING: "ARCHIVING",
    CREATING: "CREATING",
    DELETING: "DELETING",
    INACCESSIBLE_ENCRYPTION_CREDENTIALS: "INACCESSIBLE_ENCRYPTION_CREDENTIALS",
    REPLICATION_NOT_AUTHORIZED: "REPLICATION_NOT_AUTHORIZED",
    UPDATING: "UPDATING",
};
export class GlobalTableAlreadyExistsException extends __BaseException {
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
export const WitnessStatus = {
    ACTIVE: "ACTIVE",
    CREATING: "CREATING",
    DELETING: "DELETING",
};
export const MultiRegionConsistency = {
    EVENTUAL: "EVENTUAL",
    STRONG: "STRONG",
};
export class ResourceInUseException extends __BaseException {
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
export const ReturnValue = {
    ALL_NEW: "ALL_NEW",
    ALL_OLD: "ALL_OLD",
    NONE: "NONE",
    UPDATED_NEW: "UPDATED_NEW",
    UPDATED_OLD: "UPDATED_OLD",
};
export class TransactionConflictException extends __BaseException {
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
export class PolicyNotFoundException extends __BaseException {
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
export const ExportFormat = {
    DYNAMODB_JSON: "DYNAMODB_JSON",
    ION: "ION",
};
export const ExportStatus = {
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    IN_PROGRESS: "IN_PROGRESS",
};
export const ExportType = {
    FULL_EXPORT: "FULL_EXPORT",
    INCREMENTAL_EXPORT: "INCREMENTAL_EXPORT",
};
export const ExportViewType = {
    NEW_AND_OLD_IMAGES: "NEW_AND_OLD_IMAGES",
    NEW_IMAGE: "NEW_IMAGE",
};
export const S3SseAlgorithm = {
    AES256: "AES256",
    KMS: "KMS",
};
export class ExportNotFoundException extends __BaseException {
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
export class GlobalTableNotFoundException extends __BaseException {
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
export const ImportStatus = {
    CANCELLED: "CANCELLED",
    CANCELLING: "CANCELLING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    IN_PROGRESS: "IN_PROGRESS",
};
export const InputCompressionType = {
    GZIP: "GZIP",
    NONE: "NONE",
    ZSTD: "ZSTD",
};
export const InputFormat = {
    CSV: "CSV",
    DYNAMODB_JSON: "DYNAMODB_JSON",
    ION: "ION",
};
export class ImportNotFoundException extends __BaseException {
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
export const DestinationStatus = {
    ACTIVE: "ACTIVE",
    DISABLED: "DISABLED",
    DISABLING: "DISABLING",
    ENABLE_FAILED: "ENABLE_FAILED",
    ENABLING: "ENABLING",
    UPDATING: "UPDATING",
};
export class DuplicateItemException extends __BaseException {
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
export class IdempotentParameterMismatchException extends __BaseException {
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
export class TransactionInProgressException extends __BaseException {
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
export class ExportConflictException extends __BaseException {
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
export class InvalidExportTimeException extends __BaseException {
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
export class PointInTimeRecoveryUnavailableException extends __BaseException {
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
export class ImportConflictException extends __BaseException {
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
export const Select = {
    ALL_ATTRIBUTES: "ALL_ATTRIBUTES",
    ALL_PROJECTED_ATTRIBUTES: "ALL_PROJECTED_ATTRIBUTES",
    COUNT: "COUNT",
    SPECIFIC_ATTRIBUTES: "SPECIFIC_ATTRIBUTES",
};
export class TableAlreadyExistsException extends __BaseException {
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
export class InvalidRestoreTimeException extends __BaseException {
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
export class ReplicaAlreadyExistsException extends __BaseException {
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
export class ReplicaNotFoundException extends __BaseException {
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
export class IndexNotFoundException extends __BaseException {
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
export var AttributeValue;
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
})(AttributeValue || (AttributeValue = {}));
export class ConditionalCheckFailedException extends __BaseException {
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
export class TransactionCanceledException extends __BaseException {
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
