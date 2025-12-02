"use strict";
/**
 * Copyright 2023 Google LLC. All Rights Reserved.
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
exports.AggregateField = exports.Aggregate = void 0;
const path_1 = require("./path");
const assert = require("assert");
/**
 * Concrete implementation of the Aggregate type.
 */
class Aggregate {
    constructor(alias, aggregateType, fieldPath) {
        this.alias = alias;
        this.aggregateType = aggregateType;
        this.fieldPath = fieldPath;
    }
    /**
     * Converts this object to the proto representation of an Aggregate.
     * @internal
     */
    toProto() {
        const proto = {};
        if (this.aggregateType === 'count') {
            proto.count = {};
        }
        else if (this.aggregateType === 'sum') {
            assert(this.fieldPath !== undefined, 'Missing field path for sum aggregation.');
            proto.sum = {
                field: {
                    fieldPath: path_1.FieldPath.fromArgument(this.fieldPath).formattedName,
                },
            };
        }
        else if (this.aggregateType === 'avg') {
            assert(this.fieldPath !== undefined, 'Missing field path for average aggregation.');
            proto.avg = {
                field: {
                    fieldPath: path_1.FieldPath.fromArgument(this.fieldPath).formattedName,
                },
            };
        }
        else {
            throw new Error(`Aggregate type ${this.aggregateType} unimplemented.`);
        }
        proto.alias = this.alias;
        return proto;
    }
}
exports.Aggregate = Aggregate;
/**
 * Represents an aggregation that can be performed by Firestore.
 */
class AggregateField {
    /**
     * Create a new AggregateField<T>
     * @param aggregateType Specifies the type of aggregation operation to perform.
     * @param field Optionally specifies the field that is aggregated.
     * @internal
     */
    constructor(aggregateType, field) {
        this.aggregateType = aggregateType;
        /** A type string to uniquely identify instances of this class. */
        this.type = 'AggregateField';
        this._field = field;
    }
    /**
     * Compares this object with the given object for equality.
     *
     * This object is considered "equal" to the other object if and only if
     * `other` performs the same kind of aggregation on the same field (if any).
     *
     * @param other The object to compare to this object for equality.
     * @return `true` if this object is "equal" to the given object, as
     * defined above, or `false` otherwise.
     */
    isEqual(other) {
        return (other instanceof AggregateField &&
            this.aggregateType === other.aggregateType &&
            ((this._field === undefined && other._field === undefined) ||
                (this._field !== undefined &&
                    other._field !== undefined &&
                    path_1.FieldPath.fromArgument(this._field).isEqual(path_1.FieldPath.fromArgument(other._field)))));
    }
    /**
     * Create an AggregateField object that can be used to compute the count of
     * documents in the result set of a query.
     */
    static count() {
        return new AggregateField('count');
    }
    /**
     * Create an AggregateField object that can be used to compute the average of
     * a specified field over a range of documents in the result set of a query.
     * @param field Specifies the field to average across the result set.
     */
    static average(field) {
        return new AggregateField('avg', field);
    }
    /**
     * Create an AggregateField object that can be used to compute the sum of
     * a specified field over a range of documents in the result set of a query.
     * @param field Specifies the field to sum across the result set.
     */
    static sum(field) {
        return new AggregateField('sum', field);
    }
}
exports.AggregateField = AggregateField;
//# sourceMappingURL=aggregate.js.map