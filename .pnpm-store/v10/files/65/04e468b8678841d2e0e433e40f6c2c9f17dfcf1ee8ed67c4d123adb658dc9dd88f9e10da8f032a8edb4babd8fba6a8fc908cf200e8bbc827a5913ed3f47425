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
import { RepoInfo } from '../RepoInfo';
import { Path, ValidationPath } from './Path';
/**
 * True for invalid Firebase keys
 */
export declare const INVALID_KEY_REGEX_: RegExp;
/**
 * True for invalid Firebase paths.
 * Allows '/' in paths.
 */
export declare const INVALID_PATH_REGEX_: RegExp;
/**
 * Maximum number of characters to allow in leaf value
 */
export declare const MAX_LEAF_SIZE_: number;
export declare const isValidKey: (key: unknown) => boolean;
export declare const isValidPathString: (pathString: string) => boolean;
export declare const isValidRootPathString: (pathString: string) => boolean;
export declare const isValidPriority: (priority: unknown) => boolean;
/**
 * Pre-validate a datum passed as an argument to Firebase function.
 */
export declare const validateFirebaseDataArg: (fnName: string, value: unknown, path: Path, optional: boolean) => void;
/**
 * Validate a data object client-side before sending to server.
 */
export declare const validateFirebaseData: (errorPrefix: string, data: unknown, path_: Path | ValidationPath) => void;
/**
 * Pre-validate paths passed in the firebase function.
 */
export declare const validateFirebaseMergePaths: (errorPrefix: string, mergePaths: Path[]) => void;
/**
 * pre-validate an object passed as an argument to firebase function (
 * must be an object - e.g. for firebase.update()).
 */
export declare const validateFirebaseMergeDataArg: (fnName: string, data: unknown, path: Path, optional: boolean) => void;
export declare const validatePriority: (fnName: string, priority: unknown, optional: boolean) => void;
export declare const validateKey: (fnName: string, argumentName: string, key: string, optional: boolean) => void;
/**
 * @internal
 */
export declare const validatePathString: (fnName: string, argumentName: string, pathString: string, optional: boolean) => void;
export declare const validateRootPathString: (fnName: string, argumentName: string, pathString: string, optional: boolean) => void;
/**
 * @internal
 */
export declare const validateWritablePath: (fnName: string, path: Path) => void;
export declare const validateUrl: (fnName: string, parsedUrl: {
    repoInfo: RepoInfo;
    path: Path;
}) => void;
export declare const validateString: (fnName: string, argumentName: string, string: unknown, optional: boolean) => void;
export declare const validateObject: (fnName: string, argumentName: string, obj: unknown, optional: boolean) => void;
export declare const validateObjectContainsKey: (fnName: string, argumentName: string, obj: unknown, key: string, optional: boolean, optType?: string) => void;
