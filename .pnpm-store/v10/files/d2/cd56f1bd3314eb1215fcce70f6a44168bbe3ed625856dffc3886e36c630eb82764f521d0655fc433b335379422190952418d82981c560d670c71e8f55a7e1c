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
 * @fileoverview Implementation of an immutable SortedMap using a Left-leaning
 * Red-Black Tree, adapted from the implementation in Mugs
 * (http://mads379.github.com/mugs/) by Mads Hartmann Jensen
 * (mads379\@gmail.com).
 *
 * Original paper on Left-leaning Red-Black Trees:
 *   http://www.cs.princeton.edu/~rs/talks/LLRB/LLRB.pdf
 *
 * Invariant 1: No red node has a red child
 * Invariant 2: Every leaf path has the same number of black nodes
 * Invariant 3: Only the left child can be red (left leaning)
 */
export type Comparator<K> = (key1: K, key2: K) => number;
/**
 * An iterator over an LLRBNode.
 */
export declare class SortedMapIterator<K, V, T> {
    private isReverse_;
    private resultGenerator_;
    private nodeStack_;
    /**
     * @param node - Node to iterate.
     * @param isReverse_ - Whether or not to iterate in reverse
     */
    constructor(node: LLRBNode<K, V> | LLRBEmptyNode<K, V>, startKey: K | null, comparator: Comparator<K>, isReverse_: boolean, resultGenerator_?: ((k: K, v: V) => T) | null);
    getNext(): T;
    hasNext(): boolean;
    peek(): T;
}
/**
 * Represents a node in a Left-leaning Red-Black tree.
 */
export declare class LLRBNode<K, V> {
    key: K;
    value: V;
    color: boolean;
    left: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    right: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    /**
     * @param key - Key associated with this node.
     * @param value - Value associated with this node.
     * @param color - Whether this node is red.
     * @param left - Left child.
     * @param right - Right child.
     */
    constructor(key: K, value: V, color: boolean | null, left?: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null, right?: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null);
    static RED: boolean;
    static BLACK: boolean;
    /**
     * Returns a copy of the current node, optionally replacing pieces of it.
     *
     * @param key - New key for the node, or null.
     * @param value - New value for the node, or null.
     * @param color - New color for the node, or null.
     * @param left - New left child for the node, or null.
     * @param right - New right child for the node, or null.
     * @returns The node copy.
     */
    copy(key: K | null, value: V | null, color: boolean | null, left: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null, right: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null): LLRBNode<K, V>;
    /**
     * @returns The total number of nodes in the tree.
     */
    count(): number;
    /**
     * @returns True if the tree is empty.
     */
    isEmpty(): boolean;
    /**
     * Traverses the tree in key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     *   node.  If it returns true, traversal is aborted.
     * @returns The first truthy value returned by action, or the last falsey
     *   value returned by action
     */
    inorderTraversal(action: (k: K, v: V) => unknown): boolean;
    /**
     * Traverses the tree in reverse key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     * node.  If it returns true, traversal is aborted.
     * @returns True if traversal was aborted.
     */
    reverseTraversal(action: (k: K, v: V) => void): boolean;
    /**
     * @returns The minimum node in the tree.
     */
    private min_;
    /**
     * @returns The maximum key in the tree.
     */
    minKey(): K;
    /**
     * @returns The maximum key in the tree.
     */
    maxKey(): K;
    /**
     * @param key - Key to insert.
     * @param value - Value to insert.
     * @param comparator - Comparator.
     * @returns New tree, with the key/value added.
     */
    insert(key: K, value: V, comparator: Comparator<K>): LLRBNode<K, V>;
    /**
     * @returns New tree, with the minimum key removed.
     */
    private removeMin_;
    /**
     * @param key - The key of the item to remove.
     * @param comparator - Comparator.
     * @returns New tree, with the specified item removed.
     */
    remove(key: K, comparator: Comparator<K>): LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    /**
     * @returns Whether this is a RED node.
     */
    isRed_(): boolean;
    /**
     * @returns New tree after performing any needed rotations.
     */
    private fixUp_;
    /**
     * @returns New tree, after moveRedLeft.
     */
    private moveRedLeft_;
    /**
     * @returns New tree, after moveRedRight.
     */
    private moveRedRight_;
    /**
     * @returns New tree, after rotateLeft.
     */
    private rotateLeft_;
    /**
     * @returns New tree, after rotateRight.
     */
    private rotateRight_;
    /**
     * @returns Newt ree, after colorFlip.
     */
    private colorFlip_;
    /**
     * For testing.
     *
     * @returns True if all is well.
     */
    private checkMaxDepth_;
    check_(): number;
}
/**
 * Represents an empty node (a leaf node in the Red-Black Tree).
 */
export declare class LLRBEmptyNode<K, V> {
    key: K;
    value: V;
    left: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    right: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    color: boolean;
    /**
     * Returns a copy of the current node.
     *
     * @returns The node copy.
     */
    copy(key: K | null, value: V | null, color: boolean | null, left: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null, right: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null): LLRBEmptyNode<K, V>;
    /**
     * Returns a copy of the tree, with the specified key/value added.
     *
     * @param key - Key to be added.
     * @param value - Value to be added.
     * @param comparator - Comparator.
     * @returns New tree, with item added.
     */
    insert(key: K, value: V, comparator: Comparator<K>): LLRBNode<K, V>;
    /**
     * Returns a copy of the tree, with the specified key removed.
     *
     * @param key - The key to remove.
     * @param comparator - Comparator.
     * @returns New tree, with item removed.
     */
    remove(key: K, comparator: Comparator<K>): LLRBEmptyNode<K, V>;
    /**
     * @returns The total number of nodes in the tree.
     */
    count(): number;
    /**
     * @returns True if the tree is empty.
     */
    isEmpty(): boolean;
    /**
     * Traverses the tree in key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     * node.  If it returns true, traversal is aborted.
     * @returns True if traversal was aborted.
     */
    inorderTraversal(action: (k: K, v: V) => unknown): boolean;
    /**
     * Traverses the tree in reverse key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     * node.  If it returns true, traversal is aborted.
     * @returns True if traversal was aborted.
     */
    reverseTraversal(action: (k: K, v: V) => void): boolean;
    minKey(): null;
    maxKey(): null;
    check_(): number;
    /**
     * @returns Whether this node is red.
     */
    isRed_(): boolean;
}
/**
 * An immutable sorted map implementation, based on a Left-leaning Red-Black
 * tree.
 */
export declare class SortedMap<K, V> {
    private comparator_;
    private root_;
    /**
     * Always use the same empty node, to reduce memory.
     */
    static EMPTY_NODE: LLRBEmptyNode<unknown, unknown>;
    /**
     * @param comparator_ - Key comparator.
     * @param root_ - Optional root node for the map.
     */
    constructor(comparator_: Comparator<K>, root_?: LLRBNode<K, V> | LLRBEmptyNode<K, V>);
    /**
     * Returns a copy of the map, with the specified key/value added or replaced.
     * (TODO: We should perhaps rename this method to 'put')
     *
     * @param key - Key to be added.
     * @param value - Value to be added.
     * @returns New map, with item added.
     */
    insert(key: K, value: V): SortedMap<K, V>;
    /**
     * Returns a copy of the map, with the specified key removed.
     *
     * @param key - The key to remove.
     * @returns New map, with item removed.
     */
    remove(key: K): SortedMap<K, V>;
    /**
     * Returns the value of the node with the given key, or null.
     *
     * @param key - The key to look up.
     * @returns The value of the node with the given key, or null if the
     * key doesn't exist.
     */
    get(key: K): V | null;
    /**
     * Returns the key of the item *before* the specified key, or null if key is the first item.
     * @param key - The key to find the predecessor of
     * @returns The predecessor key.
     */
    getPredecessorKey(key: K): K | null;
    /**
     * @returns True if the map is empty.
     */
    isEmpty(): boolean;
    /**
     * @returns The total number of nodes in the map.
     */
    count(): number;
    /**
     * @returns The minimum key in the map.
     */
    minKey(): K | null;
    /**
     * @returns The maximum key in the map.
     */
    maxKey(): K | null;
    /**
     * Traverses the map in key order and calls the specified action function
     * for each key/value pair.
     *
     * @param action - Callback function to be called
     * for each key/value pair.  If action returns true, traversal is aborted.
     * @returns The first truthy value returned by action, or the last falsey
     *   value returned by action
     */
    inorderTraversal(action: (k: K, v: V) => unknown): boolean;
    /**
     * Traverses the map in reverse key order and calls the specified action function
     * for each key/value pair.
     *
     * @param action - Callback function to be called
     * for each key/value pair.  If action returns true, traversal is aborted.
     * @returns True if the traversal was aborted.
     */
    reverseTraversal(action: (k: K, v: V) => void): boolean;
    /**
     * Returns an iterator over the SortedMap.
     * @returns The iterator.
     */
    getIterator<T>(resultGenerator?: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
    getIteratorFrom<T>(key: K, resultGenerator?: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
    getReverseIteratorFrom<T>(key: K, resultGenerator?: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
    getReverseIterator<T>(resultGenerator?: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
}
