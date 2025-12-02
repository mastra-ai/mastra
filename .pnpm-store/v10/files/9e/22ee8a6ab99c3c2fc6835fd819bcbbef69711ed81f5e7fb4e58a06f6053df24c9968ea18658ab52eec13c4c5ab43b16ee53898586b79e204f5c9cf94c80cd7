"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const opentelemetry = require("@opentelemetry/sdk-node");
const api_1 = require("@opentelemetry/api");
const utils_1 = require("./utils");
api_1.diag.setLogger(new api_1.DiagConsoleLogger(), (0, utils_1.getLogLevelFromEnv)());
const sdk = new opentelemetry.NodeSDK({
    instrumentations: (0, utils_1.getNodeAutoInstrumentations)(),
    resourceDetectors: (0, utils_1.getResourceDetectorsFromEnv)(),
});
try {
    sdk.start();
    api_1.diag.info('OpenTelemetry automatic instrumentation started successfully');
}
catch (error) {
    api_1.diag.error('Error initializing OpenTelemetry SDK. Your application is not instrumented and will not produce telemetry', error);
}
async function shutdown() {
    try {
        await sdk.shutdown();
        api_1.diag.debug('OpenTelemetry SDK terminated');
    }
    catch (error) {
        api_1.diag.error('Error terminating OpenTelemetry SDK', error);
    }
}
// Gracefully shutdown SDK if a SIGTERM is received
process.on('SIGTERM', shutdown);
// Gracefully shutdown SDK if Node.js is exiting normally
process.once('beforeExit', shutdown);
//# sourceMappingURL=register.js.map