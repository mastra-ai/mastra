"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentNotJsonError = exports.ValueInvalidError = exports.ValueTooDeepError = exports.PathTooDeepError = exports.PathTooBigError = exports.PathInvalidError = exports.PathMismatchError = exports.PathNotFoundError = exports.MutationLostError = exports.DurableWriteReCommitInProgressError = exports.DurableWriteInProgressError = exports.DurabilityAmbiguousError = exports.DurabilityImpossibleError = exports.DurabilityLevelNotAvailableError = exports.ValueNotJsonError = exports.DocumentExistsError = exports.ValueTooLargeError = exports.DocumentNotLockedError = exports.DocumentLockedError = exports.DocumentUnretrievableError = exports.DocumentNotFoundError = exports.IndexExistsError = exports.QuotaLimitedError = exports.RateLimitedError = exports.IndexNotFoundError = exports.ScopeNotFoundError = exports.FeatureNotAvailableError = exports.UnambiguousTimeoutError = exports.AmbiguousTimeoutError = exports.UnsupportedOperationError = exports.DecodingFailureError = exports.EncodingFailureError = exports.CollectionNotFoundError = exports.BucketNotFoundError = exports.CasMismatchError = exports.ParsingFailureError = exports.TemporaryFailureError = exports.AuthenticationFailureError = exports.InternalServerFailureError = exports.ServiceNotAvailableError = exports.InvalidArgumentError = exports.RequestCanceledError = exports.TimeoutError = exports.InvalidDurabilityReplicateToLevel = exports.InvalidDurabilityPersistToLevel = exports.InvalidDurabilityLevel = exports.NeedOpenBucketError = exports.ClusterClosedError = exports.ConnectionClosedError = exports.CouchbaseError = void 0;
exports.TransactionCommitAmbiguousError = exports.TransactionExpiredError = exports.TransactionFailedError = exports.TransactionOperationFailedError = exports.EventingFunctionPausedError = exports.EventingFunctionDeployedError = exports.EventingFunctionNotBootstrappedError = exports.EventingFunctionIdenticalKeyspaceError = exports.EventingFunctionCompilationFailureError = exports.EventingFunctionNotDeployedError = exports.EventingFunctionNotFoundError = exports.BucketNotFlushableError = exports.UserExistsError = exports.BucketExistsError = exports.GroupNotFoundError = exports.UserNotFoundError = exports.ScopeExistsError = exports.CollectionExistsError = exports.DesignDocumentNotFoundError = exports.ViewNotFoundError = exports.LinkExistsError = exports.LinkNotFoundError = exports.DataverseExistsError = exports.DatasetExistsError = exports.DataverseNotFoundError = exports.DatasetNotFoundError = exports.JobQueueFullError = exports.CompilationFailureError = exports.IndexNotReadyError = exports.DmlFailureError = exports.PreparedStatementFailureError = exports.IndexFailureError = exports.PlanningFailureError = exports.PathExistsError = exports.DeltaInvalidError = exports.NumberTooBigError = void 0;
require("./errorcontexts");
/**
 * A generic base error that all errors inherit.  Exposes the cause and
 * context of the error to enable easier debugging.
 *
 * @category Error Handling
 */
class CouchbaseError extends Error {
    constructor(message, cause, context) {
        super(message);
        this.name = this.constructor.name;
        this.stack = undefined;
        this.cause = cause;
        this.context = context;
    }
}
exports.CouchbaseError = CouchbaseError;
/**
 * Indicates that an operation was performed after a connection was closed.
 *
 * @category Error Handling
 */
class ConnectionClosedError extends CouchbaseError {
    constructor() {
        super('The connection has been closed.');
    }
}
exports.ConnectionClosedError = ConnectionClosedError;
/**
 * Indicates that an operation was performed after the cluster object was explicitly
 * closed by the user.
 *
 * @category Error Handling
 */
class ClusterClosedError extends CouchbaseError {
    constructor() {
        super('The parent cluster object has been closed.');
    }
}
exports.ClusterClosedError = ClusterClosedError;
/**
 * Indicates that an cluster-level operation could not be performed as no buckets
 * were open.  This occurs with pre-6.0 clusters which were not able to fetch cluster
 * topology without knowing the name of a bucket.
 *
 * @category Error Handling
 */
class NeedOpenBucketError extends CouchbaseError {
    constructor() {
        super('You must have one open bucket before you can perform queries.');
    }
}
exports.NeedOpenBucketError = NeedOpenBucketError;
/**
 * Indicates that the specific durability level was invalid.
 *
 * @category Error Handling
 */
class InvalidDurabilityLevel extends CouchbaseError {
    constructor() {
        super('An invalid durability level was specified.');
    }
}
exports.InvalidDurabilityLevel = InvalidDurabilityLevel;
/**
 * Indicates that the specific durabilityPersistTo level was invalid.
 *
 * @category Error Handling
 */
class InvalidDurabilityPersistToLevel extends CouchbaseError {
    constructor() {
        super('An invalid durability PersistTo level was specified.');
    }
}
exports.InvalidDurabilityPersistToLevel = InvalidDurabilityPersistToLevel;
/**
 * Indicates that the specific durabilityReplicateTo level was invalid.
 *
 * @category Error Handling
 */
class InvalidDurabilityReplicateToLevel extends CouchbaseError {
    constructor() {
        super('An invalid durability ReplicateTo level was specified.');
    }
}
exports.InvalidDurabilityReplicateToLevel = InvalidDurabilityReplicateToLevel;
/**
 * Indicates that the operation timed out.
 *
 * @category Error Handling
 */
class TimeoutError extends CouchbaseError {
    constructor(cause, context) {
        super('timeout', cause, context);
    }
}
exports.TimeoutError = TimeoutError;
/**
 * Indicates that the request was explicitly cancelled.
 *
 * @category Error Handling
 */
class RequestCanceledError extends CouchbaseError {
    constructor(cause, context) {
        super('request canceled', cause, context);
    }
}
exports.RequestCanceledError = RequestCanceledError;
/**
 * Indicates that one of the passed arguments was invalid.
 *
 * @category Error Handling
 */
class InvalidArgumentError extends CouchbaseError {
    constructor(cause, context) {
        super('invalid argument', cause, context);
    }
}
exports.InvalidArgumentError = InvalidArgumentError;
/**
 * Indicates that the operation requires a service which was not available.
 * For instance, attempting to perform a query without the query service
 * being enabled.
 *
 * @category Error Handling
 */
class ServiceNotAvailableError extends CouchbaseError {
    constructor(cause, context) {
        super('service not available', cause, context);
    }
}
exports.ServiceNotAvailableError = ServiceNotAvailableError;
/**
 * Indicates some form of internal error occured on the server and the
 * request could not be completed.
 *
 * @category Error Handling
 */
class InternalServerFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('internal server failure', cause, context);
    }
}
exports.InternalServerFailureError = InternalServerFailureError;
/**
 * Indicates that an error occurred authenticating the user to the cluster.
 *
 * @category Error Handling
 */
class AuthenticationFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('authentication failure', cause, context);
    }
}
exports.AuthenticationFailureError = AuthenticationFailureError;
/**
 * Indicates that a temporary failure occured, attempting the same operation
 * in the future may succeed.
 *
 * @category Error Handling
 */
class TemporaryFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('temporary failure', cause, context);
    }
}
exports.TemporaryFailureError = TemporaryFailureError;
/**
 * Indicates that a parsing failure occured.
 *
 * @category Error Handling
 */
class ParsingFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('parsing failure', cause, context);
    }
}
exports.ParsingFailureError = ParsingFailureError;
/**
 * Indicates that a CAS mismatch occurred.  This means that the document
 * has changed since the last access and should be fetched again before
 * attempting to make further changes.
 *
 * @category Error Handling
 */
class CasMismatchError extends CouchbaseError {
    constructor(cause, context) {
        super('cas mismatch', cause, context);
    }
}
exports.CasMismatchError = CasMismatchError;
/**
 * Indicates that the bucket being referenced does not exist.
 *
 * @category Error Handling
 */
class BucketNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('bucket not found', cause, context);
    }
}
exports.BucketNotFoundError = BucketNotFoundError;
/**
 * Indicates that the collection being referenced does not exist.
 *
 * @category Error Handling
 */
class CollectionNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('collection not found', cause, context);
    }
}
exports.CollectionNotFoundError = CollectionNotFoundError;
/**
 * Indicates that there was a failure during encoding.
 *
 * @category Error Handling
 */
class EncodingFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('encoding failure', cause, context);
    }
}
exports.EncodingFailureError = EncodingFailureError;
/**
 * Indicates that there was a failure during decoding.
 *
 * @category Error Handling
 */
class DecodingFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('decoding failure', cause, context);
    }
}
exports.DecodingFailureError = DecodingFailureError;
/**
 * Indicates that an operation which is not supported was executed.
 *
 * @category Error Handling
 */
class UnsupportedOperationError extends CouchbaseError {
    constructor(cause, context) {
        super('unsupported operation', cause, context);
    }
}
exports.UnsupportedOperationError = UnsupportedOperationError;
/**
 * Indicates that an ambiguous timeout has occured.  The outcome of the
 * operation is unknown, and it is possible that it completed after the
 * generation of this error.
 *
 * @category Error Handling
 */
class AmbiguousTimeoutError extends TimeoutError {
    constructor(cause, context) {
        super(cause, context);
        this.message = 'ambiguous timeout';
    }
}
exports.AmbiguousTimeoutError = AmbiguousTimeoutError;
/**
 * Indicates an unambiguous timeout has occurred.  The outcome of the
 * operation is objective failure and it is known to have not completed.
 *
 * @category Error Handling
 */
class UnambiguousTimeoutError extends TimeoutError {
    constructor(cause, context) {
        super(cause, context);
        this.message = 'unambiguous timeout';
    }
}
exports.UnambiguousTimeoutError = UnambiguousTimeoutError;
/**
 * Indicates a feature which is not available was used.  This primarily can
 * occur if you attempt to perform a query when no query services are enabled
 * on the cluster, or if a newer server feature which is not available in the
 * connected server version is used.
 *
 * @category Error Handling
 */
class FeatureNotAvailableError extends CouchbaseError {
    constructor(cause, context) {
        super('feature not available', cause, context);
    }
}
exports.FeatureNotAvailableError = FeatureNotAvailableError;
/**
 * Indicates that the referenced scope does not exist.
 *
 * @category Error Handling
 */
class ScopeNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('scope not found', cause, context);
    }
}
exports.ScopeNotFoundError = ScopeNotFoundError;
/**
 * Indicates that the referenced index does not exist.
 *
 * @category Error Handling
 */
class IndexNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('index not found', cause, context);
    }
}
exports.IndexNotFoundError = IndexNotFoundError;
/**
 * Indicates that a rate limit was exceeded while attempting to
 * execute the operation.
 *
 * @category Error Handling
 */
class RateLimitedError extends CouchbaseError {
    constructor(cause, context) {
        super('operation was rate limited', cause, context);
    }
}
exports.RateLimitedError = RateLimitedError;
/**
 * Indicates that a quota limit was exceeded while attempting to
 * execute the operation.
 *
 * @category Error Handling
 */
class QuotaLimitedError extends CouchbaseError {
    constructor(cause, context) {
        super('operation was quota limited', cause, context);
    }
}
exports.QuotaLimitedError = QuotaLimitedError;
/**
 * Indicates that the referenced index already existed, but was expected
 * to not yet exist for the operation.
 *
 * @category Error Handling
 */
class IndexExistsError extends CouchbaseError {
    constructor(cause, context) {
        super('index exists', cause, context);
    }
}
exports.IndexExistsError = IndexExistsError;
/**
 * Indicates that the referenced document does not exist.
 *
 * @category Error Handling
 */
class DocumentNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('document not found', cause, context);
    }
}
exports.DocumentNotFoundError = DocumentNotFoundError;
/**
 * Indicates that the referenced document could not be retrieved.
 *
 * @category Error Handling
 */
class DocumentUnretrievableError extends CouchbaseError {
    constructor(cause, context) {
        super('document unretrievable', cause, context);
    }
}
exports.DocumentUnretrievableError = DocumentUnretrievableError;
/**
 * Indicates that the referenced document could not be used as it is currently
 * locked, likely by another actor in the system.
 *
 * @category Error Handling
 */
class DocumentLockedError extends CouchbaseError {
    constructor(cause, context) {
        super('document locked', cause, context);
    }
}
exports.DocumentLockedError = DocumentLockedError;
/**
 * Indicates that the referenced document is not locked.  Generally raised when an unlock
 * operation is performed.
 *
 * @category Error Handling
 */
class DocumentNotLockedError extends CouchbaseError {
    constructor(cause, context) {
        super('document not locked', cause, context);
    }
}
exports.DocumentNotLockedError = DocumentNotLockedError;
/**
 * Indicates that a value could not be stored as it was too large.
 *
 * @category Error Handling
 */
class ValueTooLargeError extends CouchbaseError {
    constructor(cause, context) {
        super('value too large', cause, context);
    }
}
exports.ValueTooLargeError = ValueTooLargeError;
/**
 * Indicates that the referenced document exists already, but the operation
 * was not expecting it to exist.
 *
 * @category Error Handling
 */
class DocumentExistsError extends CouchbaseError {
    constructor(cause, context) {
        super('document exists', cause, context);
    }
}
exports.DocumentExistsError = DocumentExistsError;
/**
 * Indicates that a JSON operation was attempted with non-JSON data.
 *
 * @category Error Handling
 */
class ValueNotJsonError extends CouchbaseError {
    constructor(cause, context) {
        super('value not json', cause, context);
    }
}
exports.ValueNotJsonError = ValueNotJsonError;
/**
 * Indicates that a durability level which is not available was specified.
 *
 * @category Error Handling
 */
class DurabilityLevelNotAvailableError extends CouchbaseError {
    constructor(cause, context) {
        super('durability level not available', cause, context);
    }
}
exports.DurabilityLevelNotAvailableError = DurabilityLevelNotAvailableError;
/**
 * Indicates that a durability level which is impossible to achieve was
 * specified.  This can occur when you try to use Majority but there is
 * less than the majority of nodes available.
 *
 * @category Error Handling
 */
class DurabilityImpossibleError extends CouchbaseError {
    constructor(cause, context) {
        super('durability impossible', cause, context);
    }
}
exports.DurabilityImpossibleError = DurabilityImpossibleError;
/**
 * Indicates that the durable operation that was performed has failed
 * ambiguously and may or may not have completed, or may complete in
 * the future.
 *
 * @category Error Handling
 */
class DurabilityAmbiguousError extends CouchbaseError {
    constructor(cause, context) {
        super('durability ambiguous', cause, context);
    }
}
exports.DurabilityAmbiguousError = DurabilityAmbiguousError;
/**
 * Indicates that a write was failed as an existing durable write against
 * that key is already in progress.
 *
 * @category Error Handling
 */
class DurableWriteInProgressError extends CouchbaseError {
    constructor(cause, context) {
        super('durable write in progress', cause, context);
    }
}
exports.DurableWriteInProgressError = DurableWriteInProgressError;
/**
 * Indicates that a write was failed as the server is currently reconstructing
 * it's durable data following a failover.
 *
 * @category Error Handling
 */
class DurableWriteReCommitInProgressError extends CouchbaseError {
    constructor(cause, context) {
        super('durable write recommit in progress', cause, context);
    }
}
exports.DurableWriteReCommitInProgressError = DurableWriteReCommitInProgressError;
/**
 * Indicates that a mutation was lost.
 *
 * @category Error Handling
 */
class MutationLostError extends CouchbaseError {
    constructor(cause, context) {
        super('mutation lost', cause, context);
    }
}
exports.MutationLostError = MutationLostError;
/**
 * Indicates that the reference path was not found.
 *
 * @category Error Handling
 */
class PathNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('path not found', cause, context);
    }
}
exports.PathNotFoundError = PathNotFoundError;
/**
 * Indicates that the referenced path made incorrect assumptions about
 * the structure of a document, for instance attempting to access a field
 * as an object when in fact it is an array.
 *
 * @category Error Handling
 */
class PathMismatchError extends CouchbaseError {
    constructor(cause, context) {
        super('path mismatch', cause, context);
    }
}
exports.PathMismatchError = PathMismatchError;
/**
 * Indicates that the referenced path is not valid.
 *
 * @category Error Handling
 */
class PathInvalidError extends CouchbaseError {
    constructor(cause, context) {
        super('path invalid', cause, context);
    }
}
exports.PathInvalidError = PathInvalidError;
/**
 * Indicates that the specified path was too large to parse.
 *
 * @category Error Handling
 */
class PathTooBigError extends CouchbaseError {
    constructor(cause, context) {
        super('path too big', cause, context);
    }
}
exports.PathTooBigError = PathTooBigError;
/**
 * Indicates that the referenced path was too deep to parse.
 *
 * @category Error Handling
 */
class PathTooDeepError extends CouchbaseError {
    constructor(cause, context) {
        super('path too deep', cause, context);
    }
}
exports.PathTooDeepError = PathTooDeepError;
/**
 * Indicates that the document created by the operation would become
 * too deep to operate on.
 *
 * @category Error Handling
 */
class ValueTooDeepError extends CouchbaseError {
    constructor(cause, context) {
        super('value too deep', cause, context);
    }
}
exports.ValueTooDeepError = ValueTooDeepError;
/**
 * Indicates that the value passed is invalid.
 *
 * @category Error Handling
 */
class ValueInvalidError extends CouchbaseError {
    constructor(cause, context) {
        super('value invalid', cause, context);
    }
}
exports.ValueInvalidError = ValueInvalidError;
/**
 * Indicates that an operation expecting JSON was performed against a document
 * which is not JSON.
 *
 * @category Error Handling
 */
class DocumentNotJsonError extends CouchbaseError {
    constructor(cause, context) {
        super('document not json', cause, context);
    }
}
exports.DocumentNotJsonError = DocumentNotJsonError;
/**
 * Indicates that a number has grown too large.
 *
 * @category Error Handling
 */
class NumberTooBigError extends CouchbaseError {
    constructor(cause, context) {
        super('number too big', cause, context);
    }
}
exports.NumberTooBigError = NumberTooBigError;
/**
 * Indicates that the delta specified is invalid.
 *
 * @category Error Handling
 */
class DeltaInvalidError extends CouchbaseError {
    constructor(cause, context) {
        super('delta invalid', cause, context);
    }
}
exports.DeltaInvalidError = DeltaInvalidError;
/**
 * Indicates that the reference path already existed, but the operation
 * expected that it did not.
 *
 * @category Error Handling
 */
class PathExistsError extends CouchbaseError {
    constructor(cause, context) {
        super('path exists', cause, context);
    }
}
exports.PathExistsError = PathExistsError;
/**
 * Indicates that a failure occurred while planning a query.
 *
 * @category Error Handling
 */
class PlanningFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('planning failure', cause, context);
    }
}
exports.PlanningFailureError = PlanningFailureError;
/**
 * Indicates that a failure occured while querying an index.
 *
 * @category Error Handling
 */
class IndexFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('index failure', cause, context);
    }
}
exports.IndexFailureError = IndexFailureError;
/**
 * Indicates that an error occurred with a prepared statement.
 *
 * @category Error Handling
 */
class PreparedStatementFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('prepared statement failure', cause, context);
    }
}
exports.PreparedStatementFailureError = PreparedStatementFailureError;
/**
 * Indicates that a generic DML error occurred with a query.
 *
 * @category Error Handling
 */
class DmlFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('generic dml failure', cause, context);
    }
}
exports.DmlFailureError = DmlFailureError;
/**
 * Indicates that the index was not ready yet.
 *
 * @category Error Handling
 */
class IndexNotReadyError extends CouchbaseError {
    constructor(cause, context) {
        super('index not ready', cause, context);
    }
}
exports.IndexNotReadyError = IndexNotReadyError;
/**
 * Indicates that an error occurred while compiling a query.
 *
 * @category Error Handling
 */
class CompilationFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('compilation failure', cause, context);
    }
}
exports.CompilationFailureError = CompilationFailureError;
/**
 * Indicates that the job queue for the service was full and further requests will
 * be rejected for a period of time until the queue shrinks.
 *
 * @category Error Handling
 */
class JobQueueFullError extends CouchbaseError {
    constructor(cause, context) {
        super('job queue full', cause, context);
    }
}
exports.JobQueueFullError = JobQueueFullError;
/**
 * Indicates that the referenced dataset does not exist.
 *
 * @category Error Handling
 */
class DatasetNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('dataset not found', cause, context);
    }
}
exports.DatasetNotFoundError = DatasetNotFoundError;
/**
 * Indicates that the referenced dataverse does not exist.
 *
 * @category Error Handling
 */
class DataverseNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('dataverse not found', cause, context);
    }
}
exports.DataverseNotFoundError = DataverseNotFoundError;
/**
 * Indicates that the referenced dataset already exists, but the operation
 * expected that it did not.
 *
 * @category Error Handling
 */
class DatasetExistsError extends CouchbaseError {
    constructor(cause, context) {
        super('dataset exists', cause, context);
    }
}
exports.DatasetExistsError = DatasetExistsError;
/**
 * Indicates that the referenced dataverse already exists, but the operation
 * expected that it did not.
 *
 * @category Error Handling
 */
class DataverseExistsError extends CouchbaseError {
    constructor(cause, context) {
        super('dataverse exists', cause, context);
    }
}
exports.DataverseExistsError = DataverseExistsError;
/**
 * Indicates that the referenced link does not exist.
 *
 * @category Error Handling
 */
class LinkNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('link not found', cause, context);
    }
}
exports.LinkNotFoundError = LinkNotFoundError;
/**
 * Indicates that the link already exists.
 *
 * @category Error Handling
 */
class LinkExistsError extends CouchbaseError {
    constructor(cause, context) {
        super('link already exists', cause, context);
    }
}
exports.LinkExistsError = LinkExistsError;
/**
 * Indicates that the referenced view does not exist.
 *
 * @category Error Handling
 */
class ViewNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('view not found', cause, context);
    }
}
exports.ViewNotFoundError = ViewNotFoundError;
/**
 * Indicates that the referenced design document does not exist.
 *
 * @category Error Handling
 */
class DesignDocumentNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('design document not found', cause, context);
    }
}
exports.DesignDocumentNotFoundError = DesignDocumentNotFoundError;
/**
 * Indicates that the referenced collection already exists, but the operation
 * expected that it did not.
 *
 * @category Error Handling
 */
class CollectionExistsError extends CouchbaseError {
    constructor(cause, context) {
        super('collection exists', cause, context);
    }
}
exports.CollectionExistsError = CollectionExistsError;
/**
 * Indicates that the referenced scope already exists, but the operation
 * expected that it did not.
 *
 * @category Error Handling
 */
class ScopeExistsError extends CouchbaseError {
    constructor(cause, context) {
        super('scope exists', cause, context);
    }
}
exports.ScopeExistsError = ScopeExistsError;
/**
 * Indicates that the referenced user does not exist.
 *
 * @category Error Handling
 */
class UserNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('user not found', cause, context);
    }
}
exports.UserNotFoundError = UserNotFoundError;
/**
 * Indicates that the referenced group does not exist.
 *
 * @category Error Handling
 */
class GroupNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('group not found', cause, context);
    }
}
exports.GroupNotFoundError = GroupNotFoundError;
/**
 * Indicates that the referenced bucket already exists, but the operation
 * expected it to not exist.
 *
 * @category Error Handling
 */
class BucketExistsError extends CouchbaseError {
    constructor(cause, context) {
        super('bucket exists', cause, context);
    }
}
exports.BucketExistsError = BucketExistsError;
/**
 * Indicates that the referenced user already exists, but the operation
 * expected it to not exist.
 *
 * @category Error Handling
 */
class UserExistsError extends CouchbaseError {
    constructor(cause, context) {
        super('user exists', cause, context);
    }
}
exports.UserExistsError = UserExistsError;
/**
 * Indicates that the bucket could not be flushed due to not having the flush
 * option enabled.  This option can be dynamically adjusted.
 *
 * @category Error Handling
 */
class BucketNotFlushableError extends CouchbaseError {
    constructor(cause, context) {
        super('bucket not flushable', cause, context);
    }
}
exports.BucketNotFlushableError = BucketNotFlushableError;
/**
 * Indicates that the referenced eventing function does not exist.
 *
 * @category Error Handling
 */
class EventingFunctionNotFoundError extends CouchbaseError {
    constructor(cause, context) {
        super('eventing function not found', cause, context);
    }
}
exports.EventingFunctionNotFoundError = EventingFunctionNotFoundError;
/**
 * Indicates that the referenced eventing function was not deployed but was
 * expected to have been.
 *
 * @category Error Handling
 */
class EventingFunctionNotDeployedError extends CouchbaseError {
    constructor(cause, context) {
        super('eventing function not deployed', cause, context);
    }
}
exports.EventingFunctionNotDeployedError = EventingFunctionNotDeployedError;
/**
 * Indicates that the eventing function was not able to be compiled.
 *
 * @category Error Handling
 */
class EventingFunctionCompilationFailureError extends CouchbaseError {
    constructor(cause, context) {
        super('eventing function compilation failed', cause, context);
    }
}
exports.EventingFunctionCompilationFailureError = EventingFunctionCompilationFailureError;
/**
 * Indicates that the source and metadata keyspaces both referenced the same
 * place for an eventing function.
 *
 * @category Error Handling
 */
class EventingFunctionIdenticalKeyspaceError extends CouchbaseError {
    constructor(cause, context) {
        super('eventing function identical keyspace', cause, context);
    }
}
exports.EventingFunctionIdenticalKeyspaceError = EventingFunctionIdenticalKeyspaceError;
/**
 * Indicates that an eventing function was deployed but has not yet fully
 * completed the bootstrapping process.
 *
 * @category Error Handling
 */
class EventingFunctionNotBootstrappedError extends CouchbaseError {
    constructor(cause, context) {
        super('eventing function not bootstrapped', cause, context);
    }
}
exports.EventingFunctionNotBootstrappedError = EventingFunctionNotBootstrappedError;
/**
 * Indicates that an eventing function is deployed but the operation expected
 * that it was not.
 *
 * @category Error Handling
 */
class EventingFunctionDeployedError extends CouchbaseError {
    constructor(cause, context) {
        super('eventing function deployed', cause, context);
    }
}
exports.EventingFunctionDeployedError = EventingFunctionDeployedError;
/**
 * Indicates that an eventing function is paused but the operation expected
 * that it was not.
 *
 * @category Error Handling
 */
class EventingFunctionPausedError extends CouchbaseError {
    constructor(cause, context) {
        super('eventing function paused', cause, context);
    }
}
exports.EventingFunctionPausedError = EventingFunctionPausedError;
/**
 * Indicates a transaction operation failed to complete.
 *
 * @category Error Handling
 */
class TransactionOperationFailedError extends CouchbaseError {
    constructor(cause, context) {
        super('transaction operation failed', cause, context);
    }
}
exports.TransactionOperationFailedError = TransactionOperationFailedError;
/**
 * Indicates a transaction failed to complete.
 *
 * @category Error Handling
 */
class TransactionFailedError extends CouchbaseError {
    constructor(cause, context) {
        super('transaction failed', cause, context);
    }
}
exports.TransactionFailedError = TransactionFailedError;
/**
 * Indicates a transaction failed to complete due to expiring.
 *
 * @category Error Handling
 */
class TransactionExpiredError extends CouchbaseError {
    constructor(cause) {
        super('transaction expired', cause);
    }
}
exports.TransactionExpiredError = TransactionExpiredError;
/**
 * Indicates the state of a transaction ended as ambiguous and may or
 * may not have committed successfully.
 *
 * @category Error Handling
 */
class TransactionCommitAmbiguousError extends CouchbaseError {
    constructor(cause) {
        super('transaction commit ambiguous', cause);
    }
}
exports.TransactionCommitAmbiguousError = TransactionCommitAmbiguousError;
