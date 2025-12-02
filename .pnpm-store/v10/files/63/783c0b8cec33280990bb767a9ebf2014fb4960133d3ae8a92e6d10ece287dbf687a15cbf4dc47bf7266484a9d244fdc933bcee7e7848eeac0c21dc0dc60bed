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
import { Node } from '../snap/Node';
import { SyncTree } from '../SyncTree';
import { Indexable } from './misc';
import { Path } from './Path';
interface ValueProvider {
    getImmediateChild(childName: string): ValueProvider;
    node(): Node;
}
/**
 * Generate placeholders for deferred values.
 */
export declare const generateWithValues: (values: {
    [k: string]: unknown;
} | null) => {
    [k: string]: unknown;
};
/**
 * Value to use when firing local events. When writing server values, fire
 * local events with an approximate value, otherwise return value as-is.
 */
export declare const resolveDeferredLeafValue: (value: {
    [k: string]: unknown;
} | string | number | boolean, existingVal: ValueProvider, serverValues: {
    [k: string]: unknown;
}) => string | number | boolean;
/**
 * Recursively replace all deferred values and priorities in the tree with the
 * specified generated replacement values.
 * @param path - path to which write is relative
 * @param node - new data written at path
 * @param syncTree - current data
 */
export declare const resolveDeferredValueTree: (path: Path, node: Node, syncTree: SyncTree, serverValues: Indexable) => Node;
/**
 * Recursively replace all deferred values and priorities in the node with the
 * specified generated replacement values.  If there are no server values in the node,
 * it'll be returned as-is.
 */
export declare const resolveDeferredValueSnapshot: (node: Node, existing: Node, serverValues: Indexable) => Node;
export {};
