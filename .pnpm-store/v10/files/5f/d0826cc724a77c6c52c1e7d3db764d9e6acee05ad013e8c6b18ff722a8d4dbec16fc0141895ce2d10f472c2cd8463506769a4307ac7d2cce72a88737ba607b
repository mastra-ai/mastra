/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2017 Google Inc.
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
import { App } from '../app/index';
export declare function getSdkVersion(): string;
export declare function getMetricsHeader(): string;
/**
 * Renames properties on an object given a mapping from old to new property names.
 *
 * For example, this can be used to map underscore_cased properties to camelCase.
 *
 * @param obj - The object whose properties to rename.
 * @param keyMap - The mapping from old to new property names.
 */
export declare function renameProperties(obj: {
    [key: string]: any;
}, keyMap: {
    [key: string]: string;
}): void;
/**
 * Defines a new read-only property directly on an object and returns the object.
 *
 * @param obj - The object on which to define the property.
 * @param prop - The name of the property to be defined or modified.
 * @param value - The value associated with the property.
 */
export declare function addReadonlyGetter(obj: object, prop: string, value: any): void;
/**
 * Returns the Google Cloud project ID associated with a Firebase app, if it's explicitly
 * specified in either the Firebase app options, credentials or the local environment.
 * Otherwise returns null.
 *
 * @param app - A Firebase app to get the project ID from.
 *
 * @returns A project ID string or null.
 */
export declare function getExplicitProjectId(app: App): string | null;
/**
 * Determines the Google Cloud project ID associated with a Firebase app. This method
 * first checks if a project ID is explicitly specified in either the Firebase app options,
 * credentials or the local environment in that order. If no explicit project ID is
 * configured, but the SDK has been initialized with ComputeEngineCredentials, this
 * method attempts to discover the project ID from the local metadata service.
 *
 * @param app - A Firebase app to get the project ID from.
 *
 * @returns A project ID string or null.
 */
export declare function findProjectId(app: App): Promise<string | null>;
/**
 * Returns the service account email associated with a Firebase app, if it's explicitly
 * specified in either the Firebase app options, credentials or the local environment.
 * Otherwise returns null.
 *
 * @param app - A Firebase app to get the service account email from.
 *
 * @returns A service account email string or null.
 */
export declare function getExplicitServiceAccountEmail(app: App): string | null;
/**
 * Determines the service account email associated with a Firebase app. This method first
 * checks if a service account email is explicitly specified in either the Firebase app options,
 * credentials or the local environment in that order. If no explicit service account email is
 * configured, but the SDK has been initialized with ComputeEngineCredentials, this
 * method attempts to discover the service account email from the local metadata service.
 *
 * @param app - A Firebase app to get the service account email from.
 *
 * @returns A service account email ID string or null.
 */
export declare function findServiceAccountEmail(app: App): Promise<string | null>;
/**
 * Encodes data using web-safe-base64.
 *
 * @param data - The raw data byte input.
 * @returns The base64-encoded result.
 */
export declare function toWebSafeBase64(data: Buffer): string;
/**
 * Formats a string of form 'project/{projectId}/{api}' and replaces
 * with corresponding arguments {projectId: '1234', api: 'resource'}
 * and returns output: 'project/1234/resource'.
 *
 * @param str - The original string where the param need to be
 *     replaced.
 * @param params - The optional parameters to replace in the
 *     string.
 * @returns The resulting formatted string.
 */
export declare function formatString(str: string, params?: object): string;
/**
 * Generates the update mask for the provided object.
 * Note this will ignore the last key with value undefined.
 *
 * @param obj - The object to generate the update mask for.
 * @param terminalPaths - The optional map of keys for maximum paths to traverse.
 *      Nested objects beyond that path will be ignored. This is useful for
 *      keys with variable object values.
 * @param root - The path so far.
 * @returns The computed update mask list.
 */
export declare function generateUpdateMask(obj: any, terminalPaths?: string[], root?: string): string[];
/**
 * Transforms milliseconds to a protobuf Duration type string.
 * Returns the duration in seconds with up to nine fractional
 * digits, terminated by 's'. Example: "3 seconds 0 nano seconds as 3s,
 * 3 seconds 1 nano seconds as 3.000000001s".
 *
 * @param milliseconds - The duration in milliseconds.
 * @returns The resulting formatted string in seconds with up to nine fractional
 * digits, terminated by 's'.
 */
export declare function transformMillisecondsToSecondsString(milliseconds: number): string;
/**
 * Internal type to represent a resource name
 */
export type ParsedResource = {
    projectId?: string;
    locationId?: string;
    resourceId: string;
};
/**
 * Parses the top level resources of a given resource name.
 * Supports both full and partial resources names, example:
 * `locations/{location}/functions/{functionName}`,
 * `projects/{project}/locations/{location}/functions/{functionName}`, or {functionName}
 * Does not support deeply nested resource names.
 *
 * @param resourceName - The resource name string.
 * @param resourceIdKey - The key of the resource name to be parsed.
 * @returns A parsed resource name object.
 */
export declare function parseResourceName(resourceName: string, resourceIdKey: string): ParsedResource;
