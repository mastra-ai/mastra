/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Check to make sure the appropriate number of arguments are provided for a public function.
 * Throws an error if it fails.
 *
 * @param fnName The function name
 * @param minCount The minimum number of arguments to allow for the function call
 * @param maxCount The maximum number of argument to allow for the function call
 * @param argCount The actual number of arguments provided.
 */
export declare const validateArgCount: (fnName: string, minCount: number, maxCount: number, argCount: number) => void;
/**
 * Generates a string to prefix an error message about failed argument validation
 *
 * @param fnName The function name
 * @param argName The name of the argument
 * @return The prefix to add to the error thrown for validation.
 */
export declare function errorPrefix(fnName: string, argName: string): string;
/**
 * @param fnName
 * @param argumentNumber
 * @param namespace
 * @param optional
 */
export declare function validateNamespace(fnName: string, namespace: string, optional: boolean): void;
export declare function validateCallback(fnName: string, argumentName: string, callback: Function, optional: boolean): void;
export declare function validateContextObject(fnName: string, argumentName: string, context: unknown, optional: boolean): void;
