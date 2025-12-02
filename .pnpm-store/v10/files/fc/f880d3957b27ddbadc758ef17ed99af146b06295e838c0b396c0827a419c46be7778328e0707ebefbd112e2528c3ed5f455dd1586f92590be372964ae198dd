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
exports.BunyanInstrumentation = void 0;
const util_1 = require("util");
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
/** @knipignore */
const version_1 = require("./version");
const OpenTelemetryBunyanStream_1 = require("./OpenTelemetryBunyanStream");
const api_logs_1 = require("@opentelemetry/api-logs");
const DEFAULT_CONFIG = {
    disableLogSending: false,
    disableLogCorrelation: false,
};
class BunyanInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, Object.assign(Object.assign({}, DEFAULT_CONFIG), config));
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('bunyan', ['>=1.0.0 <2'], (module) => {
                const instrumentation = this;
                const Logger = module[Symbol.toStringTag] === 'Module'
                    ? module.default // ESM
                    : module; // CommonJS
                this._wrap(Logger.prototype, '_emit', 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this._getPatchedEmit());
                function LoggerTraced(...args) {
                    let inst;
                    let retval = undefined;
                    if (this instanceof LoggerTraced) {
                        // called with `new Logger()`
                        inst = this;
                        Logger.apply(this, args);
                    }
                    else {
                        // called without `new`
                        inst = Logger(...args);
                        retval = inst;
                    }
                    // If `_childOptions` is defined, this is a `Logger#child(...)`
                    // call. We must not add an OTel stream again.
                    if (args[1] /* _childOptions */ === undefined) {
                        instrumentation._addStream(inst);
                    }
                    return retval;
                }
                // Must use the deprecated `inherits` to support this style:
                //    const log = require('bunyan')({name: 'foo'});
                // i.e. calling the constructor function without `new`.
                (0, util_1.inherits)(LoggerTraced, Logger);
                const patchedExports = Object.assign(LoggerTraced, Logger);
                this._wrap(patchedExports, 'createLogger', 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this._getPatchedCreateLogger());
                return patchedExports;
            }),
        ];
    }
    setConfig(config = {}) {
        super.setConfig(Object.assign(Object.assign({}, DEFAULT_CONFIG), config));
    }
    _getPatchedEmit() {
        return (original) => {
            const instrumentation = this;
            return function patchedEmit(...args) {
                const config = instrumentation.getConfig();
                if (!instrumentation.isEnabled() || config.disableLogCorrelation) {
                    return original.apply(this, args);
                }
                const span = api_1.trace.getSpan(api_1.context.active());
                if (!span) {
                    return original.apply(this, args);
                }
                const spanContext = span.spanContext();
                if (!(0, api_1.isSpanContextValid)(spanContext)) {
                    return original.apply(this, args);
                }
                const record = args[0];
                record['trace_id'] = spanContext.traceId;
                record['span_id'] = spanContext.spanId;
                record['trace_flags'] = `0${spanContext.traceFlags.toString(16)}`;
                instrumentation._callHook(span, record);
                return original.apply(this, args);
            };
        };
    }
    _getPatchedCreateLogger() {
        return (original) => {
            const instrumentation = this;
            return function patchedCreateLogger(...args) {
                const logger = original(...args);
                instrumentation._addStream(logger);
                return logger;
            };
        };
    }
    _addStream(logger) {
        const config = this.getConfig();
        if (!this.isEnabled() || config.disableLogSending) {
            return;
        }
        this._diag.debug('Adding OpenTelemetryBunyanStream to logger');
        let streamLevel = logger.level();
        if (config.logSeverity) {
            const bunyanLevel = bunyanLevelFromSeverity(config.logSeverity);
            streamLevel = bunyanLevel || streamLevel;
        }
        logger.addStream({
            type: 'raw',
            stream: new OpenTelemetryBunyanStream_1.OpenTelemetryBunyanStream(),
            level: streamLevel,
        });
    }
    _callHook(span, record) {
        const { logHook } = this.getConfig();
        if (typeof logHook !== 'function') {
            return;
        }
        (0, instrumentation_1.safeExecuteInTheMiddle)(() => logHook(span, record), err => {
            if (err) {
                this._diag.error('error calling logHook', err);
            }
        }, true);
    }
}
exports.BunyanInstrumentation = BunyanInstrumentation;
function bunyanLevelFromSeverity(severity) {
    if (severity >= api_logs_1.SeverityNumber.FATAL) {
        return 'fatal';
    }
    else if (severity >= api_logs_1.SeverityNumber.ERROR) {
        return 'error';
    }
    else if (severity >= api_logs_1.SeverityNumber.WARN) {
        return 'warn';
    }
    else if (severity >= api_logs_1.SeverityNumber.INFO) {
        return 'info';
    }
    else if (severity >= api_logs_1.SeverityNumber.DEBUG) {
        return 'debug';
    }
    else if (severity >= api_logs_1.SeverityNumber.TRACE) {
        return 'trace';
    }
    return;
}
//# sourceMappingURL=instrumentation.js.map