"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntervalYearMonthBuilder = exports.IntervalDayTimeBuilder = exports.IntervalBuilder = void 0;
const builder_js_1 = require("../builder.js");
const set_js_1 = require("../visitor/set.js");
/** @ignore */
class IntervalBuilder extends builder_js_1.FixedWidthBuilder {
}
exports.IntervalBuilder = IntervalBuilder;
IntervalBuilder.prototype._setValue = set_js_1.setIntervalValue;
/** @ignore */
class IntervalDayTimeBuilder extends IntervalBuilder {
}
exports.IntervalDayTimeBuilder = IntervalDayTimeBuilder;
IntervalDayTimeBuilder.prototype._setValue = set_js_1.setIntervalDayTime;
/** @ignore */
class IntervalYearMonthBuilder extends IntervalBuilder {
}
exports.IntervalYearMonthBuilder = IntervalYearMonthBuilder;
IntervalYearMonthBuilder.prototype._setValue = set_js_1.setIntervalYearMonth;

//# sourceMappingURL=interval.js.map
