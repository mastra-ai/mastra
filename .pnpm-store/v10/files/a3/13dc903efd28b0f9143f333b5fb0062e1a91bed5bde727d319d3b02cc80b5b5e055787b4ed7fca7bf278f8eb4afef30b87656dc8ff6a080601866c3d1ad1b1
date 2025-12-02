"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2020-present MagicStack Inc. and the Gel authors.
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Language = exports.Cardinality = exports.OutputFormat = void 0;
const chars = __importStar(require("./primitives/chars"));
var OutputFormat;
(function (OutputFormat) {
    OutputFormat[OutputFormat["BINARY"] = chars.$b] = "BINARY";
    OutputFormat[OutputFormat["JSON"] = chars.$j] = "JSON";
    OutputFormat[OutputFormat["NONE"] = chars.$n] = "NONE";
})(OutputFormat || (exports.OutputFormat = OutputFormat = {}));
var Cardinality;
(function (Cardinality) {
    Cardinality[Cardinality["NO_RESULT"] = chars.$n] = "NO_RESULT";
    Cardinality[Cardinality["AT_MOST_ONE"] = chars.$o] = "AT_MOST_ONE";
    Cardinality[Cardinality["ONE"] = chars.$A] = "ONE";
    Cardinality[Cardinality["MANY"] = chars.$m] = "MANY";
    Cardinality[Cardinality["AT_LEAST_ONE"] = chars.$M] = "AT_LEAST_ONE";
})(Cardinality || (exports.Cardinality = Cardinality = {}));
var Language;
(function (Language) {
    Language[Language["EDGEQL"] = chars.$E] = "EDGEQL";
    Language[Language["SQL"] = chars.$S] = "SQL";
})(Language || (exports.Language = Language = {}));
