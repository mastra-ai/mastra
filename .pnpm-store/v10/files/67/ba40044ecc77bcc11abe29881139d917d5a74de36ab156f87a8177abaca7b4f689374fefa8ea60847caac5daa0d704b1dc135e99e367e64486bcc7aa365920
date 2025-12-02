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
import { Path } from './Path';
/**
 * Node in a Tree.
 */
export interface TreeNode<T> {
    children: Record<string, TreeNode<T>>;
    childCount: number;
    value?: T;
}
/**
 * A light-weight tree, traversable by path.  Nodes can have both values and children.
 * Nodes are not enumerated (by forEachChild) unless they have a value or non-empty
 * children.
 */
export declare class Tree<T> {
    readonly name: string;
    readonly parent: Tree<T> | null;
    node: TreeNode<T>;
    /**
     * @param name - Optional name of the node.
     * @param parent - Optional parent node.
     * @param node - Optional node to wrap.
     */
    constructor(name?: string, parent?: Tree<T> | null, node?: TreeNode<T>);
}
/**
 * Returns a sub-Tree for the given path.
 *
 * @param pathObj - Path to look up.
 * @returns Tree for path.
 */
export declare function treeSubTree<T>(tree: Tree<T>, pathObj: string | Path): Tree<T>;
/**
 * Returns the data associated with this tree node.
 *
 * @returns The data or null if no data exists.
 */
export declare function treeGetValue<T>(tree: Tree<T>): T | undefined;
/**
 * Sets data to this tree node.
 *
 * @param value - Value to set.
 */
export declare function treeSetValue<T>(tree: Tree<T>, value: T | undefined): void;
/**
 * @returns Whether the tree has any children.
 */
export declare function treeHasChildren<T>(tree: Tree<T>): boolean;
/**
 * @returns Whether the tree is empty (no value or children).
 */
export declare function treeIsEmpty<T>(tree: Tree<T>): boolean;
/**
 * Calls action for each child of this tree node.
 *
 * @param action - Action to be called for each child.
 */
export declare function treeForEachChild<T>(tree: Tree<T>, action: (tree: Tree<T>) => void): void;
/**
 * Does a depth-first traversal of this node's descendants, calling action for each one.
 *
 * @param action - Action to be called for each child.
 * @param includeSelf - Whether to call action on this node as well. Defaults to
 *   false.
 * @param childrenFirst - Whether to call action on children before calling it on
 *   parent.
 */
export declare function treeForEachDescendant<T>(tree: Tree<T>, action: (tree: Tree<T>) => void, includeSelf?: boolean, childrenFirst?: boolean): void;
/**
 * Calls action on each ancestor node.
 *
 * @param action - Action to be called on each parent; return
 *   true to abort.
 * @param includeSelf - Whether to call action on this node as well.
 * @returns true if the action callback returned true.
 */
export declare function treeForEachAncestor<T>(tree: Tree<T>, action: (tree: Tree<T>) => unknown, includeSelf?: boolean): boolean;
/**
 * Does a depth-first traversal of this node's descendants.  When a descendant with a value
 * is found, action is called on it and traversal does not continue inside the node.
 * Action is *not* called on this node.
 *
 * @param action - Action to be called for each child.
 */
export declare function treeForEachImmediateDescendantWithValue<T>(tree: Tree<T>, action: (tree: Tree<T>) => void): void;
/**
 * @returns The path of this tree node, as a Path.
 */
export declare function treeGetPath<T>(tree: Tree<T>): any;
