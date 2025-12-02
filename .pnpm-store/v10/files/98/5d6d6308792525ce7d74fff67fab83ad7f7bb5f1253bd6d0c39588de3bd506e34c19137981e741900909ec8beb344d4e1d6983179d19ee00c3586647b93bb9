"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldFilterInternal = void 0;
const deepEqual = require("fast-deep-equal");
const filter_internal_1 = require("./filter-internal");
/**
 * A field constraint for a Query where clause.
 *
 * @private
 * @internal
 * @class
 */
class FieldFilterInternal extends filter_internal_1.FilterInternal {
    getFlattenedFilters() {
        return [this];
    }
    getFilters() {
        return [this];
    }
    /**
     * @param serializer The Firestore serializer
     * @param field The path of the property value to compare.
     * @param op A comparison operation.
     * @param value The value to which to compare the field for inclusion in a
     * query.
     */
    constructor(serializer, field, op, value) {
        super();
        this.serializer = serializer;
        this.field = field;
        this.op = op;
        this.value = value;
    }
    /**
     * Returns whether this FieldFilter uses an equals comparison.
     *
     * @private
     * @internal
     */
    isInequalityFilter() {
        switch (this.op) {
            case 'GREATER_THAN':
            case 'GREATER_THAN_OR_EQUAL':
            case 'LESS_THAN':
            case 'LESS_THAN_OR_EQUAL':
            case 'NOT_EQUAL':
            case 'NOT_IN':
                return true;
            default:
                return false;
        }
    }
    /**
     * Generates the proto representation for this field filter.
     *
     * @private
     * @internal
     */
    toProto() {
        if (typeof this.value === 'number' && isNaN(this.value)) {
            return {
                unaryFilter: {
                    field: {
                        fieldPath: this.field.formattedName,
                    },
                    op: this.op === 'EQUAL' ? 'IS_NAN' : 'IS_NOT_NAN',
                },
            };
        }
        if (this.value === null) {
            return {
                unaryFilter: {
                    field: {
                        fieldPath: this.field.formattedName,
                    },
                    op: this.op === 'EQUAL' ? 'IS_NULL' : 'IS_NOT_NULL',
                },
            };
        }
        return {
            fieldFilter: {
                field: {
                    fieldPath: this.field.formattedName,
                },
                op: this.op,
                value: this.serializer.encodeValue(this.value),
            },
        };
    }
    isEqual(other) {
        return (other instanceof FieldFilterInternal &&
            this.field.isEqual(other.field) &&
            this.op === other.op &&
            deepEqual(this.value, other.value));
    }
}
exports.FieldFilterInternal = FieldFilterInternal;
//# sourceMappingURL=field-filter-internal.js.map