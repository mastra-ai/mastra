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
import { NamedNode, Node } from '../../../core/snap/Node';
import { Index } from '../../snap/indexes/Index';
import { Path } from '../../util/Path';
import { ChildChangeAccumulator } from '../ChildChangeAccumulator';
import { CompleteChildSource } from '../CompleteChildSource';
import { QueryParams } from '../QueryParams';
import { IndexedFilter } from './IndexedFilter';
import { NodeFilter } from './NodeFilter';
/**
 * Filters nodes by range and uses an IndexFilter to track any changes after filtering the node
 */
export declare class RangedFilter implements NodeFilter {
    private indexedFilter_;
    private index_;
    private startPost_;
    private endPost_;
    private startIsInclusive_;
    private endIsInclusive_;
    constructor(params: QueryParams);
    getStartPost(): NamedNode;
    getEndPost(): NamedNode;
    matches(node: NamedNode): boolean;
    updateChild(snap: Node, key: string, newChild: Node, affectedPath: Path, source: CompleteChildSource, optChangeAccumulator: ChildChangeAccumulator | null): Node;
    updateFullNode(oldSnap: Node, newSnap: Node, optChangeAccumulator: ChildChangeAccumulator | null): Node;
    updatePriority(oldSnap: Node, newPriority: Node): Node;
    filtersNodes(): boolean;
    getIndexedFilter(): IndexedFilter;
    getIndex(): Index;
    private static getStartPost_;
    private static getEndPost_;
}
