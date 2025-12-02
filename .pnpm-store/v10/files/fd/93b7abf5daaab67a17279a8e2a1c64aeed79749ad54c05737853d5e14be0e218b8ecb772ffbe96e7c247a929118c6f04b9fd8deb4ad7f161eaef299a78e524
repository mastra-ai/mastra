/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { GelError } from "./base";
import * as tags from "./tags";
export { GelError } from "./base";
export * from "./tags";
export declare class InternalServerError extends GelError {
    get code(): number;
}
export declare class UnsupportedFeatureError extends GelError {
    get code(): number;
}
export declare class ProtocolError extends GelError {
    get code(): number;
}
export declare class BinaryProtocolError extends ProtocolError {
    get code(): number;
}
export declare class UnsupportedProtocolVersionError extends BinaryProtocolError {
    get code(): number;
}
export declare class TypeSpecNotFoundError extends BinaryProtocolError {
    get code(): number;
}
export declare class UnexpectedMessageError extends BinaryProtocolError {
    get code(): number;
}
export declare class InputDataError extends ProtocolError {
    get code(): number;
}
export declare class ParameterTypeMismatchError extends InputDataError {
    get code(): number;
}
export declare class StateMismatchError extends InputDataError {
    protected static tags: {
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class ResultCardinalityMismatchError extends ProtocolError {
    get code(): number;
}
export declare class CapabilityError extends ProtocolError {
    get code(): number;
}
export declare class UnsupportedCapabilityError extends CapabilityError {
    get code(): number;
}
export declare class DisabledCapabilityError extends CapabilityError {
    get code(): number;
}
export declare class UnsafeIsolationLevelError extends CapabilityError {
    get code(): number;
}
export declare class QueryError extends GelError {
    get code(): number;
}
export declare class InvalidSyntaxError extends QueryError {
    get code(): number;
}
export declare class EdgeQLSyntaxError extends InvalidSyntaxError {
    get code(): number;
}
export declare class SchemaSyntaxError extends InvalidSyntaxError {
    get code(): number;
}
export declare class GraphQLSyntaxError extends InvalidSyntaxError {
    get code(): number;
}
export declare class InvalidTypeError extends QueryError {
    get code(): number;
}
export declare class InvalidTargetError extends InvalidTypeError {
    get code(): number;
}
export declare class InvalidLinkTargetError extends InvalidTargetError {
    get code(): number;
}
export declare class InvalidPropertyTargetError extends InvalidTargetError {
    get code(): number;
}
export declare class InvalidReferenceError extends QueryError {
    get code(): number;
}
export declare class UnknownModuleError extends InvalidReferenceError {
    get code(): number;
}
export declare class UnknownLinkError extends InvalidReferenceError {
    get code(): number;
}
export declare class UnknownPropertyError extends InvalidReferenceError {
    get code(): number;
}
export declare class UnknownUserError extends InvalidReferenceError {
    get code(): number;
}
export declare class UnknownDatabaseError extends InvalidReferenceError {
    get code(): number;
}
export declare class UnknownParameterError extends InvalidReferenceError {
    get code(): number;
}
export declare class DeprecatedScopingError extends InvalidReferenceError {
    get code(): number;
}
export declare class SchemaError extends QueryError {
    get code(): number;
}
export declare class SchemaDefinitionError extends QueryError {
    get code(): number;
}
export declare class InvalidDefinitionError extends SchemaDefinitionError {
    get code(): number;
}
export declare class InvalidModuleDefinitionError extends InvalidDefinitionError {
    get code(): number;
}
export declare class InvalidLinkDefinitionError extends InvalidDefinitionError {
    get code(): number;
}
export declare class InvalidPropertyDefinitionError extends InvalidDefinitionError {
    get code(): number;
}
export declare class InvalidUserDefinitionError extends InvalidDefinitionError {
    get code(): number;
}
export declare class InvalidDatabaseDefinitionError extends InvalidDefinitionError {
    get code(): number;
}
export declare class InvalidOperatorDefinitionError extends InvalidDefinitionError {
    get code(): number;
}
export declare class InvalidAliasDefinitionError extends InvalidDefinitionError {
    get code(): number;
}
export declare class InvalidFunctionDefinitionError extends InvalidDefinitionError {
    get code(): number;
}
export declare class InvalidConstraintDefinitionError extends InvalidDefinitionError {
    get code(): number;
}
export declare class InvalidCastDefinitionError extends InvalidDefinitionError {
    get code(): number;
}
export declare class DuplicateDefinitionError extends SchemaDefinitionError {
    get code(): number;
}
export declare class DuplicateModuleDefinitionError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class DuplicateLinkDefinitionError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class DuplicatePropertyDefinitionError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class DuplicateUserDefinitionError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class DuplicateDatabaseDefinitionError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class DuplicateOperatorDefinitionError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class DuplicateViewDefinitionError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class DuplicateFunctionDefinitionError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class DuplicateConstraintDefinitionError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class DuplicateCastDefinitionError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class DuplicateMigrationError extends DuplicateDefinitionError {
    get code(): number;
}
export declare class SessionTimeoutError extends QueryError {
    get code(): number;
}
export declare class IdleSessionTimeoutError extends SessionTimeoutError {
    protected static tags: {
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class QueryTimeoutError extends SessionTimeoutError {
    get code(): number;
}
export declare class TransactionTimeoutError extends SessionTimeoutError {
    get code(): number;
}
export declare class IdleTransactionTimeoutError extends TransactionTimeoutError {
    get code(): number;
}
export declare class ExecutionError extends GelError {
    get code(): number;
}
export declare class InvalidValueError extends ExecutionError {
    get code(): number;
}
export declare class DivisionByZeroError extends InvalidValueError {
    get code(): number;
}
export declare class NumericOutOfRangeError extends InvalidValueError {
    get code(): number;
}
export declare class AccessPolicyError extends InvalidValueError {
    get code(): number;
}
export declare class QueryAssertionError extends InvalidValueError {
    get code(): number;
}
export declare class IntegrityError extends ExecutionError {
    get code(): number;
}
export declare class ConstraintViolationError extends IntegrityError {
    get code(): number;
}
export declare class CardinalityViolationError extends IntegrityError {
    get code(): number;
}
export declare class MissingRequiredError extends IntegrityError {
    get code(): number;
}
export declare class TransactionError extends ExecutionError {
    get code(): number;
}
export declare class TransactionConflictError extends TransactionError {
    protected static tags: {
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class TransactionSerializationError extends TransactionConflictError {
    protected static tags: {
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class TransactionDeadlockError extends TransactionConflictError {
    protected static tags: {
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class WatchError extends ExecutionError {
    get code(): number;
}
export declare class ConfigurationError extends GelError {
    get code(): number;
}
export declare class AccessError extends GelError {
    get code(): number;
}
export declare class AuthenticationError extends AccessError {
    get code(): number;
}
export declare class AvailabilityError extends GelError {
    get code(): number;
}
export declare class BackendUnavailableError extends AvailabilityError {
    protected static tags: {
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class ServerOfflineError extends AvailabilityError {
    protected static tags: {
        [tags.SHOULD_RECONNECT]: boolean;
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class UnknownTenantError extends AvailabilityError {
    protected static tags: {
        [tags.SHOULD_RECONNECT]: boolean;
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class ServerBlockedError extends AvailabilityError {
    get code(): number;
}
export declare class BackendError extends GelError {
    get code(): number;
}
export declare class UnsupportedBackendFeatureError extends BackendError {
    get code(): number;
}
export declare class LogMessage extends GelError {
    get code(): number;
}
export declare class WarningMessage extends LogMessage {
    get code(): number;
}
export declare class StatusMessage extends LogMessage {
    get code(): number;
}
export declare class MigrationStatusMessage extends StatusMessage {
    get code(): number;
}
export declare class ClientError extends GelError {
    get code(): number;
}
export declare class ClientConnectionError extends ClientError {
    get code(): number;
}
export declare class ClientConnectionFailedError extends ClientConnectionError {
    get code(): number;
}
export declare class ClientConnectionFailedTemporarilyError extends ClientConnectionFailedError {
    protected static tags: {
        [tags.SHOULD_RECONNECT]: boolean;
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class ClientConnectionTimeoutError extends ClientConnectionError {
    protected static tags: {
        [tags.SHOULD_RECONNECT]: boolean;
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class ClientConnectionClosedError extends ClientConnectionError {
    protected static tags: {
        [tags.SHOULD_RECONNECT]: boolean;
        [tags.SHOULD_RETRY]: boolean;
    };
    get code(): number;
}
export declare class InterfaceError extends ClientError {
    get code(): number;
}
export declare class QueryArgumentError extends InterfaceError {
    get code(): number;
}
export declare class MissingArgumentError extends QueryArgumentError {
    get code(): number;
}
export declare class UnknownArgumentError extends QueryArgumentError {
    get code(): number;
}
export declare class InvalidArgumentError extends QueryArgumentError {
    get code(): number;
}
export declare class NoDataError extends ClientError {
    get code(): number;
}
export declare class InternalClientError extends ClientError {
    get code(): number;
}
