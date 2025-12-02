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
exports.TimestampNanosecondBuilder = exports.TimestampMicrosecondBuilder = exports.TimestampMillisecondBuilder = exports.TimestampSecondBuilder = exports.TimestampBuilder = void 0;
const builder_js_1 = require("../builder.js");
const set_js_1 = require("../visitor/set.js");
/** @ignore */
class TimestampBuilder extends builder_js_1.FixedWidthBuilder {
}
exports.TimestampBuilder = TimestampBuilder;
TimestampBuilder.prototype._setValue = set_js_1.setTimestamp;
/** @ignore */
class TimestampSecondBuilder extends TimestampBuilder {
}
exports.TimestampSecondBuilder = TimestampSecondBuilder;
TimestampSecondBuilder.prototype._setValue = set_js_1.setTimestampSecond;
/** @ignore */
class TimestampMillisecondBuilder extends TimestampBuilder {
}
exports.TimestampMillisecondBuilder = TimestampMillisecondBuilder;
TimestampMillisecondBuilder.prototype._setValue = set_js_1.setTimestampMillisecond;
/** @ignore */
class TimestampMicrosecondBuilder extends TimestampBuilder {
}
exports.TimestampMicrosecondBuilder = TimestampMicrosecondBuilder;
TimestampMicrosecondBuilder.prototype._setValue = set_js_1.setTimestampMicrosecond;
/** @ignore */
class TimestampNanosecondBuilder extends TimestampBuilder {
}
exports.TimestampNanosecondBuilder = TimestampNanosecondBuilder;
TimestampNanosecondBuilder.prototype._setValue = set_js_1.setTimestampNanosecond;

//# sourceMappingURL=timestamp.js.map
