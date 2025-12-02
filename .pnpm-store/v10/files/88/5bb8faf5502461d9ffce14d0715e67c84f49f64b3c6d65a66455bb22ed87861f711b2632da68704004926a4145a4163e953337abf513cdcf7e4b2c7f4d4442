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
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMapping = void 0;
const errors = __importStar(require("./index"));
exports.errorMapping = new Map();
exports.errorMapping.set(0x01_00_00_00, errors.InternalServerError);
exports.errorMapping.set(0x02_00_00_00, errors.UnsupportedFeatureError);
exports.errorMapping.set(0x03_00_00_00, errors.ProtocolError);
exports.errorMapping.set(0x03_01_00_00, errors.BinaryProtocolError);
exports.errorMapping.set(0x03_01_00_01, errors.UnsupportedProtocolVersionError);
exports.errorMapping.set(0x03_01_00_02, errors.TypeSpecNotFoundError);
exports.errorMapping.set(0x03_01_00_03, errors.UnexpectedMessageError);
exports.errorMapping.set(0x03_02_00_00, errors.InputDataError);
exports.errorMapping.set(0x03_02_01_00, errors.ParameterTypeMismatchError);
exports.errorMapping.set(0x03_02_02_00, errors.StateMismatchError);
exports.errorMapping.set(0x03_03_00_00, errors.ResultCardinalityMismatchError);
exports.errorMapping.set(0x03_04_00_00, errors.CapabilityError);
exports.errorMapping.set(0x03_04_01_00, errors.UnsupportedCapabilityError);
exports.errorMapping.set(0x03_04_02_00, errors.DisabledCapabilityError);
exports.errorMapping.set(0x03_04_03_00, errors.UnsafeIsolationLevelError);
exports.errorMapping.set(0x04_00_00_00, errors.QueryError);
exports.errorMapping.set(0x04_01_00_00, errors.InvalidSyntaxError);
exports.errorMapping.set(0x04_01_01_00, errors.EdgeQLSyntaxError);
exports.errorMapping.set(0x04_01_02_00, errors.SchemaSyntaxError);
exports.errorMapping.set(0x04_01_03_00, errors.GraphQLSyntaxError);
exports.errorMapping.set(0x04_02_00_00, errors.InvalidTypeError);
exports.errorMapping.set(0x04_02_01_00, errors.InvalidTargetError);
exports.errorMapping.set(0x04_02_01_01, errors.InvalidLinkTargetError);
exports.errorMapping.set(0x04_02_01_02, errors.InvalidPropertyTargetError);
exports.errorMapping.set(0x04_03_00_00, errors.InvalidReferenceError);
exports.errorMapping.set(0x04_03_00_01, errors.UnknownModuleError);
exports.errorMapping.set(0x04_03_00_02, errors.UnknownLinkError);
exports.errorMapping.set(0x04_03_00_03, errors.UnknownPropertyError);
exports.errorMapping.set(0x04_03_00_04, errors.UnknownUserError);
exports.errorMapping.set(0x04_03_00_05, errors.UnknownDatabaseError);
exports.errorMapping.set(0x04_03_00_06, errors.UnknownParameterError);
exports.errorMapping.set(0x04_03_00_07, errors.DeprecatedScopingError);
exports.errorMapping.set(0x04_04_00_00, errors.SchemaError);
exports.errorMapping.set(0x04_05_00_00, errors.SchemaDefinitionError);
exports.errorMapping.set(0x04_05_01_00, errors.InvalidDefinitionError);
exports.errorMapping.set(0x04_05_01_01, errors.InvalidModuleDefinitionError);
exports.errorMapping.set(0x04_05_01_02, errors.InvalidLinkDefinitionError);
exports.errorMapping.set(0x04_05_01_03, errors.InvalidPropertyDefinitionError);
exports.errorMapping.set(0x04_05_01_04, errors.InvalidUserDefinitionError);
exports.errorMapping.set(0x04_05_01_05, errors.InvalidDatabaseDefinitionError);
exports.errorMapping.set(0x04_05_01_06, errors.InvalidOperatorDefinitionError);
exports.errorMapping.set(0x04_05_01_07, errors.InvalidAliasDefinitionError);
exports.errorMapping.set(0x04_05_01_08, errors.InvalidFunctionDefinitionError);
exports.errorMapping.set(0x04_05_01_09, errors.InvalidConstraintDefinitionError);
exports.errorMapping.set(0x04_05_01_0a, errors.InvalidCastDefinitionError);
exports.errorMapping.set(0x04_05_02_00, errors.DuplicateDefinitionError);
exports.errorMapping.set(0x04_05_02_01, errors.DuplicateModuleDefinitionError);
exports.errorMapping.set(0x04_05_02_02, errors.DuplicateLinkDefinitionError);
exports.errorMapping.set(0x04_05_02_03, errors.DuplicatePropertyDefinitionError);
exports.errorMapping.set(0x04_05_02_04, errors.DuplicateUserDefinitionError);
exports.errorMapping.set(0x04_05_02_05, errors.DuplicateDatabaseDefinitionError);
exports.errorMapping.set(0x04_05_02_06, errors.DuplicateOperatorDefinitionError);
exports.errorMapping.set(0x04_05_02_07, errors.DuplicateViewDefinitionError);
exports.errorMapping.set(0x04_05_02_08, errors.DuplicateFunctionDefinitionError);
exports.errorMapping.set(0x04_05_02_09, errors.DuplicateConstraintDefinitionError);
exports.errorMapping.set(0x04_05_02_0a, errors.DuplicateCastDefinitionError);
exports.errorMapping.set(0x04_05_02_0b, errors.DuplicateMigrationError);
exports.errorMapping.set(0x04_06_00_00, errors.SessionTimeoutError);
exports.errorMapping.set(0x04_06_01_00, errors.IdleSessionTimeoutError);
exports.errorMapping.set(0x04_06_02_00, errors.QueryTimeoutError);
exports.errorMapping.set(0x04_06_0a_00, errors.TransactionTimeoutError);
exports.errorMapping.set(0x04_06_0a_01, errors.IdleTransactionTimeoutError);
exports.errorMapping.set(0x05_00_00_00, errors.ExecutionError);
exports.errorMapping.set(0x05_01_00_00, errors.InvalidValueError);
exports.errorMapping.set(0x05_01_00_01, errors.DivisionByZeroError);
exports.errorMapping.set(0x05_01_00_02, errors.NumericOutOfRangeError);
exports.errorMapping.set(0x05_01_00_03, errors.AccessPolicyError);
exports.errorMapping.set(0x05_01_00_04, errors.QueryAssertionError);
exports.errorMapping.set(0x05_02_00_00, errors.IntegrityError);
exports.errorMapping.set(0x05_02_00_01, errors.ConstraintViolationError);
exports.errorMapping.set(0x05_02_00_02, errors.CardinalityViolationError);
exports.errorMapping.set(0x05_02_00_03, errors.MissingRequiredError);
exports.errorMapping.set(0x05_03_00_00, errors.TransactionError);
exports.errorMapping.set(0x05_03_01_00, errors.TransactionConflictError);
exports.errorMapping.set(0x05_03_01_01, errors.TransactionSerializationError);
exports.errorMapping.set(0x05_03_01_02, errors.TransactionDeadlockError);
exports.errorMapping.set(0x05_04_00_00, errors.WatchError);
exports.errorMapping.set(0x06_00_00_00, errors.ConfigurationError);
exports.errorMapping.set(0x07_00_00_00, errors.AccessError);
exports.errorMapping.set(0x07_01_00_00, errors.AuthenticationError);
exports.errorMapping.set(0x08_00_00_00, errors.AvailabilityError);
exports.errorMapping.set(0x08_00_00_01, errors.BackendUnavailableError);
exports.errorMapping.set(0x08_00_00_02, errors.ServerOfflineError);
exports.errorMapping.set(0x08_00_00_03, errors.UnknownTenantError);
exports.errorMapping.set(0x08_00_00_04, errors.ServerBlockedError);
exports.errorMapping.set(0x09_00_00_00, errors.BackendError);
exports.errorMapping.set(0x09_00_01_00, errors.UnsupportedBackendFeatureError);
exports.errorMapping.set(0xf0_00_00_00, errors.LogMessage);
exports.errorMapping.set(0xf0_01_00_00, errors.WarningMessage);
exports.errorMapping.set(0xf0_02_00_00, errors.StatusMessage);
exports.errorMapping.set(0xf0_02_00_01, errors.MigrationStatusMessage);
exports.errorMapping.set(0xff_00_00_00, errors.ClientError);
exports.errorMapping.set(0xff_01_00_00, errors.ClientConnectionError);
exports.errorMapping.set(0xff_01_01_00, errors.ClientConnectionFailedError);
exports.errorMapping.set(0xff_01_01_01, errors.ClientConnectionFailedTemporarilyError);
exports.errorMapping.set(0xff_01_02_00, errors.ClientConnectionTimeoutError);
exports.errorMapping.set(0xff_01_03_00, errors.ClientConnectionClosedError);
exports.errorMapping.set(0xff_02_00_00, errors.InterfaceError);
exports.errorMapping.set(0xff_02_01_00, errors.QueryArgumentError);
exports.errorMapping.set(0xff_02_01_01, errors.MissingArgumentError);
exports.errorMapping.set(0xff_02_01_02, errors.UnknownArgumentError);
exports.errorMapping.set(0xff_02_01_03, errors.InvalidArgumentError);
exports.errorMapping.set(0xff_03_00_00, errors.NoDataError);
exports.errorMapping.set(0xff_04_00_00, errors.InternalClientError);
