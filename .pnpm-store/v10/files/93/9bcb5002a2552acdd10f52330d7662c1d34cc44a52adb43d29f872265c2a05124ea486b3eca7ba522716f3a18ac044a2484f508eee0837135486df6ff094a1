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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { OTLPMetricExporterBase } from '../../OTLPMetricExporterBase';
import { JsonMetricsSerializer } from '@opentelemetry/otlp-transformer';
import { VERSION } from '../../version';
import { convertLegacyHttpOptions, createOtlpHttpExportDelegate, } from '@opentelemetry/otlp-exporter-base/node-http';
var USER_AGENT = {
    'User-Agent': "OTel-OTLP-Exporter-JavaScript/" + VERSION,
};
/**
 * OTLP Metric Exporter for Node.js
 */
var OTLPMetricExporter = /** @class */ (function (_super) {
    __extends(OTLPMetricExporter, _super);
    function OTLPMetricExporter(config) {
        return _super.call(this, createOtlpHttpExportDelegate(convertLegacyHttpOptions(config !== null && config !== void 0 ? config : {}, 'METRICS', 'v1/metrics', __assign(__assign({}, USER_AGENT), { 'Content-Type': 'application/json' })), JsonMetricsSerializer), config) || this;
    }
    return OTLPMetricExporter;
}(OTLPMetricExporterBase));
export { OTLPMetricExporter };
//# sourceMappingURL=OTLPMetricExporter.js.map