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
import { Node } from './snap/Node';
import { Path } from './util/Path';
/**
 * Helper class to store a sparse set of snapshots.
 */
export interface SparseSnapshotTree {
    value: Node | null;
    readonly children: Map<string, SparseSnapshotTree>;
}
export declare function newSparseSnapshotTree(): SparseSnapshotTree;
/**
 * Gets the node stored at the given path if one exists.
 * Only seems to be used in tests.
 *
 * @param path - Path to look up snapshot for.
 * @returns The retrieved node, or null.
 */
export declare function sparseSnapshotTreeFind(sparseSnapshotTree: SparseSnapshotTree, path: Path): Node | null;
/**
 * Stores the given node at the specified path. If there is already a node
 * at a shallower path, it merges the new data into that snapshot node.
 *
 * @param path - Path to look up snapshot for.
 * @param data - The new data, or null.
 */
export declare function sparseSnapshotTreeRemember(sparseSnapshotTree: SparseSnapshotTree, path: Path, data: Node): void;
/**
 * Purge the data at path from the cache.
 *
 * @param path - Path to look up snapshot for.
 * @returns True if this node should now be removed.
 */
export declare function sparseSnapshotTreeForget(sparseSnapshotTree: SparseSnapshotTree, path: Path): boolean;
/**
 * Recursively iterates through all of the stored tree and calls the
 * callback on each one.
 *
 * @param prefixPath - Path to look up node for.
 * @param func - The function to invoke for each tree.
 */
export declare function sparseSnapshotTreeForEachTree(sparseSnapshotTree: SparseSnapshotTree, prefixPath: Path, func: (a: Path, b: Node) => unknown): void;
/**
 * Iterates through each immediate child and triggers the callback.
 * Only seems to be used in tests.
 *
 * @param func - The function to invoke for each child.
 */
export declare function sparseSnapshotTreeForEachChild(sparseSnapshotTree: SparseSnapshotTree, func: (a: string, b: SparseSnapshotTree) => void): void;
