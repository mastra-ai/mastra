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
import { Timestamp, TimestampSecond, TimestampMillisecond, TimestampMicrosecond, TimestampNanosecond } from '../type.js';
import { setTimestamp, setTimestampSecond, setTimestampMillisecond, setTimestampMicrosecond, setTimestampNanosecond } from '../visitor/set.js';

/** @ignore */
export class TimestampBuilder<T extends Timestamp = Timestamp, TNull = any> extends FixedWidthBuilder<T, TNull> { }

(TimestampBuilder.prototype as any)._setValue = setTimestamp;

/** @ignore */
export class TimestampSecondBuilder<TNull = any> extends TimestampBuilder<TimestampSecond, TNull> { }

(TimestampSecondBuilder.prototype as any)._setValue = setTimestampSecond;

/** @ignore */
export class TimestampMillisecondBuilder<TNull = any> extends TimestampBuilder<TimestampMillisecond, TNull> { }

(TimestampMillisecondBuilder.prototype as any)._setValue = setTimestampMillisecond;

/** @ignore */
export class TimestampMicrosecondBuilder<TNull = any> extends TimestampBuilder<TimestampMicrosecond, TNull> { }

(TimestampMicrosecondBuilder.prototype as any)._setValue = setTimestampMicrosecond;

/** @ignore */
export class TimestampNanosecondBuilder<TNull = any> extends TimestampBuilder<TimestampNanosecond, TNull> { }

(TimestampNanosecondBuilder.prototype as any)._setValue = setTimestampNanosecond;
