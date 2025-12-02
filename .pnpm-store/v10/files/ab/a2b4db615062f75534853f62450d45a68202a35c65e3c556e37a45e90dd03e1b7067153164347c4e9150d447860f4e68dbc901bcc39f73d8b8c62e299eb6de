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
exports.FieldOrder = void 0;
/**
 * A Query order-by field.
 *
 * @private
 * @internal
 * @class
 */
class FieldOrder {
    /**
     * @param field The name of a document field (member) on which to order query
     * results.
     * @param direction One of 'ASCENDING' (default) or 'DESCENDING' to
     * set the ordering direction to ascending or descending, respectively.
     */
    constructor(field, direction = 'ASCENDING') {
        this.field = field;
        this.direction = direction;
    }
    /**
     * Generates the proto representation for this field order.
     * @private
     * @internal
     */
    toProto() {
        return {
            field: {
                fieldPath: this.field.formattedName,
            },
            direction: this.direction,
        };
    }
}
exports.FieldOrder = FieldOrder;
//# sourceMappingURL=field-order.js.map