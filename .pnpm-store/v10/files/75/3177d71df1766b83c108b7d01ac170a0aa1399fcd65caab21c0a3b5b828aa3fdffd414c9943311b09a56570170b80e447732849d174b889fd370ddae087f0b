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
import { trace, metrics } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { disableInstrumentations, enableInstrumentations, } from './autoLoaderUtils';
/**
 * It will register instrumentations and plugins
 * @param options
 * @return returns function to unload instrumentation and plugins that were
 *   registered
 */
export function registerInstrumentations(options) {
    var _a, _b;
    var tracerProvider = options.tracerProvider || trace.getTracerProvider();
    var meterProvider = options.meterProvider || metrics.getMeterProvider();
    var loggerProvider = options.loggerProvider || logs.getLoggerProvider();
    var instrumentations = (_b = (_a = options.instrumentations) === null || _a === void 0 ? void 0 : _a.flat()) !== null && _b !== void 0 ? _b : [];
    enableInstrumentations(instrumentations, tracerProvider, meterProvider, loggerProvider);
    return function () {
        disableInstrumentations(instrumentations);
    };
}
//# sourceMappingURL=autoLoader.js.map