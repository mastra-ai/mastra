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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { OTLPExporterBase } from '@opentelemetry/otlp-exporter-base';
import { JsonLogsSerializer } from '@opentelemetry/otlp-transformer';
import { VERSION } from '../../version';
import { convertLegacyHttpOptions, createOtlpHttpExportDelegate, } from '@opentelemetry/otlp-exporter-base/node-http';
/**
 * Collector Logs Exporter for Node
 */
var OTLPLogExporter = /** @class */ (function (_super) {
    __extends(OTLPLogExporter, _super);
    function OTLPLogExporter(config) {
        if (config === void 0) { config = {}; }
        return _super.call(this, createOtlpHttpExportDelegate(convertLegacyHttpOptions(config, 'LOGS', 'v1/logs', {
            'User-Agent': "OTel-OTLP-Exporter-JavaScript/" + VERSION,
            'Content-Type': 'application/json',
        }), JsonLogsSerializer)) || this;
    }
    return OTLPLogExporter;
}(OTLPExporterBase));
export { OTLPLogExporter };
//# sourceMappingURL=OTLPLogExporter.js.map