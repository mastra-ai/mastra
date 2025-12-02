
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
import { Duration, DurationSecond, DurationMillisecond, DurationMicrosecond, DurationNanosecond } from '../type.js';
import { setDuration, setDurationSecond, setDurationMillisecond, setDurationMicrosecond, setDurationNanosecond } from '../visitor/set.js';

/** @ignore */
export class DurationBuilder<T extends Duration = Duration, TNull = any> extends FixedWidthBuilder<T, TNull> { }

(DurationBuilder.prototype as any)._setValue = setDuration;

/** @ignore */
export class DurationSecondBuilder<TNull = any> extends DurationBuilder<DurationSecond, TNull> { }

(DurationSecondBuilder.prototype as any)._setValue = setDurationSecond;

/** @ignore */
export class DurationMillisecondBuilder<TNull = any> extends DurationBuilder<DurationMillisecond, TNull> { }

(DurationMillisecondBuilder.prototype as any)._setValue = setDurationMillisecond;

/** @ignore */
export class DurationMicrosecondBuilder<TNull = any> extends DurationBuilder<DurationMicrosecond, TNull> { }

(DurationMicrosecondBuilder.prototype as any)._setValue = setDurationMicrosecond;

/** @ignore */
export class DurationNanosecondBuilder<TNull = any> extends DurationBuilder<DurationNanosecond, TNull> { }

(DurationNanosecondBuilder.prototype as any)._setValue = setDurationNanosecond;
