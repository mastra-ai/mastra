"use strict";
/*!
 * Copyright 2017 Google Inc. All Rights Reserved.
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
exports.customObjectMessage = customObjectMessage;
exports.validateFunction = validateFunction;
exports.validateObject = validateObject;
exports.validateString = validateString;
exports.validateHost = validateHost;
exports.validateBoolean = validateBoolean;
exports.validateNumber = validateNumber;
exports.validateInteger = validateInteger;
exports.validateTimestamp = validateTimestamp;
exports.invalidArgumentMessage = invalidArgumentMessage;
exports.validateOptional = validateOptional;
exports.validateMinNumberOfArguments = validateMinNumberOfArguments;
exports.validateMaxNumberOfArguments = validateMaxNumberOfArguments;
exports.validateEnumValue = validateEnumValue;
const url_1 = require("url");
const util_1 = require("./util");
const timestamp_1 = require("./timestamp");
/**
 * Generates an error message to use with custom objects that cannot be
 * serialized.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The value that failed serialization.
 * @param path The field path that the object is assigned to.
 */
function customObjectMessage(arg, value, path) {
    const fieldPathMessage = path ? ` (found in field "${path}")` : '';
    if ((0, util_1.isObject)(value)) {
        // We use the base class name as the type name as the sentinel classes
        // returned by the public FieldValue API are subclasses of FieldValue. By
        // using the base name, we reduce the number of special cases below.
        const typeName = value.constructor.name;
        switch (typeName) {
            case 'DocumentReference':
            case 'FieldPath':
            case 'FieldValue':
            case 'GeoPoint':
            case 'Timestamp':
                return (`${invalidArgumentMessage(arg, 'Firestore document')} Detected an object of type "${typeName}" that doesn't match the ` +
                    `expected instance${fieldPathMessage}. Please ensure that the ` +
                    'Firestore types you are using are from the same NPM package.)');
            case 'Object':
                return `${invalidArgumentMessage(arg, 'Firestore document')} Invalid use of type "${typeof value}" as a Firestore argument${fieldPathMessage}.`;
            default:
                return (`${invalidArgumentMessage(arg, 'Firestore document')} Couldn't serialize object of type "${typeName}"${fieldPathMessage}. Firestore doesn't support JavaScript ` +
                    'objects with custom prototypes (i.e. objects that were created ' +
                    'via the "new" operator).');
        }
    }
    else {
        return `${invalidArgumentMessage(arg, 'Firestore document')} Input is not a plain JavaScript object${fieldPathMessage}.`;
    }
}
/**
 * Validates that 'value' is a function.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the function can be omitted.
 */
function validateFunction(arg, value, options) {
    if (!validateOptional(value, options)) {
        if (!(0, util_1.isFunction)(value)) {
            throw new Error(invalidArgumentMessage(arg, 'function'));
        }
    }
}
/**
 * Validates that 'value' is an object.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the object can be omitted.
 */
function validateObject(arg, value, options) {
    if (!validateOptional(value, options)) {
        if (!(0, util_1.isObject)(value)) {
            throw new Error(invalidArgumentMessage(arg, 'object'));
        }
    }
}
/**
 * Validates that 'value' is a string.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the string can be omitted.
 */
function validateString(arg, value, options) {
    if (!validateOptional(value, options)) {
        if (typeof value !== 'string') {
            throw new Error(invalidArgumentMessage(arg, 'string'));
        }
    }
}
/**
 * Validates that 'value' is a host.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the host can be omitted.
 */
function validateHost(arg, value, options) {
    if (!validateOptional(value, options)) {
        validateString(arg, value);
        const urlString = `http://${value}/`;
        let parsed;
        try {
            parsed = new url_1.URL(urlString);
        }
        catch (e) {
            throw new Error(invalidArgumentMessage(arg, 'host'));
        }
        if (parsed.search !== '' ||
            parsed.pathname !== '/' ||
            parsed.username !== '') {
            throw new Error(invalidArgumentMessage(arg, 'host'));
        }
    }
}
/**
 * Validates that 'value' is a boolean.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the boolean can be omitted.
 */
function validateBoolean(arg, value, options) {
    if (!validateOptional(value, options)) {
        if (typeof value !== 'boolean') {
            throw new Error(invalidArgumentMessage(arg, 'boolean'));
        }
    }
}
/**
 * Validates that 'value' is a number.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the number can be omitted.
 */
function validateNumber(arg, value, options) {
    const min = options !== undefined && options.minValue !== undefined
        ? options.minValue
        : -Infinity;
    const max = options !== undefined && options.maxValue !== undefined
        ? options.maxValue
        : Infinity;
    if (!validateOptional(value, options)) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(invalidArgumentMessage(arg, 'number'));
        }
        else if (value < min || value > max) {
            throw new Error(`${formatArgumentName(arg)} must be within [${min}, ${max}] inclusive, but was: ${value}`);
        }
    }
}
/**
 * Validates that 'value' is a integer.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the integer can be omitted.
 */
function validateInteger(arg, value, options) {
    const min = options !== undefined && options.minValue !== undefined
        ? options.minValue
        : -Infinity;
    const max = options !== undefined && options.maxValue !== undefined
        ? options.maxValue
        : Infinity;
    if (!validateOptional(value, options)) {
        if (typeof value !== 'number' || isNaN(value) || value % 1 !== 0) {
            throw new Error(invalidArgumentMessage(arg, 'integer'));
        }
        else if (value < min || value > max) {
            throw new Error(`${formatArgumentName(arg)} must be within [${min}, ${max}] inclusive, but was: ${value}`);
        }
    }
}
/**
 * Validates that 'value' is a Timestamp.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the Timestamp can be omitted.
 */
function validateTimestamp(arg, value, options) {
    if (!validateOptional(value, options)) {
        if (!(value instanceof timestamp_1.Timestamp)) {
            throw new Error(invalidArgumentMessage(arg, 'Timestamp'));
        }
    }
}
/**
 * Generates an error message to use with invalid arguments.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param expectedType The expected input type.
 */
function invalidArgumentMessage(arg, expectedType) {
    return `${formatArgumentName(arg)} is not a valid ${expectedType}.`;
}
/**
 * Enforces the 'options.optional' constraint for 'value'.
 *
 * @private
 * @internal
 * @param value The input to validate.
 * @param options Whether the function can be omitted.
 * @return Whether the object is omitted and is allowed to be omitted.
 */
function validateOptional(value, options) {
    return (value === undefined && options !== undefined && options.optional === true);
}
/**
 * Formats the given word as plural conditionally given the preceding number.
 *
 * @private
 * @internal
 * @param num The number to use for formatting.
 * @param str The string to format.
 */
function formatPlural(num, str) {
    return `${num} ${str}` + (num === 1 ? '' : 's');
}
/**
 * Creates a descriptive name for the provided argument name or index.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @return Either the argument name or its index description.
 */
function formatArgumentName(arg) {
    return typeof arg === 'string'
        ? `Value for argument "${arg}"`
        : `Element at index ${arg}`;
}
/**
 * Verifies that 'args' has at least 'minSize' elements.
 *
 * @private
 * @internal
 * @param funcName The function name to use in the error message.
 * @param args The array (or array-like structure) to verify.
 * @param minSize The minimum number of elements to enforce.
 * @throws if the expectation is not met.
 */
function validateMinNumberOfArguments(funcName, args, minSize) {
    if (args.length < minSize) {
        throw new Error(`Function "${funcName}()" requires at least ` +
            `${formatPlural(minSize, 'argument')}.`);
    }
}
/**
 * Verifies that 'args' has at most 'maxSize' elements.
 *
 * @private
 * @internal
 * @param funcName The function name to use in the error message.
 * @param args The array (or array-like structure) to verify.
 * @param maxSize The maximum number of elements to enforce.
 * @throws if the expectation is not met.
 */
function validateMaxNumberOfArguments(funcName, args, maxSize) {
    if (args.length > maxSize) {
        throw new Error(`Function "${funcName}()" accepts at most ` +
            `${formatPlural(maxSize, 'argument')}.`);
    }
}
/**
 * Validates that the provided named option equals one of the expected values.
 *
 * @param arg The argument name or argument index (for varargs methods).).
 * @param value The input to validate.
 * @param allowedValues A list of expected values.
 * @param options Whether the input can be omitted.
 * @private
 * @internal
 */
function validateEnumValue(arg, value, allowedValues, options) {
    if (!validateOptional(value, options)) {
        const expectedDescription = [];
        for (const allowed of allowedValues) {
            if (allowed === value) {
                return;
            }
            expectedDescription.push(allowed);
        }
        throw new Error(`${formatArgumentName(arg)} is invalid. Acceptable values are: ${expectedDescription.join(', ')}`);
    }
}
//# sourceMappingURL=validate.js.map