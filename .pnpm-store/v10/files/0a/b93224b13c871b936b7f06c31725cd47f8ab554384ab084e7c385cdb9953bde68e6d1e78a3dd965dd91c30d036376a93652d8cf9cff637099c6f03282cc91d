/**
 * Copyright 2024 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as protos from '../../protos/firestore_v1_proto_api';
import api = protos.google.firestore.v1;
import { FilterInternal } from './filter-internal';
import { FieldFilterInternal } from './field-filter-internal';
export declare class CompositeFilterInternal extends FilterInternal {
    private filters;
    private operator;
    constructor(filters: FilterInternal[], operator: api.StructuredQuery.CompositeFilter.Operator);
    private memoizedFlattenedFilters;
    getFilters(): FilterInternal[];
    isConjunction(): boolean;
    getFlattenedFilters(): FieldFilterInternal[];
    toProto(): api.StructuredQuery.IFilter;
    isEqual(other: FilterInternal): boolean;
}
