/**
 * Copyright 2020 Google LLC
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
/**
 * Converts a given string from camelCase (used by protobuf.js and in JSON)
 * to snake_case (normally used in proto definitions).
 */
export declare function camelToSnakeCase(str: string): string;
/**
 * Converts a given string from snake_case (normally used in proto definitions) or
 * PascalCase (also used in proto definitions) to camelCase (used by protobuf.js).
 * Preserves capitalization of the first character.
 */
export declare function toCamelCase(str: string): string;
/**
 * Converts a given string to lower camel case (forcing the first character to be
 * in lower case).
 */
export declare function toLowerCamelCase(str: string): string;
/**
 * Converts a given string to lower camel case (forcing the first character to be
 * in lower case).
 */
export declare function makeUUID(): `${string}-${string}-${string}-${string}-${string}`;
export declare const getProtoNameFromFullName: (fullTypeName: string) => string;
export declare const decodeProtobufAny: (anyValue: any, protobuf: protobuf.Type) => protobuf.Message<{}>;
export declare const decodeAnyProtosInArray: (protoList: Array<{}>, protobuf: protobuf.Type) => Array<{}>;
