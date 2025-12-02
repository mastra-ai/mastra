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
import { ChildrenNode } from '../ChildrenNode';
import { Node, NamedNode } from '../Node';
import { Index } from './Index';
export declare class KeyIndex extends Index {
    static get __EMPTY_NODE(): ChildrenNode;
    static set __EMPTY_NODE(val: ChildrenNode);
    compare(a: NamedNode, b: NamedNode): number;
    isDefinedOn(node: Node): boolean;
    indexedValueChanged(oldNode: Node, newNode: Node): boolean;
    minPost(): any;
    maxPost(): NamedNode;
    makePost(indexValue: string, name: string): NamedNode;
    /**
     * @returns String representation for inclusion in a query spec
     */
    toString(): string;
}
export declare const KEY_INDEX: KeyIndex;
