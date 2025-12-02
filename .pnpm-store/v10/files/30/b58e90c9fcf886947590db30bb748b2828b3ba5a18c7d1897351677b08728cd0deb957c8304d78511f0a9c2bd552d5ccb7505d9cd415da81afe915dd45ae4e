import './errorcontexts';
import { ErrorContext, KeyValueErrorContext, ViewErrorContext, QueryErrorContext, SearchErrorContext, AnalyticsErrorContext, HttpErrorContext } from './errorcontexts';
/**
 * A generic base error that all errors inherit.  Exposes the cause and
 * context of the error to enable easier debugging.
 *
 * @category Error Handling
 */
export declare class CouchbaseError extends Error {
    /**
     * Specifies the underlying cause of this error, if one is available.
     */
    cause: Error | undefined;
    /**
     * Specifies additional contextual information which is available for this
     * error.  Depending on the service that generated it.
     */
    context: KeyValueErrorContext | ViewErrorContext | QueryErrorContext | SearchErrorContext | AnalyticsErrorContext | HttpErrorContext | undefined;
    constructor(message: string, cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that an operation was performed after a connection was closed.
 *
 * @category Error Handling
 */
export declare class ConnectionClosedError extends CouchbaseError {
    constructor();
}
/**
 * Indicates that an operation was performed after the cluster object was explicitly
 * closed by the user.
 *
 * @category Error Handling
 */
export declare class ClusterClosedError extends CouchbaseError {
    constructor();
}
/**
 * Indicates that an cluster-level operation could not be performed as no buckets
 * were open.  This occurs with pre-6.0 clusters which were not able to fetch cluster
 * topology without knowing the name of a bucket.
 *
 * @category Error Handling
 */
export declare class NeedOpenBucketError extends CouchbaseError {
    constructor();
}
/**
 * Indicates that the specific durability level was invalid.
 *
 * @category Error Handling
 */
export declare class InvalidDurabilityLevel extends CouchbaseError {
    constructor();
}
/**
 * Indicates that the specific durabilityPersistTo level was invalid.
 *
 * @category Error Handling
 */
export declare class InvalidDurabilityPersistToLevel extends CouchbaseError {
    constructor();
}
/**
 * Indicates that the specific durabilityReplicateTo level was invalid.
 *
 * @category Error Handling
 */
export declare class InvalidDurabilityReplicateToLevel extends CouchbaseError {
    constructor();
}
/**
 * Indicates that the operation timed out.
 *
 * @category Error Handling
 */
export declare class TimeoutError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the request was explicitly cancelled.
 *
 * @category Error Handling
 */
export declare class RequestCanceledError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that one of the passed arguments was invalid.
 *
 * @category Error Handling
 */
export declare class InvalidArgumentError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the operation requires a service which was not available.
 * For instance, attempting to perform a query without the query service
 * being enabled.
 *
 * @category Error Handling
 */
export declare class ServiceNotAvailableError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates some form of internal error occured on the server and the
 * request could not be completed.
 *
 * @category Error Handling
 */
export declare class InternalServerFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that an error occurred authenticating the user to the cluster.
 *
 * @category Error Handling
 */
export declare class AuthenticationFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a temporary failure occured, attempting the same operation
 * in the future may succeed.
 *
 * @category Error Handling
 */
export declare class TemporaryFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a parsing failure occured.
 *
 * @category Error Handling
 */
export declare class ParsingFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a CAS mismatch occurred.  This means that the document
 * has changed since the last access and should be fetched again before
 * attempting to make further changes.
 *
 * @category Error Handling
 */
export declare class CasMismatchError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the bucket being referenced does not exist.
 *
 * @category Error Handling
 */
export declare class BucketNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the collection being referenced does not exist.
 *
 * @category Error Handling
 */
export declare class CollectionNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that there was a failure during encoding.
 *
 * @category Error Handling
 */
export declare class EncodingFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that there was a failure during decoding.
 *
 * @category Error Handling
 */
export declare class DecodingFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that an operation which is not supported was executed.
 *
 * @category Error Handling
 */
export declare class UnsupportedOperationError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that an ambiguous timeout has occured.  The outcome of the
 * operation is unknown, and it is possible that it completed after the
 * generation of this error.
 *
 * @category Error Handling
 */
export declare class AmbiguousTimeoutError extends TimeoutError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates an unambiguous timeout has occurred.  The outcome of the
 * operation is objective failure and it is known to have not completed.
 *
 * @category Error Handling
 */
export declare class UnambiguousTimeoutError extends TimeoutError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates a feature which is not available was used.  This primarily can
 * occur if you attempt to perform a query when no query services are enabled
 * on the cluster, or if a newer server feature which is not available in the
 * connected server version is used.
 *
 * @category Error Handling
 */
export declare class FeatureNotAvailableError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced scope does not exist.
 *
 * @category Error Handling
 */
export declare class ScopeNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced index does not exist.
 *
 * @category Error Handling
 */
export declare class IndexNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a rate limit was exceeded while attempting to
 * execute the operation.
 *
 * @category Error Handling
 */
export declare class RateLimitedError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a quota limit was exceeded while attempting to
 * execute the operation.
 *
 * @category Error Handling
 */
export declare class QuotaLimitedError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced index already existed, but was expected
 * to not yet exist for the operation.
 *
 * @category Error Handling
 */
export declare class IndexExistsError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced document does not exist.
 *
 * @category Error Handling
 */
export declare class DocumentNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced document could not be retrieved.
 *
 * @category Error Handling
 */
export declare class DocumentUnretrievableError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced document could not be used as it is currently
 * locked, likely by another actor in the system.
 *
 * @category Error Handling
 */
export declare class DocumentLockedError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced document is not locked.  Generally raised when an unlock
 * operation is performed.
 *
 * @category Error Handling
 */
export declare class DocumentNotLockedError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a value could not be stored as it was too large.
 *
 * @category Error Handling
 */
export declare class ValueTooLargeError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced document exists already, but the operation
 * was not expecting it to exist.
 *
 * @category Error Handling
 */
export declare class DocumentExistsError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a JSON operation was attempted with non-JSON data.
 *
 * @category Error Handling
 */
export declare class ValueNotJsonError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a durability level which is not available was specified.
 *
 * @category Error Handling
 */
export declare class DurabilityLevelNotAvailableError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a durability level which is impossible to achieve was
 * specified.  This can occur when you try to use Majority but there is
 * less than the majority of nodes available.
 *
 * @category Error Handling
 */
export declare class DurabilityImpossibleError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the durable operation that was performed has failed
 * ambiguously and may or may not have completed, or may complete in
 * the future.
 *
 * @category Error Handling
 */
export declare class DurabilityAmbiguousError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a write was failed as an existing durable write against
 * that key is already in progress.
 *
 * @category Error Handling
 */
export declare class DurableWriteInProgressError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a write was failed as the server is currently reconstructing
 * it's durable data following a failover.
 *
 * @category Error Handling
 */
export declare class DurableWriteReCommitInProgressError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a mutation was lost.
 *
 * @category Error Handling
 */
export declare class MutationLostError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the reference path was not found.
 *
 * @category Error Handling
 */
export declare class PathNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced path made incorrect assumptions about
 * the structure of a document, for instance attempting to access a field
 * as an object when in fact it is an array.
 *
 * @category Error Handling
 */
export declare class PathMismatchError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced path is not valid.
 *
 * @category Error Handling
 */
export declare class PathInvalidError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the specified path was too large to parse.
 *
 * @category Error Handling
 */
export declare class PathTooBigError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced path was too deep to parse.
 *
 * @category Error Handling
 */
export declare class PathTooDeepError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the document created by the operation would become
 * too deep to operate on.
 *
 * @category Error Handling
 */
export declare class ValueTooDeepError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the value passed is invalid.
 *
 * @category Error Handling
 */
export declare class ValueInvalidError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that an operation expecting JSON was performed against a document
 * which is not JSON.
 *
 * @category Error Handling
 */
export declare class DocumentNotJsonError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a number has grown too large.
 *
 * @category Error Handling
 */
export declare class NumberTooBigError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the delta specified is invalid.
 *
 * @category Error Handling
 */
export declare class DeltaInvalidError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the reference path already existed, but the operation
 * expected that it did not.
 *
 * @category Error Handling
 */
export declare class PathExistsError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a failure occurred while planning a query.
 *
 * @category Error Handling
 */
export declare class PlanningFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a failure occured while querying an index.
 *
 * @category Error Handling
 */
export declare class IndexFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that an error occurred with a prepared statement.
 *
 * @category Error Handling
 */
export declare class PreparedStatementFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that a generic DML error occurred with a query.
 *
 * @category Error Handling
 */
export declare class DmlFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the index was not ready yet.
 *
 * @category Error Handling
 */
export declare class IndexNotReadyError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that an error occurred while compiling a query.
 *
 * @category Error Handling
 */
export declare class CompilationFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the job queue for the service was full and further requests will
 * be rejected for a period of time until the queue shrinks.
 *
 * @category Error Handling
 */
export declare class JobQueueFullError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced dataset does not exist.
 *
 * @category Error Handling
 */
export declare class DatasetNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced dataverse does not exist.
 *
 * @category Error Handling
 */
export declare class DataverseNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced dataset already exists, but the operation
 * expected that it did not.
 *
 * @category Error Handling
 */
export declare class DatasetExistsError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced dataverse already exists, but the operation
 * expected that it did not.
 *
 * @category Error Handling
 */
export declare class DataverseExistsError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced link does not exist.
 *
 * @category Error Handling
 */
export declare class LinkNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the link already exists.
 *
 * @category Error Handling
 */
export declare class LinkExistsError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced view does not exist.
 *
 * @category Error Handling
 */
export declare class ViewNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced design document does not exist.
 *
 * @category Error Handling
 */
export declare class DesignDocumentNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced collection already exists, but the operation
 * expected that it did not.
 *
 * @category Error Handling
 */
export declare class CollectionExistsError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced scope already exists, but the operation
 * expected that it did not.
 *
 * @category Error Handling
 */
export declare class ScopeExistsError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced user does not exist.
 *
 * @category Error Handling
 */
export declare class UserNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced group does not exist.
 *
 * @category Error Handling
 */
export declare class GroupNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced bucket already exists, but the operation
 * expected it to not exist.
 *
 * @category Error Handling
 */
export declare class BucketExistsError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced user already exists, but the operation
 * expected it to not exist.
 *
 * @category Error Handling
 */
export declare class UserExistsError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the bucket could not be flushed due to not having the flush
 * option enabled.  This option can be dynamically adjusted.
 *
 * @category Error Handling
 */
export declare class BucketNotFlushableError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced eventing function does not exist.
 *
 * @category Error Handling
 */
export declare class EventingFunctionNotFoundError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the referenced eventing function was not deployed but was
 * expected to have been.
 *
 * @category Error Handling
 */
export declare class EventingFunctionNotDeployedError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the eventing function was not able to be compiled.
 *
 * @category Error Handling
 */
export declare class EventingFunctionCompilationFailureError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that the source and metadata keyspaces both referenced the same
 * place for an eventing function.
 *
 * @category Error Handling
 */
export declare class EventingFunctionIdenticalKeyspaceError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that an eventing function was deployed but has not yet fully
 * completed the bootstrapping process.
 *
 * @category Error Handling
 */
export declare class EventingFunctionNotBootstrappedError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that an eventing function is deployed but the operation expected
 * that it was not.
 *
 * @category Error Handling
 */
export declare class EventingFunctionDeployedError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates that an eventing function is paused but the operation expected
 * that it was not.
 *
 * @category Error Handling
 */
export declare class EventingFunctionPausedError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates a transaction operation failed to complete.
 *
 * @category Error Handling
 */
export declare class TransactionOperationFailedError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates a transaction failed to complete.
 *
 * @category Error Handling
 */
export declare class TransactionFailedError extends CouchbaseError {
    constructor(cause?: Error, context?: ErrorContext);
}
/**
 * Indicates a transaction failed to complete due to expiring.
 *
 * @category Error Handling
 */
export declare class TransactionExpiredError extends CouchbaseError {
    constructor(cause?: Error);
}
/**
 * Indicates the state of a transaction ended as ambiguous and may or
 * may not have committed successfully.
 *
 * @category Error Handling
 */
export declare class TransactionCommitAmbiguousError extends CouchbaseError {
    constructor(cause?: Error);
}
