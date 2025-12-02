"use strict";
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicatePropertyDefinitionError = exports.DuplicateLinkDefinitionError = exports.DuplicateModuleDefinitionError = exports.DuplicateDefinitionError = exports.InvalidCastDefinitionError = exports.InvalidConstraintDefinitionError = exports.InvalidFunctionDefinitionError = exports.InvalidAliasDefinitionError = exports.InvalidOperatorDefinitionError = exports.InvalidDatabaseDefinitionError = exports.InvalidUserDefinitionError = exports.InvalidPropertyDefinitionError = exports.InvalidLinkDefinitionError = exports.InvalidModuleDefinitionError = exports.InvalidDefinitionError = exports.SchemaDefinitionError = exports.SchemaError = exports.DeprecatedScopingError = exports.UnknownParameterError = exports.UnknownDatabaseError = exports.UnknownUserError = exports.UnknownPropertyError = exports.UnknownLinkError = exports.UnknownModuleError = exports.InvalidReferenceError = exports.InvalidPropertyTargetError = exports.InvalidLinkTargetError = exports.InvalidTargetError = exports.InvalidTypeError = exports.GraphQLSyntaxError = exports.SchemaSyntaxError = exports.EdgeQLSyntaxError = exports.InvalidSyntaxError = exports.QueryError = exports.UnsafeIsolationLevelError = exports.DisabledCapabilityError = exports.UnsupportedCapabilityError = exports.CapabilityError = exports.ResultCardinalityMismatchError = exports.StateMismatchError = exports.ParameterTypeMismatchError = exports.InputDataError = exports.UnexpectedMessageError = exports.TypeSpecNotFoundError = exports.UnsupportedProtocolVersionError = exports.BinaryProtocolError = exports.ProtocolError = exports.UnsupportedFeatureError = exports.InternalServerError = exports.GelError = void 0;
exports.QueryArgumentError = exports.InterfaceError = exports.ClientConnectionClosedError = exports.ClientConnectionTimeoutError = exports.ClientConnectionFailedTemporarilyError = exports.ClientConnectionFailedError = exports.ClientConnectionError = exports.ClientError = exports.MigrationStatusMessage = exports.StatusMessage = exports.WarningMessage = exports.LogMessage = exports.UnsupportedBackendFeatureError = exports.BackendError = exports.ServerBlockedError = exports.UnknownTenantError = exports.ServerOfflineError = exports.BackendUnavailableError = exports.AvailabilityError = exports.AuthenticationError = exports.AccessError = exports.ConfigurationError = exports.WatchError = exports.TransactionDeadlockError = exports.TransactionSerializationError = exports.TransactionConflictError = exports.TransactionError = exports.MissingRequiredError = exports.CardinalityViolationError = exports.ConstraintViolationError = exports.IntegrityError = exports.QueryAssertionError = exports.AccessPolicyError = exports.NumericOutOfRangeError = exports.DivisionByZeroError = exports.InvalidValueError = exports.ExecutionError = exports.IdleTransactionTimeoutError = exports.TransactionTimeoutError = exports.QueryTimeoutError = exports.IdleSessionTimeoutError = exports.SessionTimeoutError = exports.DuplicateMigrationError = exports.DuplicateCastDefinitionError = exports.DuplicateConstraintDefinitionError = exports.DuplicateFunctionDefinitionError = exports.DuplicateViewDefinitionError = exports.DuplicateOperatorDefinitionError = exports.DuplicateDatabaseDefinitionError = exports.DuplicateUserDefinitionError = void 0;
exports.InternalClientError = exports.NoDataError = exports.InvalidArgumentError = exports.UnknownArgumentError = exports.MissingArgumentError = void 0;
const base_1 = require("./base");
const tags = __importStar(require("./tags"));
var base_2 = require("./base");
Object.defineProperty(exports, "GelError", { enumerable: true, get: function () { return base_2.GelError; } });
__exportStar(require("./tags"), exports);
class InternalServerError extends base_1.GelError {
    get code() {
        return 0x01_00_00_00;
    }
}
exports.InternalServerError = InternalServerError;
class UnsupportedFeatureError extends base_1.GelError {
    get code() {
        return 0x02_00_00_00;
    }
}
exports.UnsupportedFeatureError = UnsupportedFeatureError;
class ProtocolError extends base_1.GelError {
    get code() {
        return 0x03_00_00_00;
    }
}
exports.ProtocolError = ProtocolError;
class BinaryProtocolError extends ProtocolError {
    get code() {
        return 0x03_01_00_00;
    }
}
exports.BinaryProtocolError = BinaryProtocolError;
class UnsupportedProtocolVersionError extends BinaryProtocolError {
    get code() {
        return 0x03_01_00_01;
    }
}
exports.UnsupportedProtocolVersionError = UnsupportedProtocolVersionError;
class TypeSpecNotFoundError extends BinaryProtocolError {
    get code() {
        return 0x03_01_00_02;
    }
}
exports.TypeSpecNotFoundError = TypeSpecNotFoundError;
class UnexpectedMessageError extends BinaryProtocolError {
    get code() {
        return 0x03_01_00_03;
    }
}
exports.UnexpectedMessageError = UnexpectedMessageError;
class InputDataError extends ProtocolError {
    get code() {
        return 0x03_02_00_00;
    }
}
exports.InputDataError = InputDataError;
class ParameterTypeMismatchError extends InputDataError {
    get code() {
        return 0x03_02_01_00;
    }
}
exports.ParameterTypeMismatchError = ParameterTypeMismatchError;
class StateMismatchError extends InputDataError {
    static tags = { [tags.SHOULD_RETRY]: true };
    get code() {
        return 0x03_02_02_00;
    }
}
exports.StateMismatchError = StateMismatchError;
class ResultCardinalityMismatchError extends ProtocolError {
    get code() {
        return 0x03_03_00_00;
    }
}
exports.ResultCardinalityMismatchError = ResultCardinalityMismatchError;
class CapabilityError extends ProtocolError {
    get code() {
        return 0x03_04_00_00;
    }
}
exports.CapabilityError = CapabilityError;
class UnsupportedCapabilityError extends CapabilityError {
    get code() {
        return 0x03_04_01_00;
    }
}
exports.UnsupportedCapabilityError = UnsupportedCapabilityError;
class DisabledCapabilityError extends CapabilityError {
    get code() {
        return 0x03_04_02_00;
    }
}
exports.DisabledCapabilityError = DisabledCapabilityError;
class UnsafeIsolationLevelError extends CapabilityError {
    get code() {
        return 0x03_04_03_00;
    }
}
exports.UnsafeIsolationLevelError = UnsafeIsolationLevelError;
class QueryError extends base_1.GelError {
    get code() {
        return 0x04_00_00_00;
    }
}
exports.QueryError = QueryError;
class InvalidSyntaxError extends QueryError {
    get code() {
        return 0x04_01_00_00;
    }
}
exports.InvalidSyntaxError = InvalidSyntaxError;
class EdgeQLSyntaxError extends InvalidSyntaxError {
    get code() {
        return 0x04_01_01_00;
    }
}
exports.EdgeQLSyntaxError = EdgeQLSyntaxError;
class SchemaSyntaxError extends InvalidSyntaxError {
    get code() {
        return 0x04_01_02_00;
    }
}
exports.SchemaSyntaxError = SchemaSyntaxError;
class GraphQLSyntaxError extends InvalidSyntaxError {
    get code() {
        return 0x04_01_03_00;
    }
}
exports.GraphQLSyntaxError = GraphQLSyntaxError;
class InvalidTypeError extends QueryError {
    get code() {
        return 0x04_02_00_00;
    }
}
exports.InvalidTypeError = InvalidTypeError;
class InvalidTargetError extends InvalidTypeError {
    get code() {
        return 0x04_02_01_00;
    }
}
exports.InvalidTargetError = InvalidTargetError;
class InvalidLinkTargetError extends InvalidTargetError {
    get code() {
        return 0x04_02_01_01;
    }
}
exports.InvalidLinkTargetError = InvalidLinkTargetError;
class InvalidPropertyTargetError extends InvalidTargetError {
    get code() {
        return 0x04_02_01_02;
    }
}
exports.InvalidPropertyTargetError = InvalidPropertyTargetError;
class InvalidReferenceError extends QueryError {
    get code() {
        return 0x04_03_00_00;
    }
}
exports.InvalidReferenceError = InvalidReferenceError;
class UnknownModuleError extends InvalidReferenceError {
    get code() {
        return 0x04_03_00_01;
    }
}
exports.UnknownModuleError = UnknownModuleError;
class UnknownLinkError extends InvalidReferenceError {
    get code() {
        return 0x04_03_00_02;
    }
}
exports.UnknownLinkError = UnknownLinkError;
class UnknownPropertyError extends InvalidReferenceError {
    get code() {
        return 0x04_03_00_03;
    }
}
exports.UnknownPropertyError = UnknownPropertyError;
class UnknownUserError extends InvalidReferenceError {
    get code() {
        return 0x04_03_00_04;
    }
}
exports.UnknownUserError = UnknownUserError;
class UnknownDatabaseError extends InvalidReferenceError {
    get code() {
        return 0x04_03_00_05;
    }
}
exports.UnknownDatabaseError = UnknownDatabaseError;
class UnknownParameterError extends InvalidReferenceError {
    get code() {
        return 0x04_03_00_06;
    }
}
exports.UnknownParameterError = UnknownParameterError;
class DeprecatedScopingError extends InvalidReferenceError {
    get code() {
        return 0x04_03_00_07;
    }
}
exports.DeprecatedScopingError = DeprecatedScopingError;
class SchemaError extends QueryError {
    get code() {
        return 0x04_04_00_00;
    }
}
exports.SchemaError = SchemaError;
class SchemaDefinitionError extends QueryError {
    get code() {
        return 0x04_05_00_00;
    }
}
exports.SchemaDefinitionError = SchemaDefinitionError;
class InvalidDefinitionError extends SchemaDefinitionError {
    get code() {
        return 0x04_05_01_00;
    }
}
exports.InvalidDefinitionError = InvalidDefinitionError;
class InvalidModuleDefinitionError extends InvalidDefinitionError {
    get code() {
        return 0x04_05_01_01;
    }
}
exports.InvalidModuleDefinitionError = InvalidModuleDefinitionError;
class InvalidLinkDefinitionError extends InvalidDefinitionError {
    get code() {
        return 0x04_05_01_02;
    }
}
exports.InvalidLinkDefinitionError = InvalidLinkDefinitionError;
class InvalidPropertyDefinitionError extends InvalidDefinitionError {
    get code() {
        return 0x04_05_01_03;
    }
}
exports.InvalidPropertyDefinitionError = InvalidPropertyDefinitionError;
class InvalidUserDefinitionError extends InvalidDefinitionError {
    get code() {
        return 0x04_05_01_04;
    }
}
exports.InvalidUserDefinitionError = InvalidUserDefinitionError;
class InvalidDatabaseDefinitionError extends InvalidDefinitionError {
    get code() {
        return 0x04_05_01_05;
    }
}
exports.InvalidDatabaseDefinitionError = InvalidDatabaseDefinitionError;
class InvalidOperatorDefinitionError extends InvalidDefinitionError {
    get code() {
        return 0x04_05_01_06;
    }
}
exports.InvalidOperatorDefinitionError = InvalidOperatorDefinitionError;
class InvalidAliasDefinitionError extends InvalidDefinitionError {
    get code() {
        return 0x04_05_01_07;
    }
}
exports.InvalidAliasDefinitionError = InvalidAliasDefinitionError;
class InvalidFunctionDefinitionError extends InvalidDefinitionError {
    get code() {
        return 0x04_05_01_08;
    }
}
exports.InvalidFunctionDefinitionError = InvalidFunctionDefinitionError;
class InvalidConstraintDefinitionError extends InvalidDefinitionError {
    get code() {
        return 0x04_05_01_09;
    }
}
exports.InvalidConstraintDefinitionError = InvalidConstraintDefinitionError;
class InvalidCastDefinitionError extends InvalidDefinitionError {
    get code() {
        return 0x04_05_01_0a;
    }
}
exports.InvalidCastDefinitionError = InvalidCastDefinitionError;
class DuplicateDefinitionError extends SchemaDefinitionError {
    get code() {
        return 0x04_05_02_00;
    }
}
exports.DuplicateDefinitionError = DuplicateDefinitionError;
class DuplicateModuleDefinitionError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_01;
    }
}
exports.DuplicateModuleDefinitionError = DuplicateModuleDefinitionError;
class DuplicateLinkDefinitionError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_02;
    }
}
exports.DuplicateLinkDefinitionError = DuplicateLinkDefinitionError;
class DuplicatePropertyDefinitionError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_03;
    }
}
exports.DuplicatePropertyDefinitionError = DuplicatePropertyDefinitionError;
class DuplicateUserDefinitionError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_04;
    }
}
exports.DuplicateUserDefinitionError = DuplicateUserDefinitionError;
class DuplicateDatabaseDefinitionError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_05;
    }
}
exports.DuplicateDatabaseDefinitionError = DuplicateDatabaseDefinitionError;
class DuplicateOperatorDefinitionError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_06;
    }
}
exports.DuplicateOperatorDefinitionError = DuplicateOperatorDefinitionError;
class DuplicateViewDefinitionError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_07;
    }
}
exports.DuplicateViewDefinitionError = DuplicateViewDefinitionError;
class DuplicateFunctionDefinitionError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_08;
    }
}
exports.DuplicateFunctionDefinitionError = DuplicateFunctionDefinitionError;
class DuplicateConstraintDefinitionError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_09;
    }
}
exports.DuplicateConstraintDefinitionError = DuplicateConstraintDefinitionError;
class DuplicateCastDefinitionError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_0a;
    }
}
exports.DuplicateCastDefinitionError = DuplicateCastDefinitionError;
class DuplicateMigrationError extends DuplicateDefinitionError {
    get code() {
        return 0x04_05_02_0b;
    }
}
exports.DuplicateMigrationError = DuplicateMigrationError;
class SessionTimeoutError extends QueryError {
    get code() {
        return 0x04_06_00_00;
    }
}
exports.SessionTimeoutError = SessionTimeoutError;
class IdleSessionTimeoutError extends SessionTimeoutError {
    static tags = { [tags.SHOULD_RETRY]: true };
    get code() {
        return 0x04_06_01_00;
    }
}
exports.IdleSessionTimeoutError = IdleSessionTimeoutError;
class QueryTimeoutError extends SessionTimeoutError {
    get code() {
        return 0x04_06_02_00;
    }
}
exports.QueryTimeoutError = QueryTimeoutError;
class TransactionTimeoutError extends SessionTimeoutError {
    get code() {
        return 0x04_06_0a_00;
    }
}
exports.TransactionTimeoutError = TransactionTimeoutError;
class IdleTransactionTimeoutError extends TransactionTimeoutError {
    get code() {
        return 0x04_06_0a_01;
    }
}
exports.IdleTransactionTimeoutError = IdleTransactionTimeoutError;
class ExecutionError extends base_1.GelError {
    get code() {
        return 0x05_00_00_00;
    }
}
exports.ExecutionError = ExecutionError;
class InvalidValueError extends ExecutionError {
    get code() {
        return 0x05_01_00_00;
    }
}
exports.InvalidValueError = InvalidValueError;
class DivisionByZeroError extends InvalidValueError {
    get code() {
        return 0x05_01_00_01;
    }
}
exports.DivisionByZeroError = DivisionByZeroError;
class NumericOutOfRangeError extends InvalidValueError {
    get code() {
        return 0x05_01_00_02;
    }
}
exports.NumericOutOfRangeError = NumericOutOfRangeError;
class AccessPolicyError extends InvalidValueError {
    get code() {
        return 0x05_01_00_03;
    }
}
exports.AccessPolicyError = AccessPolicyError;
class QueryAssertionError extends InvalidValueError {
    get code() {
        return 0x05_01_00_04;
    }
}
exports.QueryAssertionError = QueryAssertionError;
class IntegrityError extends ExecutionError {
    get code() {
        return 0x05_02_00_00;
    }
}
exports.IntegrityError = IntegrityError;
class ConstraintViolationError extends IntegrityError {
    get code() {
        return 0x05_02_00_01;
    }
}
exports.ConstraintViolationError = ConstraintViolationError;
class CardinalityViolationError extends IntegrityError {
    get code() {
        return 0x05_02_00_02;
    }
}
exports.CardinalityViolationError = CardinalityViolationError;
class MissingRequiredError extends IntegrityError {
    get code() {
        return 0x05_02_00_03;
    }
}
exports.MissingRequiredError = MissingRequiredError;
class TransactionError extends ExecutionError {
    get code() {
        return 0x05_03_00_00;
    }
}
exports.TransactionError = TransactionError;
class TransactionConflictError extends TransactionError {
    static tags = { [tags.SHOULD_RETRY]: true };
    get code() {
        return 0x05_03_01_00;
    }
}
exports.TransactionConflictError = TransactionConflictError;
class TransactionSerializationError extends TransactionConflictError {
    static tags = { [tags.SHOULD_RETRY]: true };
    get code() {
        return 0x05_03_01_01;
    }
}
exports.TransactionSerializationError = TransactionSerializationError;
class TransactionDeadlockError extends TransactionConflictError {
    static tags = { [tags.SHOULD_RETRY]: true };
    get code() {
        return 0x05_03_01_02;
    }
}
exports.TransactionDeadlockError = TransactionDeadlockError;
class WatchError extends ExecutionError {
    get code() {
        return 0x05_04_00_00;
    }
}
exports.WatchError = WatchError;
class ConfigurationError extends base_1.GelError {
    get code() {
        return 0x06_00_00_00;
    }
}
exports.ConfigurationError = ConfigurationError;
class AccessError extends base_1.GelError {
    get code() {
        return 0x07_00_00_00;
    }
}
exports.AccessError = AccessError;
class AuthenticationError extends AccessError {
    get code() {
        return 0x07_01_00_00;
    }
}
exports.AuthenticationError = AuthenticationError;
class AvailabilityError extends base_1.GelError {
    get code() {
        return 0x08_00_00_00;
    }
}
exports.AvailabilityError = AvailabilityError;
class BackendUnavailableError extends AvailabilityError {
    static tags = { [tags.SHOULD_RETRY]: true };
    get code() {
        return 0x08_00_00_01;
    }
}
exports.BackendUnavailableError = BackendUnavailableError;
class ServerOfflineError extends AvailabilityError {
    static tags = {
        [tags.SHOULD_RECONNECT]: true,
        [tags.SHOULD_RETRY]: true,
    };
    get code() {
        return 0x08_00_00_02;
    }
}
exports.ServerOfflineError = ServerOfflineError;
class UnknownTenantError extends AvailabilityError {
    static tags = {
        [tags.SHOULD_RECONNECT]: true,
        [tags.SHOULD_RETRY]: true,
    };
    get code() {
        return 0x08_00_00_03;
    }
}
exports.UnknownTenantError = UnknownTenantError;
class ServerBlockedError extends AvailabilityError {
    get code() {
        return 0x08_00_00_04;
    }
}
exports.ServerBlockedError = ServerBlockedError;
class BackendError extends base_1.GelError {
    get code() {
        return 0x09_00_00_00;
    }
}
exports.BackendError = BackendError;
class UnsupportedBackendFeatureError extends BackendError {
    get code() {
        return 0x09_00_01_00;
    }
}
exports.UnsupportedBackendFeatureError = UnsupportedBackendFeatureError;
class LogMessage extends base_1.GelError {
    get code() {
        return 0xf0_00_00_00;
    }
}
exports.LogMessage = LogMessage;
class WarningMessage extends LogMessage {
    get code() {
        return 0xf0_01_00_00;
    }
}
exports.WarningMessage = WarningMessage;
class StatusMessage extends LogMessage {
    get code() {
        return 0xf0_02_00_00;
    }
}
exports.StatusMessage = StatusMessage;
class MigrationStatusMessage extends StatusMessage {
    get code() {
        return 0xf0_02_00_01;
    }
}
exports.MigrationStatusMessage = MigrationStatusMessage;
class ClientError extends base_1.GelError {
    get code() {
        return 0xff_00_00_00;
    }
}
exports.ClientError = ClientError;
class ClientConnectionError extends ClientError {
    get code() {
        return 0xff_01_00_00;
    }
}
exports.ClientConnectionError = ClientConnectionError;
class ClientConnectionFailedError extends ClientConnectionError {
    get code() {
        return 0xff_01_01_00;
    }
}
exports.ClientConnectionFailedError = ClientConnectionFailedError;
class ClientConnectionFailedTemporarilyError extends ClientConnectionFailedError {
    static tags = {
        [tags.SHOULD_RECONNECT]: true,
        [tags.SHOULD_RETRY]: true,
    };
    get code() {
        return 0xff_01_01_01;
    }
}
exports.ClientConnectionFailedTemporarilyError = ClientConnectionFailedTemporarilyError;
class ClientConnectionTimeoutError extends ClientConnectionError {
    static tags = {
        [tags.SHOULD_RECONNECT]: true,
        [tags.SHOULD_RETRY]: true,
    };
    get code() {
        return 0xff_01_02_00;
    }
}
exports.ClientConnectionTimeoutError = ClientConnectionTimeoutError;
class ClientConnectionClosedError extends ClientConnectionError {
    static tags = {
        [tags.SHOULD_RECONNECT]: true,
        [tags.SHOULD_RETRY]: true,
    };
    get code() {
        return 0xff_01_03_00;
    }
}
exports.ClientConnectionClosedError = ClientConnectionClosedError;
class InterfaceError extends ClientError {
    get code() {
        return 0xff_02_00_00;
    }
}
exports.InterfaceError = InterfaceError;
class QueryArgumentError extends InterfaceError {
    get code() {
        return 0xff_02_01_00;
    }
}
exports.QueryArgumentError = QueryArgumentError;
class MissingArgumentError extends QueryArgumentError {
    get code() {
        return 0xff_02_01_01;
    }
}
exports.MissingArgumentError = MissingArgumentError;
class UnknownArgumentError extends QueryArgumentError {
    get code() {
        return 0xff_02_01_02;
    }
}
exports.UnknownArgumentError = UnknownArgumentError;
class InvalidArgumentError extends QueryArgumentError {
    get code() {
        return 0xff_02_01_03;
    }
}
exports.InvalidArgumentError = InvalidArgumentError;
class NoDataError extends ClientError {
    get code() {
        return 0xff_03_00_00;
    }
}
exports.NoDataError = NoDataError;
class InternalClientError extends ClientError {
    get code() {
        return 0xff_04_00_00;
    }
}
exports.InternalClientError = InternalClientError;
