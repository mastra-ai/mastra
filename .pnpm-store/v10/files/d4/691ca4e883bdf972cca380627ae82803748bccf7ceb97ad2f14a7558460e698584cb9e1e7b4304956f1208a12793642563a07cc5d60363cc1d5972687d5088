"use strict";
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNormalizedArgs = exports.IPC_TRANSPORT = void 0;
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const os_1 = require("os");
exports.IPC_TRANSPORT = (0, os_1.platform)() === 'win32' ? semantic_conventions_1.NETTRANSPORTVALUES_PIPE : semantic_conventions_1.NETTRANSPORTVALUES_UNIX;
function getHost(args) {
    return typeof args[1] === 'string' ? args[1] : 'localhost';
}
function getNormalizedArgs(args) {
    const opt = args[0];
    if (!opt) {
        return;
    }
    switch (typeof opt) {
        case 'number':
            return {
                port: opt,
                host: getHost(args),
            };
        case 'object':
            if (Array.isArray(opt)) {
                return getNormalizedArgs(opt);
            }
            return opt;
        case 'string': {
            const maybePort = Number(opt);
            if (maybePort >= 0) {
                return {
                    port: maybePort,
                    host: getHost(args),
                };
            }
            return {
                path: opt,
            };
        }
        default:
            return;
    }
}
exports.getNormalizedArgs = getNormalizedArgs;
//# sourceMappingURL=utils.js.map