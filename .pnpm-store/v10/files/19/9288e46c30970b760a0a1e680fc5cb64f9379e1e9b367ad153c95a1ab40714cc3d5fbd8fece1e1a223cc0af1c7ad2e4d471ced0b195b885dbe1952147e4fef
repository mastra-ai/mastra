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
import { Path } from '../util/Path';
import { SortedMap, SortedMapIterator } from '../util/SortedMap';
import { Index } from './indexes/Index';
import { IndexMap } from './IndexMap';
import { NamedNode, Node } from './Node';
export interface ChildrenNodeConstructor {
    new (children_: SortedMap<string, Node>, priorityNode_: Node | null, indexMap_: IndexMap): ChildrenNode;
    EMPTY_NODE: ChildrenNode;
}
/**
 * ChildrenNode is a class for storing internal nodes in a DataSnapshot
 * (i.e. nodes with children).  It implements Node and stores the
 * list of children in the children property, sorted by child name.
 */
export declare class ChildrenNode implements Node {
    private readonly children_;
    private readonly priorityNode_;
    private indexMap_;
    private lazyHash_;
    static get EMPTY_NODE(): ChildrenNode;
    /**
     * @param children_ - List of children of this node..
     * @param priorityNode_ - The priority of this node (as a snapshot node).
     */
    constructor(children_: SortedMap<string, Node>, priorityNode_: Node | null, indexMap_: IndexMap);
    /** @inheritDoc */
    isLeafNode(): boolean;
    /** @inheritDoc */
    getPriority(): Node;
    /** @inheritDoc */
    updatePriority(newPriorityNode: Node): Node;
    /** @inheritDoc */
    getImmediateChild(childName: string): Node;
    /** @inheritDoc */
    getChild(path: Path): Node;
    /** @inheritDoc */
    hasChild(childName: string): boolean;
    /** @inheritDoc */
    updateImmediateChild(childName: string, newChildNode: Node): Node;
    /** @inheritDoc */
    updateChild(path: Path, newChildNode: Node): Node;
    /** @inheritDoc */
    isEmpty(): boolean;
    /** @inheritDoc */
    numChildren(): number;
    private static INTEGER_REGEXP_;
    /** @inheritDoc */
    val(exportFormat?: boolean): object;
    /** @inheritDoc */
    hash(): string;
    /** @inheritDoc */
    getPredecessorChildName(childName: string, childNode: Node, index: Index): string;
    getFirstChildName(indexDefinition: Index): string | null;
    getFirstChild(indexDefinition: Index): NamedNode | null;
    /**
     * Given an index, return the key name of the largest value we have, according to that index
     */
    getLastChildName(indexDefinition: Index): string | null;
    getLastChild(indexDefinition: Index): NamedNode | null;
    forEachChild(index: Index, action: (key: string, node: Node) => boolean | void): boolean;
    getIterator(indexDefinition: Index): SortedMapIterator<string | NamedNode, Node, NamedNode>;
    getIteratorFrom(startPost: NamedNode, indexDefinition: Index): SortedMapIterator<string | NamedNode, Node, NamedNode>;
    getReverseIterator(indexDefinition: Index): SortedMapIterator<string | NamedNode, Node, NamedNode>;
    getReverseIteratorFrom(endPost: NamedNode, indexDefinition: Index): SortedMapIterator<string | NamedNode, Node, NamedNode>;
    compareTo(other: ChildrenNode): number;
    withIndex(indexDefinition: Index): Node;
    isIndexed(index: Index): boolean;
    equals(other: Node): boolean;
    /**
     * Returns a SortedMap ordered by index, or null if the default (by-key) ordering can be used
     * instead.
     *
     */
    private resolveIndex_;
}
export declare class MaxNode extends ChildrenNode {
    constructor();
    compareTo(other: Node): number;
    equals(other: Node): boolean;
    getPriority(): MaxNode;
    getImmediateChild(childName: string): ChildrenNode;
    isEmpty(): boolean;
}
/**
 * Marker that will sort higher than any other snapshot.
 */
export declare const MAX_NODE: MaxNode;
/**
 * Document NamedNode extensions
 */
declare module './Node' {
    interface NamedNode {
        MIN: NamedNode;
        MAX: NamedNode;
    }
}
