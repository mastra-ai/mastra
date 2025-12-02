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
import { PriorityIndex } from '../snap/indexes/PriorityIndex';
import { NodeFilter } from './filter/NodeFilter';
/**
 * This class is an immutable-from-the-public-api struct containing a set of query parameters defining a
 * range to be returned for a particular location. It is assumed that validation of parameters is done at the
 * user-facing API level, so it is not done here.
 *
 * @internal
 */
export declare class QueryParams {
    limitSet_: boolean;
    startSet_: boolean;
    startNameSet_: boolean;
    startAfterSet_: boolean;
    endSet_: boolean;
    endNameSet_: boolean;
    endBeforeSet_: boolean;
    limit_: number;
    viewFrom_: string;
    indexStartValue_: unknown | null;
    indexStartName_: string;
    indexEndValue_: unknown | null;
    indexEndName_: string;
    index_: PriorityIndex;
    hasStart(): boolean;
    /**
     * @returns True if it would return from left.
     */
    isViewFromLeft(): boolean;
    /**
     * Only valid to call if hasStart() returns true
     */
    getIndexStartValue(): unknown;
    /**
     * Only valid to call if hasStart() returns true.
     * Returns the starting key name for the range defined by these query parameters
     */
    getIndexStartName(): string;
    hasEnd(): boolean;
    /**
     * Only valid to call if hasEnd() returns true.
     */
    getIndexEndValue(): unknown;
    /**
     * Only valid to call if hasEnd() returns true.
     * Returns the end key name for the range defined by these query parameters
     */
    getIndexEndName(): string;
    hasLimit(): boolean;
    /**
     * @returns True if a limit has been set and it has been explicitly anchored
     */
    hasAnchoredLimit(): boolean;
    /**
     * Only valid to call if hasLimit() returns true
     */
    getLimit(): number;
    getIndex(): Index;
    loadsAllData(): boolean;
    isDefault(): boolean;
    copy(): QueryParams;
}
export declare function queryParamsGetNodeFilter(queryParams: QueryParams): NodeFilter;
export declare function queryParamsLimit(queryParams: QueryParams, newLimit: number): QueryParams;
export declare function queryParamsLimitToFirst(queryParams: QueryParams, newLimit: number): QueryParams;
export declare function queryParamsLimitToLast(queryParams: QueryParams, newLimit: number): QueryParams;
export declare function queryParamsStartAt(queryParams: QueryParams, indexValue: unknown, key?: string | null): QueryParams;
export declare function queryParamsStartAfter(queryParams: QueryParams, indexValue: unknown, key?: string | null): QueryParams;
export declare function queryParamsEndAt(queryParams: QueryParams, indexValue: unknown, key?: string | null): QueryParams;
export declare function queryParamsEndBefore(queryParams: QueryParams, indexValue: unknown, key?: string | null): QueryParams;
export declare function queryParamsOrderBy(queryParams: QueryParams, index: Index): QueryParams;
/**
 * Returns a set of REST query string parameters representing this query.
 *
 * @returns query string parameters
 */
export declare function queryParamsToRestQueryStringParameters(queryParams: QueryParams): Record<string, string | number>;
export declare function queryParamsGetQueryObject(queryParams: QueryParams): Record<string, unknown>;
