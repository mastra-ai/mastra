"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports._ReadBuffer = exports._CodecsRegistry = exports.throwWarnings = exports.logWarnings = exports.defaultBackoff = exports.Options = exports.RetryOptions = exports.RetryCondition = exports.IsolationLevel = exports.parseWKT = exports.Float16Array = exports.SparseVector = exports.MultiRange = exports.Range = exports.ConfigMemory = exports.DateDuration = exports.RelativeDuration = exports.Duration = exports.LocalTime = exports.LocalDate = exports.LocalDateTime = void 0;
var datetime_1 = require("./datatypes/datetime");
Object.defineProperty(exports, "LocalDateTime", { enumerable: true, get: function () { return datetime_1.LocalDateTime; } });
Object.defineProperty(exports, "LocalDate", { enumerable: true, get: function () { return datetime_1.LocalDate; } });
Object.defineProperty(exports, "LocalTime", { enumerable: true, get: function () { return datetime_1.LocalTime; } });
Object.defineProperty(exports, "Duration", { enumerable: true, get: function () { return datetime_1.Duration; } });
Object.defineProperty(exports, "RelativeDuration", { enumerable: true, get: function () { return datetime_1.RelativeDuration; } });
Object.defineProperty(exports, "DateDuration", { enumerable: true, get: function () { return datetime_1.DateDuration; } });
var memory_1 = require("./datatypes/memory");
Object.defineProperty(exports, "ConfigMemory", { enumerable: true, get: function () { return memory_1.ConfigMemory; } });
var range_1 = require("./datatypes/range");
Object.defineProperty(exports, "Range", { enumerable: true, get: function () { return range_1.Range; } });
Object.defineProperty(exports, "MultiRange", { enumerable: true, get: function () { return range_1.MultiRange; } });
var pgvector_1 = require("./datatypes/pgvector");
Object.defineProperty(exports, "SparseVector", { enumerable: true, get: function () { return pgvector_1.SparseVector; } });
var utils_1 = require("./utils");
Object.defineProperty(exports, "Float16Array", { enumerable: true, get: function () { return utils_1.Float16Array; } });
__exportStar(require("./datatypes/postgis"), exports);
var wkt_1 = require("./datatypes/wkt");
Object.defineProperty(exports, "parseWKT", { enumerable: true, get: function () { return wkt_1.parseWKT; } });
var options_1 = require("./options");
Object.defineProperty(exports, "IsolationLevel", { enumerable: true, get: function () { return options_1.IsolationLevel; } });
Object.defineProperty(exports, "RetryCondition", { enumerable: true, get: function () { return options_1.RetryCondition; } });
Object.defineProperty(exports, "RetryOptions", { enumerable: true, get: function () { return options_1.RetryOptions; } });
Object.defineProperty(exports, "Options", { enumerable: true, get: function () { return options_1.Options; } });
Object.defineProperty(exports, "defaultBackoff", { enumerable: true, get: function () { return options_1.defaultBackoff; } });
Object.defineProperty(exports, "logWarnings", { enumerable: true, get: function () { return options_1.logWarnings; } });
Object.defineProperty(exports, "throwWarnings", { enumerable: true, get: function () { return options_1.throwWarnings; } });
__exportStar(require("./errors"), exports);
const reg = __importStar(require("./codecs/registry"));
const buf = __importStar(require("./primitives/buffer"));
exports._CodecsRegistry = reg.CodecsRegistry;
exports._ReadBuffer = buf.ReadBuffer;
