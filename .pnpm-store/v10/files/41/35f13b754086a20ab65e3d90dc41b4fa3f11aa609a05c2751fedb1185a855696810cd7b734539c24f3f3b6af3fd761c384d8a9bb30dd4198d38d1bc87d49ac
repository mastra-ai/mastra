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
import { Interval, IntervalDayTime, IntervalYearMonth } from '../type.js';
import { setIntervalValue, setIntervalDayTime, setIntervalYearMonth } from '../visitor/set.js';

/** @ignore */
export class IntervalBuilder<T extends Interval = Interval, TNull = any> extends FixedWidthBuilder<T, TNull> { }

(IntervalBuilder.prototype as any)._setValue = setIntervalValue;

/** @ignore */
export class IntervalDayTimeBuilder<TNull = any> extends IntervalBuilder<IntervalDayTime, TNull> { }

(IntervalDayTimeBuilder.prototype as any)._setValue = setIntervalDayTime;

/** @ignore */
export class IntervalYearMonthBuilder<TNull = any> extends IntervalBuilder<IntervalYearMonth, TNull> { }

(IntervalYearMonthBuilder.prototype as any)._setValue = setIntervalYearMonth;
