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
import { Serializer } from '../serializer';
import { FieldPath } from '../path';
/**
 * A field constraint for a Query where clause.
 *
 * @private
 * @internal
 * @class
 */
export declare class FieldFilterInternal extends FilterInternal {
    private readonly serializer;
    readonly field: FieldPath;
    private readonly op;
    private readonly value;
    getFlattenedFilters(): FieldFilterInternal[];
    getFilters(): FilterInternal[];
    /**
     * @param serializer The Firestore serializer
     * @param field The path of the property value to compare.
     * @param op A comparison operation.
     * @param value The value to which to compare the field for inclusion in a
     * query.
     */
    constructor(serializer: Serializer, field: FieldPath, op: api.StructuredQuery.FieldFilter.Operator, value: unknown);
    /**
     * Returns whether this FieldFilter uses an equals comparison.
     *
     * @private
     * @internal
     */
    isInequalityFilter(): boolean;
    /**
     * Generates the proto representation for this field filter.
     *
     * @private
     * @internal
     */
    toProto(): api.StructuredQuery.IFilter;
    isEqual(other: FilterInternal): boolean;
}
