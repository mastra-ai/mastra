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
import { NamedNode, Node } from './snap/Node';
import { ImmutableTree } from './util/ImmutableTree';
import { Path } from './util/Path';
/**
 * This class holds a collection of writes that can be applied to nodes in unison. It abstracts away the logic with
 * dealing with priority writes and multiple nested writes. At any given path there is only allowed to be one write
 * modifying that path. Any write to an existing path or shadowing an existing path will modify that existing write
 * to reflect the write added.
 */
export declare class CompoundWrite {
    writeTree_: ImmutableTree<Node>;
    constructor(writeTree_: ImmutableTree<Node>);
    static empty(): CompoundWrite;
}
export declare function compoundWriteAddWrite(compoundWrite: CompoundWrite, path: Path, node: Node): CompoundWrite;
export declare function compoundWriteAddWrites(compoundWrite: CompoundWrite, path: Path, updates: {
    [name: string]: Node;
}): CompoundWrite;
/**
 * Will remove a write at the given path and deeper paths. This will <em>not</em> modify a write at a higher
 * location, which must be removed by calling this method with that path.
 *
 * @param compoundWrite - The CompoundWrite to remove.
 * @param path - The path at which a write and all deeper writes should be removed
 * @returns The new CompoundWrite with the removed path
 */
export declare function compoundWriteRemoveWrite(compoundWrite: CompoundWrite, path: Path): CompoundWrite;
/**
 * Returns whether this CompoundWrite will fully overwrite a node at a given location and can therefore be
 * considered "complete".
 *
 * @param compoundWrite - The CompoundWrite to check.
 * @param path - The path to check for
 * @returns Whether there is a complete write at that path
 */
export declare function compoundWriteHasCompleteWrite(compoundWrite: CompoundWrite, path: Path): boolean;
/**
 * Returns a node for a path if and only if the node is a "complete" overwrite at that path. This will not aggregate
 * writes from deeper paths, but will return child nodes from a more shallow path.
 *
 * @param compoundWrite - The CompoundWrite to get the node from.
 * @param path - The path to get a complete write
 * @returns The node if complete at that path, or null otherwise.
 */
export declare function compoundWriteGetCompleteNode(compoundWrite: CompoundWrite, path: Path): Node | null;
/**
 * Returns all children that are guaranteed to be a complete overwrite.
 *
 * @param compoundWrite - The CompoundWrite to get children from.
 * @returns A list of all complete children.
 */
export declare function compoundWriteGetCompleteChildren(compoundWrite: CompoundWrite): NamedNode[];
export declare function compoundWriteChildCompoundWrite(compoundWrite: CompoundWrite, path: Path): CompoundWrite;
/**
 * Returns true if this CompoundWrite is empty and therefore does not modify any nodes.
 * @returns Whether this CompoundWrite is empty
 */
export declare function compoundWriteIsEmpty(compoundWrite: CompoundWrite): boolean;
/**
 * Applies this CompoundWrite to a node. The node is returned with all writes from this CompoundWrite applied to the
 * node
 * @param node - The node to apply this CompoundWrite to
 * @returns The node with all writes applied
 */
export declare function compoundWriteApply(compoundWrite: CompoundWrite, node: Node): Node;
