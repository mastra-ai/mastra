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
exports.WinstonInstrumentation = void 0;
const api_1 = require("@opentelemetry/api");
const api_logs_1 = require("@opentelemetry/api-logs");
const instrumentation_1 = require("@opentelemetry/instrumentation");
/** @knipignore */
const version_1 = require("./version");
const winston3Versions = ['>=3 <4'];
const winstonPre3Versions = ['>=1 <3'];
class WinstonInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        const winstons3instrumentationNodeModuleDefinition = new instrumentation_1.InstrumentationNodeModuleDefinition('winston', winston3Versions, moduleExports => moduleExports, () => { }, [
            new instrumentation_1.InstrumentationNodeModuleFile('winston/lib/winston/logger.js', winston3Versions, (logger) => {
                if ((0, instrumentation_1.isWrapped)(logger.prototype['write'])) {
                    this._unwrap(logger.prototype, 'write');
                }
                this._wrap(logger.prototype, 'write', this._getPatchedWrite());
                // Wrap configure
                if ((0, instrumentation_1.isWrapped)(logger.prototype['configure'])) {
                    this._unwrap(logger.prototype, 'configure');
                }
                this._wrap(logger.prototype, 'configure', this._getPatchedConfigure());
                return logger;
            }, (logger) => {
                if (logger === undefined)
                    return;
                this._unwrap(logger.prototype, 'write');
                this._unwrap(logger.prototype, 'configure');
            }),
        ]);
        const winstons2instrumentationNodeModuleDefinition = new instrumentation_1.InstrumentationNodeModuleDefinition('winston', winstonPre3Versions, moduleExports => moduleExports, () => { }, [
            new instrumentation_1.InstrumentationNodeModuleFile('winston/lib/winston/logger.js', winstonPre3Versions, (fileExports) => {
                const proto = fileExports.Logger.prototype;
                if ((0, instrumentation_1.isWrapped)(proto.log)) {
                    this._unwrap(proto, 'log');
                }
                this._wrap(proto, 'log', this._getPatchedLog());
                return fileExports;
            }, (fileExports) => {
                if (fileExports === undefined)
                    return;
                this._unwrap(fileExports.Logger.prototype, 'log');
            }),
        ]);
        return [
            winstons3instrumentationNodeModuleDefinition,
            winstons2instrumentationNodeModuleDefinition,
        ];
    }
    _callHook(span, record) {
        const { logHook } = this.getConfig();
        if (!logHook) {
            return;
        }
        (0, instrumentation_1.safeExecuteInTheMiddle)(() => logHook(span, record), err => {
            if (err) {
                this._diag.error('error calling logHook', err);
            }
        }, true);
    }
    _getPatchedWrite() {
        return (original) => {
            const instrumentation = this;
            return function patchedWrite(...args) {
                const record = args[0];
                instrumentation._handleLogCorrelation(record);
                return original.apply(this, args);
            };
        };
    }
    _getPatchedLog() {
        return (original) => {
            const instrumentation = this;
            return function patchedLog(...args) {
                const record = {};
                instrumentation._handleLogCorrelation(record);
                // Inject in metadata argument
                let isDataInjected = false;
                for (let i = args.length - 1; i >= 0; i--) {
                    if (typeof args[i] === 'object') {
                        args[i] = Object.assign(args[i], record);
                        isDataInjected = true;
                        break;
                    }
                }
                if (!isDataInjected) {
                    const insertAt = typeof args[args.length - 1] === 'function'
                        ? args.length - 1
                        : args.length;
                    args.splice(insertAt, 0, record);
                }
                return original.apply(this, args);
            };
        };
    }
    _getPatchedConfigure() {
        return (original) => {
            const instrumentation = this;
            return function patchedConfigure(...args) {
                const config = instrumentation.getConfig();
                if (!config.disableLogSending) {
                    if (args && args.length > 0) {
                        // Try to load Winston transport
                        try {
                            const { OpenTelemetryTransportV3, } = require('@opentelemetry/winston-transport');
                            const originalTransports = args[0].transports;
                            let newTransports = Array.isArray(originalTransports)
                                ? originalTransports
                                : [];
                            let transportOptions = {};
                            if (config.logSeverity) {
                                const winstonLevel = instrumentation._winstonLevelFromSeverity(config.logSeverity, args[0].levels);
                                transportOptions = { level: winstonLevel };
                            }
                            const openTelemetryTransport = new OpenTelemetryTransportV3(transportOptions);
                            if (originalTransports && !Array.isArray(originalTransports)) {
                                newTransports = [originalTransports];
                            }
                            newTransports.push(openTelemetryTransport);
                            args[0].transports = newTransports;
                        }
                        catch (err) {
                            instrumentation._diag.warn('@opentelemetry/winston-transport is not available, log records will not be automatically sent.');
                        }
                    }
                }
                return original.apply(this, args);
            };
        };
    }
    _handleLogCorrelation(record) {
        if (!this.getConfig().disableLogCorrelation) {
            const span = api_1.trace.getSpan(api_1.context.active());
            if (span) {
                const spanContext = span.spanContext();
                if ((0, api_1.isSpanContextValid)(spanContext)) {
                    const fields = {
                        trace_id: spanContext.traceId,
                        span_id: spanContext.spanId,
                        trace_flags: `0${spanContext.traceFlags.toString(16)}`,
                    };
                    const enhancedRecord = Object.assign(record, fields);
                    this._callHook(span, enhancedRecord);
                    return enhancedRecord;
                }
            }
        }
        return record;
    }
    _winstonLevelFromSeverity(severity, winstonLevels) {
        if (winstonLevels) {
            if (isNpmLevels(winstonLevels)) {
                if (severity >= api_logs_1.SeverityNumber.ERROR) {
                    return 'error';
                }
                else if (severity >= api_logs_1.SeverityNumber.WARN) {
                    return 'warn';
                }
                else if (severity >= api_logs_1.SeverityNumber.INFO) {
                    return 'info';
                }
                else if (severity >= api_logs_1.SeverityNumber.DEBUG3) {
                    return 'http';
                }
                else if (severity >= api_logs_1.SeverityNumber.DEBUG2) {
                    return 'verbose';
                }
                else if (severity >= api_logs_1.SeverityNumber.DEBUG) {
                    return 'debug';
                }
                else if (severity >= api_logs_1.SeverityNumber.TRACE) {
                    return 'silly';
                }
            }
            else if (isCliLevels(winstonLevels)) {
                if (severity >= api_logs_1.SeverityNumber.ERROR) {
                    return 'error';
                }
                else if (severity >= api_logs_1.SeverityNumber.WARN) {
                    return 'warn';
                }
                else if (severity >= api_logs_1.SeverityNumber.INFO3) {
                    return 'help';
                }
                else if (severity >= api_logs_1.SeverityNumber.INFO2) {
                    return 'data';
                }
                else if (severity >= api_logs_1.SeverityNumber.INFO) {
                    return 'info';
                }
                else if (severity >= api_logs_1.SeverityNumber.DEBUG) {
                    return 'debug';
                }
                else if (severity >= api_logs_1.SeverityNumber.TRACE4) {
                    return 'prompt';
                }
                else if (severity >= api_logs_1.SeverityNumber.TRACE3) {
                    return 'verbose';
                }
                else if (severity >= api_logs_1.SeverityNumber.TRACE2) {
                    return 'input';
                }
                else if (severity >= api_logs_1.SeverityNumber.TRACE) {
                    return 'silly';
                }
            }
            else if (isSyslogLevels(winstonLevels)) {
                if (severity >= api_logs_1.SeverityNumber.FATAL2) {
                    return 'emerg';
                }
                else if (severity >= api_logs_1.SeverityNumber.FATAL) {
                    return 'alert';
                }
                else if (severity >= api_logs_1.SeverityNumber.ERROR2) {
                    return 'crit';
                }
                else if (severity >= api_logs_1.SeverityNumber.ERROR) {
                    return 'error';
                }
                else if (severity >= api_logs_1.SeverityNumber.WARN) {
                    return 'warning';
                }
                else if (severity >= api_logs_1.SeverityNumber.INFO2) {
                    return 'notice';
                }
                else if (severity >= api_logs_1.SeverityNumber.INFO) {
                    return 'info';
                }
                else if (severity >= api_logs_1.SeverityNumber.TRACE) {
                    return 'debug';
                }
            }
            // Unknown level
            this._diag.warn('failed to configure severity with existing winston levels');
        }
        function isCliLevels(arg) {
            return (arg &&
                arg.error !== undefined &&
                arg.warn &&
                arg.help &&
                arg.data &&
                arg.info &&
                arg.debug &&
                arg.prompt &&
                arg.verbose &&
                arg.input &&
                arg.silly);
        }
        function isNpmLevels(arg) {
            return (arg &&
                arg.error !== undefined &&
                arg.warn &&
                arg.info &&
                arg.http &&
                arg.verbose &&
                arg.debug &&
                arg.silly);
        }
        function isSyslogLevels(arg) {
            return (arg &&
                arg.emerg !== undefined &&
                arg.alert &&
                arg.crit &&
                arg.error &&
                arg.warning &&
                arg.notice &&
                arg.info &&
                arg.debug);
        }
        return;
    }
}
exports.WinstonInstrumentation = WinstonInstrumentation;
//# sourceMappingURL=instrumentation.js.map