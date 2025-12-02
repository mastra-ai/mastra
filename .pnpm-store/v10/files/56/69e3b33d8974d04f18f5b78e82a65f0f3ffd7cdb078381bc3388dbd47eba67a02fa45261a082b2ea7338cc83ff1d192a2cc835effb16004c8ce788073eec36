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

import { FixedWidthBuilder } from '../builder.js';
import { Int, Int8, Int16, Int32, Int64, Uint8, Uint16, Uint32, Uint64 } from '../type.js';

/** @ignore */
export class IntBuilder<T extends Int = Int, TNull = any> extends FixedWidthBuilder<T, TNull> {
    public setValue(index: number, value: T['TValue']) {
        this._values.set(index, value);
    }
}

/** @ignore */
export class Int8Builder<TNull = any> extends IntBuilder<Int8, TNull> { }
/** @ignore */
export class Int16Builder<TNull = any> extends IntBuilder<Int16, TNull> { }
/** @ignore */
export class Int32Builder<TNull = any> extends IntBuilder<Int32, TNull> { }
/** @ignore */
export class Int64Builder<TNull = any> extends IntBuilder<Int64, TNull> { }

/** @ignore */
export class Uint8Builder<TNull = any> extends IntBuilder<Uint8, TNull> { }
/** @ignore */
export class Uint16Builder<TNull = any> extends IntBuilder<Uint16, TNull> { }
/** @ignore */
export class Uint32Builder<TNull = any> extends IntBuilder<Uint32, TNull> { }
/** @ignore */
export class Uint64Builder<TNull = any> extends IntBuilder<Uint64, TNull> { }
