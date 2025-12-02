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
exports.RedisInstrumentation = void 0;
const instrumentation_1 = require("@opentelemetry/instrumentation");
const utils_1 = require("./utils");
/** @knipignore */
const version_1 = require("./version");
const DEFAULT_CONFIG = {
    requireParentSpan: false,
};
class RedisInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, Object.assign(Object.assign({}, DEFAULT_CONFIG), config));
    }
    setConfig(config = {}) {
        super.setConfig(Object.assign(Object.assign({}, DEFAULT_CONFIG), config));
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('redis', ['>=2.6.0 <4'], moduleExports => {
                if ((0, instrumentation_1.isWrapped)(moduleExports.RedisClient.prototype['internal_send_command'])) {
                    this._unwrap(moduleExports.RedisClient.prototype, 'internal_send_command');
                }
                this._wrap(moduleExports.RedisClient.prototype, 'internal_send_command', this._getPatchInternalSendCommand());
                if ((0, instrumentation_1.isWrapped)(moduleExports.RedisClient.prototype['create_stream'])) {
                    this._unwrap(moduleExports.RedisClient.prototype, 'create_stream');
                }
                this._wrap(moduleExports.RedisClient.prototype, 'create_stream', this._getPatchCreateStream());
                if ((0, instrumentation_1.isWrapped)(moduleExports.createClient)) {
                    this._unwrap(moduleExports, 'createClient');
                }
                this._wrap(moduleExports, 'createClient', this._getPatchCreateClient());
                return moduleExports;
            }, moduleExports => {
                if (moduleExports === undefined)
                    return;
                this._unwrap(moduleExports.RedisClient.prototype, 'internal_send_command');
                this._unwrap(moduleExports.RedisClient.prototype, 'create_stream');
                this._unwrap(moduleExports, 'createClient');
            }),
        ];
    }
    /**
     * Patch internal_send_command(...) to trace requests
     */
    _getPatchInternalSendCommand() {
        const tracer = this.tracer;
        const config = this.getConfig();
        return function internal_send_command(original) {
            return (0, utils_1.getTracedInternalSendCommand)(tracer, original, config);
        };
    }
    _getPatchCreateClient() {
        const tracer = this.tracer;
        return function createClient(original) {
            return (0, utils_1.getTracedCreateClient)(tracer, original);
        };
    }
    _getPatchCreateStream() {
        const tracer = this.tracer;
        return function createReadStream(original) {
            return (0, utils_1.getTracedCreateStreamTrace)(tracer, original);
        };
    }
}
exports.RedisInstrumentation = RedisInstrumentation;
RedisInstrumentation.COMPONENT = 'redis';
//# sourceMappingURL=instrumentation.js.map