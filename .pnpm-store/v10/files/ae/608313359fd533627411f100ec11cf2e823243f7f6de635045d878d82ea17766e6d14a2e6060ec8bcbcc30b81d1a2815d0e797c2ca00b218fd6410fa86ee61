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
import { SortedMap } from '../util/SortedMap';
import { Index } from './indexes/Index';
import { NamedNode, Node } from './Node';
export declare class IndexMap {
    private indexes_;
    private indexSet_;
    /**
     * The default IndexMap for nodes without a priority
     */
    static get Default(): IndexMap;
    constructor(indexes_: {
        [k: string]: SortedMap<NamedNode, Node> | /*FallbackType*/ object;
    }, indexSet_: {
        [k: string]: Index;
    });
    get(indexKey: string): SortedMap<NamedNode, Node> | null;
    hasIndex(indexDefinition: Index): boolean;
    addIndex(indexDefinition: Index, existingChildren: SortedMap<string, Node>): IndexMap;
    /**
     * Ensure that this node is properly tracked in any indexes that we're maintaining
     */
    addToIndexes(namedNode: NamedNode, existingChildren: SortedMap<string, Node>): IndexMap;
    /**
     * Create a new IndexMap instance with the given value removed
     */
    removeFromIndexes(namedNode: NamedNode, existingChildren: SortedMap<string, Node>): IndexMap;
}
