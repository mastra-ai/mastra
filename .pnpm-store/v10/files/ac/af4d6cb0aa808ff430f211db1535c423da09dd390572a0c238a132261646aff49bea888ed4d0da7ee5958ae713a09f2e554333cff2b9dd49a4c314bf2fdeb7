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
exports.convertLegacyHeaders = void 0;
const shared_configuration_1 = require("./shared-configuration");
function convertLegacyHeaders(config) {
    if (typeof config.headers === 'function') {
        return config.headers;
    }
    return (0, shared_configuration_1.wrapStaticHeadersInFunction)(config.headers);
}
exports.convertLegacyHeaders = convertLegacyHeaders;
//# sourceMappingURL=convert-legacy-http-options.js.map