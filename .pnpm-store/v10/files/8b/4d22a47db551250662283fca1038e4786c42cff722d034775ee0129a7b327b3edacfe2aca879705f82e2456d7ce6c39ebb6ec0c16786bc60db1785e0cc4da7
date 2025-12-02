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
import { Index } from '../../snap/indexes/Index';
import { Node } from '../../snap/Node';
import { Path } from '../../util/Path';
import { ChildChangeAccumulator } from '../ChildChangeAccumulator';
import { CompleteChildSource } from '../CompleteChildSource';
import { QueryParams } from '../QueryParams';
import { IndexedFilter } from './IndexedFilter';
import { NodeFilter } from './NodeFilter';
/**
 * Applies a limit and a range to a node and uses RangedFilter to do the heavy lifting where possible
 */
export declare class LimitedFilter implements NodeFilter {
    private readonly rangedFilter_;
    private readonly index_;
    private readonly limit_;
    private readonly reverse_;
    private readonly startIsInclusive_;
    private readonly endIsInclusive_;
    constructor(params: QueryParams);
    updateChild(snap: Node, key: string, newChild: Node, affectedPath: Path, source: CompleteChildSource, optChangeAccumulator: ChildChangeAccumulator | null): Node;
    updateFullNode(oldSnap: Node, newSnap: Node, optChangeAccumulator: ChildChangeAccumulator | null): Node;
    updatePriority(oldSnap: Node, newPriority: Node): Node;
    filtersNodes(): boolean;
    getIndexedFilter(): IndexedFilter;
    getIndex(): Index;
    private fullLimitUpdateChild_;
    private withinDirectionalStart;
    private withinDirectionalEnd;
    private withinStartPost;
    private withinEndPost;
}
