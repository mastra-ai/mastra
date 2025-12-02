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
import { FieldPath } from './path';
/**
 * Options to allow argument omission.
 *
 * @private
 * @internal
 */
export interface RequiredArgumentOptions {
    optional?: boolean;
}
/**
 * Options to limit the range of numbers.
 *
 * @private
 * @internal
 */
export interface NumericRangeOptions {
    minValue?: number;
    maxValue?: number;
}
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
export declare function customObjectMessage(arg: string | number, value: unknown, path?: FieldPath): string;
/**
 * Validates that 'value' is a function.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the function can be omitted.
 */
export declare function validateFunction(arg: string | number, value: unknown, options?: RequiredArgumentOptions): void;
/**
 * Validates that 'value' is an object.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the object can be omitted.
 */
export declare function validateObject(arg: string | number, value: unknown, options?: RequiredArgumentOptions): void;
/**
 * Validates that 'value' is a string.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the string can be omitted.
 */
export declare function validateString(arg: string | number, value: unknown, options?: RequiredArgumentOptions): void;
/**
 * Validates that 'value' is a host.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the host can be omitted.
 */
export declare function validateHost(arg: string | number, value: unknown, options?: RequiredArgumentOptions): void;
/**
 * Validates that 'value' is a boolean.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the boolean can be omitted.
 */
export declare function validateBoolean(arg: string | number, value: unknown, options?: RequiredArgumentOptions): void;
/**
 * Validates that 'value' is a number.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the number can be omitted.
 */
export declare function validateNumber(arg: string | number, value: unknown, options?: RequiredArgumentOptions & NumericRangeOptions): void;
/**
 * Validates that 'value' is a integer.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the integer can be omitted.
 */
export declare function validateInteger(arg: string | number, value: unknown, options?: RequiredArgumentOptions & NumericRangeOptions): void;
/**
 * Validates that 'value' is a Timestamp.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value The input to validate.
 * @param options Options that specify whether the Timestamp can be omitted.
 */
export declare function validateTimestamp(arg: string | number, value: unknown, options?: RequiredArgumentOptions): void;
/**
 * Generates an error message to use with invalid arguments.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param expectedType The expected input type.
 */
export declare function invalidArgumentMessage(arg: string | number, expectedType: string): string;
/**
 * Enforces the 'options.optional' constraint for 'value'.
 *
 * @private
 * @internal
 * @param value The input to validate.
 * @param options Whether the function can be omitted.
 * @return Whether the object is omitted and is allowed to be omitted.
 */
export declare function validateOptional(value: unknown, options?: RequiredArgumentOptions): boolean;
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
export declare function validateMinNumberOfArguments(funcName: string, args: IArguments | unknown[], minSize: number): void;
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
export declare function validateMaxNumberOfArguments(funcName: string, args: IArguments, maxSize: number): void;
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
export declare function validateEnumValue(arg: string | number, value: unknown, allowedValues: string[], options?: RequiredArgumentOptions): void;
