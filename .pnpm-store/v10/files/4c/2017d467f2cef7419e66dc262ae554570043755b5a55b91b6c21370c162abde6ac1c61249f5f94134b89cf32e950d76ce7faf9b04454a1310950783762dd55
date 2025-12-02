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
import { Comparator } from '../../util/SortedMap';
import { Node, NamedNode } from '../Node';
export declare abstract class Index {
    abstract compare(a: NamedNode, b: NamedNode): number;
    abstract isDefinedOn(node: Node): boolean;
    /**
     * @returns A standalone comparison function for
     * this index
     */
    getCompare(): Comparator<NamedNode>;
    /**
     * Given a before and after value for a node, determine if the indexed value has changed. Even if they are different,
     * it's possible that the changes are isolated to parts of the snapshot that are not indexed.
     *
     *
     * @returns True if the portion of the snapshot being indexed changed between oldNode and newNode
     */
    indexedValueChanged(oldNode: Node, newNode: Node): boolean;
    /**
     * @returns a node wrapper that will sort equal to or less than
     * any other node wrapper, using this index
     */
    minPost(): NamedNode;
    /**
     * @returns a node wrapper that will sort greater than or equal to
     * any other node wrapper, using this index
     */
    abstract maxPost(): NamedNode;
    abstract makePost(indexValue: unknown, name: string): NamedNode;
    /**
     * @returns String representation for inclusion in a query spec
     */
    abstract toString(): string;
}
