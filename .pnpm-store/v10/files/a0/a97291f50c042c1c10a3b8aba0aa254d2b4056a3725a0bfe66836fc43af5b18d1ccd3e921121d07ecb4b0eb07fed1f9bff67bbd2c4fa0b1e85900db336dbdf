/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2024 Google Inc.
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
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValueImpl = void 0;
/**
 * Implements type-safe getters for parameter values.
 *
 * Visible for testing.
 *
 * @internal
 */
class ValueImpl {
    constructor(source, value = ValueImpl.DEFAULT_VALUE_FOR_STRING) {
        this.source = source;
        this.value = value;
    }
    asString() {
        return this.value;
    }
    asBoolean() {
        if (this.source === 'static') {
            return ValueImpl.DEFAULT_VALUE_FOR_BOOLEAN;
        }
        return ValueImpl.BOOLEAN_TRUTHY_VALUES.indexOf(this.value.toLowerCase()) >= 0;
    }
    asNumber() {
        if (this.source === 'static') {
            return ValueImpl.DEFAULT_VALUE_FOR_NUMBER;
        }
        const num = Number(this.value);
        if (isNaN(num)) {
            return ValueImpl.DEFAULT_VALUE_FOR_NUMBER;
        }
        return num;
    }
    getSource() {
        return this.source;
    }
}
exports.ValueImpl = ValueImpl;
ValueImpl.DEFAULT_VALUE_FOR_BOOLEAN = false;
ValueImpl.DEFAULT_VALUE_FOR_STRING = '';
ValueImpl.DEFAULT_VALUE_FOR_NUMBER = 0;
ValueImpl.BOOLEAN_TRUTHY_VALUES = ['1', 'true', 't', 'yes', 'y', 'on'];
