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
import { Index } from '../snap/indexes/Index';
import { NamedNode, Node } from '../snap/Node';
import { WriteTreeRef } from '../WriteTree';
import { ViewCache } from './ViewCache';
/**
 * Since updates to filtered nodes might require nodes to be pulled in from "outside" the node, this interface
 * can help to get complete children that can be pulled in.
 * A class implementing this interface takes potentially multiple sources (e.g. user writes, server data from
 * other views etc.) to try it's best to get a complete child that might be useful in pulling into the view.
 *
 * @interface
 */
export interface CompleteChildSource {
    getCompleteChild(childKey: string): Node | null;
    getChildAfterChild(index: Index, child: NamedNode, reverse: boolean): NamedNode | null;
}
/**
 * An implementation of CompleteChildSource that never returns any additional children
 */
export declare class NoCompleteChildSource_ implements CompleteChildSource {
    getCompleteChild(childKey?: string): Node | null;
    getChildAfterChild(index?: Index, child?: NamedNode, reverse?: boolean): NamedNode | null;
}
/**
 * Singleton instance.
 */
export declare const NO_COMPLETE_CHILD_SOURCE: NoCompleteChildSource_;
/**
 * An implementation of CompleteChildSource that uses a WriteTree in addition to any other server data or
 * old event caches available to calculate complete children.
 */
export declare class WriteTreeCompleteChildSource implements CompleteChildSource {
    private writes_;
    private viewCache_;
    private optCompleteServerCache_;
    constructor(writes_: WriteTreeRef, viewCache_: ViewCache, optCompleteServerCache_?: Node | null);
    getCompleteChild(childKey: string): Node | null;
    getChildAfterChild(index: Index, child: NamedNode, reverse: boolean): NamedNode | null;
}
