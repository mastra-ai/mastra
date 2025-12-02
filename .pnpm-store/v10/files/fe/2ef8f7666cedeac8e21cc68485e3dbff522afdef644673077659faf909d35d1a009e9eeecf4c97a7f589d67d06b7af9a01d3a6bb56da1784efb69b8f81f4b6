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
export declare function contains<T extends object>(obj: T, key: string): boolean;
export declare function safeGet<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined;
export declare function isEmpty(obj: object): obj is {};
export declare function map<K extends string, V, U>(obj: {
    [key in K]: V;
}, fn: (value: V, key: K, obj: {
    [key in K]: V;
}) => U, contextObj?: unknown): {
    [key in K]: U;
};
/**
 * Deep equal two objects. Support Arrays and Objects.
 */
export declare function deepEqual(a: object, b: object): boolean;
