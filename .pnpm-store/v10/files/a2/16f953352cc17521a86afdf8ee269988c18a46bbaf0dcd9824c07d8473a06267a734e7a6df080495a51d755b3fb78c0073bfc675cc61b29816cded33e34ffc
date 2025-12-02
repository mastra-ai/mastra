"use strict";
/**
 * Copyright 2024 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQueryOrder = validateQueryOrder;
exports.validateQueryOperator = validateQueryOperator;
exports.validateDocumentReference = validateDocumentReference;
exports.validateQueryValue = validateQueryValue;
exports.coalesce = coalesce;
const validate_1 = require("../validate");
const serializer_1 = require("../serializer");
const document_reference_1 = require("./document-reference");
const constants_1 = require("./constants");
/**
 * Validates the input string as a field order direction.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param op Order direction to validate.
 * @throws when the direction is invalid
 * @return a validated input value, which may be different from the provided
 * value.
 */
function validateQueryOrder(arg, op) {
    // For backwards compatibility, we support both lower and uppercase values.
    op = typeof op === 'string' ? op.toLowerCase() : op;
    (0, validate_1.validateEnumValue)(arg, op, Object.keys(constants_1.directionOperators), { optional: true });
    return op;
}
/**
 * Validates the input string as a field comparison operator.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param op Field comparison operator to validate.
 * @param fieldValue Value that is used in the filter.
 * @throws when the comparison operation is invalid
 * @return a validated input value, which may be different from the provided
 * value.
 */
function validateQueryOperator(arg, op, fieldValue) {
    // For backwards compatibility, we support both `=` and `==` for "equals".
    if (op === '=') {
        op = '==';
    }
    (0, validate_1.validateEnumValue)(arg, op, Object.keys(constants_1.comparisonOperators));
    if (typeof fieldValue === 'number' &&
        isNaN(fieldValue) &&
        op !== '==' &&
        op !== '!=') {
        throw new Error("Invalid query. You can only perform '==' and '!=' comparisons on NaN.");
    }
    if (fieldValue === null && op !== '==' && op !== '!=') {
        throw new Error("Invalid query. You can only perform '==' and '!=' comparisons on Null.");
    }
    return op;
}
/**
 * Validates that 'value' is a DocumentReference.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The argument to validate.
 * @return the DocumentReference if valid
 */
function validateDocumentReference(arg, value) {
    if (!(value instanceof document_reference_1.DocumentReference)) {
        throw new Error((0, validate_1.invalidArgumentMessage)(arg, 'DocumentReference'));
    }
    return value;
}
/**
 * Validates that 'value' can be used as a query value.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The argument to validate.
 * @param allowUndefined Whether to allow nested properties that are `undefined`.
 */
function validateQueryValue(arg, value, allowUndefined) {
    (0, serializer_1.validateUserInput)(arg, value, 'query constraint', {
        allowDeletes: 'none',
        allowTransforms: false,
        allowUndefined,
    });
}
/**
 * Returns the first non-undefined value or `undefined` if no such value exists.
 * @private
 * @internal
 */
function coalesce(...values) {
    return values.find(value => value !== undefined);
}
//# sourceMappingURL=helpers.js.map