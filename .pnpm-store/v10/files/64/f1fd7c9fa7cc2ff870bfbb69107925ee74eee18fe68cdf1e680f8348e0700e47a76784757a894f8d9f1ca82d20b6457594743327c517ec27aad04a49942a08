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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.$ = exports.Client = exports.ResolvedConnectConfig = exports._RawConnection = exports.systemUtils = exports.createHttpClient = exports.createClient = void 0;
const nodeClient_1 = require("./nodeClient");
exports.default = nodeClient_1.createClient;
var nodeClient_2 = require("./nodeClient");
Object.defineProperty(exports, "createClient", { enumerable: true, get: function () { return nodeClient_2.createClient; } });
Object.defineProperty(exports, "createHttpClient", { enumerable: true, get: function () { return nodeClient_2.createHttpClient; } });
const systemUtils = __importStar(require("./systemUtils"));
exports.systemUtils = systemUtils;
var rawConn_1 = require("./rawConn");
Object.defineProperty(exports, "_RawConnection", { enumerable: true, get: function () { return rawConn_1.RawConnection; } });
var conUtils_1 = require("./conUtils");
Object.defineProperty(exports, "ResolvedConnectConfig", { enumerable: true, get: function () { return conUtils_1.ResolvedConnectConfig; } });
var baseClient_1 = require("./baseClient");
Object.defineProperty(exports, "Client", { enumerable: true, get: function () { return baseClient_1.Client; } });
__exportStar(require("./index.shared"), exports);
exports.$ = __importStar(require("./reflection/index"));
