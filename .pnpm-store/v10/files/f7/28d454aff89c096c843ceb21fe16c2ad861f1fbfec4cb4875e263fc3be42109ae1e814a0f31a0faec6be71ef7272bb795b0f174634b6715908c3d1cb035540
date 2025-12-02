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
exports.PinoInstrumentation = void 0;
const api_1 = require("@opentelemetry/api");
const instrumentation_1 = require("@opentelemetry/instrumentation");
/** @knipignore */
const version_1 = require("./version");
const log_sending_utils_1 = require("./log-sending-utils");
const pinoVersions = ['>=5.14.0 <10'];
const DEFAULT_LOG_KEYS = {
    traceId: 'trace_id',
    spanId: 'span_id',
    traceFlags: 'trace_flags',
};
class PinoInstrumentation extends instrumentation_1.InstrumentationBase {
    constructor(config = {}) {
        super(version_1.PACKAGE_NAME, version_1.PACKAGE_VERSION, config);
    }
    init() {
        return [
            new instrumentation_1.InstrumentationNodeModuleDefinition('pino', pinoVersions, module => {
                const isESM = module[Symbol.toStringTag] === 'Module';
                const moduleExports = isESM ? module.default : module;
                const instrumentation = this;
                const patchedPino = Object.assign((...args) => {
                    const config = instrumentation.getConfig();
                    const isEnabled = instrumentation.isEnabled();
                    const logger = moduleExports(...args);
                    // Setup "log correlation" -- injection of `trace_id` et al fields.
                    // Note: If the Pino logger is configured with `nestedKey`, then
                    // the `trace_id` et al fields added by `otelMixin` will be nested
                    // as well. https://getpino.io/#/docs/api?id=mixin-function
                    const otelMixin = instrumentation._getMixinFunction();
                    const mixinSym = moduleExports.symbols.mixinSym;
                    const origMixin = logger[mixinSym];
                    if (origMixin === undefined) {
                        logger[mixinSym] = otelMixin;
                    }
                    else {
                        logger[mixinSym] = (ctx, level) => {
                            return Object.assign(otelMixin(ctx, level), origMixin(ctx, level));
                        };
                    }
                    // Setup "log sending" -- sending log records to the Logs API.
                    // This depends on `pino.multistream`, which was added in v7.0.0.
                    if (isEnabled &&
                        !config.disableLogSending &&
                        typeof moduleExports.multistream === 'function') {
                        const otelTimestampFromTime = (0, log_sending_utils_1.getTimeConverter)(logger, moduleExports);
                        const otelStream = new log_sending_utils_1.OTelPinoStream({
                            messageKey: logger[moduleExports.symbols.messageKeySym],
                            levels: logger.levels,
                            otelTimestampFromTime,
                        });
                        otelStream[Symbol.for('pino.metadata')] = true; // for `stream.lastLevel`
                        // An error typically indicates a Pino bug, or logger configuration
                        // bug. `diag.warn` *once* for the first error on the assumption
                        // subsequent ones stem from the same bug.
                        otelStream.once('unknown', (line, err) => {
                            instrumentation._diag.warn('could not send pino log line (will only log first occurrence)', { line, err });
                        });
                        // Use pino's own `multistream` to send to the original stream and
                        // to the OTel Logs API/SDK.
                        // https://getpino.io/#/docs/api?id=pinomultistreamstreamsarray-opts-gt-multistreamres
                        const origStream = logger[moduleExports.symbols.streamSym];
                        logger[moduleExports.symbols.streamSym] = moduleExports.multistream([
                            // Use level `0` to never not log a record given to the stream.
                            { level: 0, stream: origStream },
                            { level: 0, stream: otelStream },
                        ], { levels: logger.levels.values });
                    }
                    return logger;
                }, moduleExports);
                if (typeof patchedPino.pino === 'function') {
                    patchedPino.pino = patchedPino;
                }
                if (typeof patchedPino.default === 'function') {
                    patchedPino.default = patchedPino;
                }
                /* istanbul ignore if */
                if (isESM) {
                    if (module.pino) {
                        // This was added in pino@6.8.0 (https://github.com/pinojs/pino/pull/936).
                        module.pino = patchedPino;
                    }
                    module.default = patchedPino;
                }
                return patchedPino;
            }),
        ];
    }
    _callHook(span, record, level) {
        const { logHook } = this.getConfig();
        if (!logHook) {
            return;
        }
        (0, instrumentation_1.safeExecuteInTheMiddle)(() => logHook(span, record, level), err => {
            if (err) {
                api_1.diag.error('pino instrumentation: error calling logHook', err);
            }
        }, true);
    }
    _getMixinFunction() {
        const instrumentation = this;
        return function otelMixin(_context, level) {
            var _a;
            if (!instrumentation.isEnabled() ||
                instrumentation.getConfig().disableLogCorrelation) {
                return {};
            }
            const span = api_1.trace.getSpan(api_1.context.active());
            if (!span) {
                return {};
            }
            const spanContext = span.spanContext();
            if (!(0, api_1.isSpanContextValid)(spanContext)) {
                return {};
            }
            const logKeys = (_a = instrumentation.getConfig().logKeys) !== null && _a !== void 0 ? _a : DEFAULT_LOG_KEYS;
            const record = {
                [logKeys.traceId]: spanContext.traceId,
                [logKeys.spanId]: spanContext.spanId,
                [logKeys.traceFlags]: `0${spanContext.traceFlags.toString(16)}`,
            };
            instrumentation._callHook(span, record, level);
            return record;
        };
    }
}
exports.PinoInstrumentation = PinoInstrumentation;
//# sourceMappingURL=instrumentation.js.map