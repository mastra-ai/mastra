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
exports.DurationNanosecondBuilder = exports.DurationMicrosecondBuilder = exports.DurationMillisecondBuilder = exports.DurationSecondBuilder = exports.DurationBuilder = void 0;
const builder_js_1 = require("../builder.js");
const set_js_1 = require("../visitor/set.js");
/** @ignore */
class DurationBuilder extends builder_js_1.FixedWidthBuilder {
}
exports.DurationBuilder = DurationBuilder;
DurationBuilder.prototype._setValue = set_js_1.setDuration;
/** @ignore */
class DurationSecondBuilder extends DurationBuilder {
}
exports.DurationSecondBuilder = DurationSecondBuilder;
DurationSecondBuilder.prototype._setValue = set_js_1.setDurationSecond;
/** @ignore */
class DurationMillisecondBuilder extends DurationBuilder {
}
exports.DurationMillisecondBuilder = DurationMillisecondBuilder;
DurationMillisecondBuilder.prototype._setValue = set_js_1.setDurationMillisecond;
/** @ignore */
class DurationMicrosecondBuilder extends DurationBuilder {
}
exports.DurationMicrosecondBuilder = DurationMicrosecondBuilder;
DurationMicrosecondBuilder.prototype._setValue = set_js_1.setDurationMicrosecond;
/** @ignore */
class DurationNanosecondBuilder extends DurationBuilder {
}
exports.DurationNanosecondBuilder = DurationNanosecondBuilder;
DurationNanosecondBuilder.prototype._setValue = set_js_1.setDurationNanosecond;

//# sourceMappingURL=duration.js.map
