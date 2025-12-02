// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { float64ToUint16 } from '../util/math.js';
import { FixedWidthBuilder } from '../builder.js';
import { Float, Float16, Float32, Float64 } from '../type.js';

/** @ignore */
export class FloatBuilder<T extends Float = Float, TNull = any> extends FixedWidthBuilder<T, TNull> {
    public setValue(index: number, value: number) {
        this._values.set(index, value);
    }
}

/** @ignore */
export class Float16Builder<TNull = any> extends FloatBuilder<Float16, TNull> {
    public setValue(index: number, value: number) {
        // convert JS float64 to a uint16
        super.setValue(index, float64ToUint16(value));
    }
}

/** @ignore */
export class Float32Builder<TNull = any> extends FloatBuilder<Float32, TNull> { }

/** @ignore */
export class Float64Builder<TNull = any> extends FloatBuilder<Float64, TNull> { }
