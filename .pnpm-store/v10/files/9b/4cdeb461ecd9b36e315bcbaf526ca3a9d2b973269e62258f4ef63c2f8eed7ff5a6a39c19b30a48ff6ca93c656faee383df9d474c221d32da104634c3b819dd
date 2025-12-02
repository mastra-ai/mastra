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
import { getEnv } from '@opentelemetry/core';
import { AggregationTemporality, InstrumentType, Aggregation, } from '@opentelemetry/sdk-metrics';
import { AggregationTemporalityPreference, } from './OTLPMetricExporterOptions';
import { OTLPExporterBase, } from '@opentelemetry/otlp-exporter-base';
import { diag } from '@opentelemetry/api';
export var CumulativeTemporalitySelector = function () { return AggregationTemporality.CUMULATIVE; };
export var DeltaTemporalitySelector = function (instrumentType) {
    switch (instrumentType) {
        case InstrumentType.COUNTER:
        case InstrumentType.OBSERVABLE_COUNTER:
        case InstrumentType.GAUGE:
        case InstrumentType.HISTOGRAM:
        case InstrumentType.OBSERVABLE_GAUGE:
            return AggregationTemporality.DELTA;
        case InstrumentType.UP_DOWN_COUNTER:
        case InstrumentType.OBSERVABLE_UP_DOWN_COUNTER:
            return AggregationTemporality.CUMULATIVE;
    }
};
export var LowMemoryTemporalitySelector = function (instrumentType) {
    switch (instrumentType) {
        case InstrumentType.COUNTER:
        case InstrumentType.HISTOGRAM:
            return AggregationTemporality.DELTA;
        case InstrumentType.GAUGE:
        case InstrumentType.UP_DOWN_COUNTER:
        case InstrumentType.OBSERVABLE_UP_DOWN_COUNTER:
        case InstrumentType.OBSERVABLE_COUNTER:
        case InstrumentType.OBSERVABLE_GAUGE:
            return AggregationTemporality.CUMULATIVE;
    }
};
function chooseTemporalitySelectorFromEnvironment() {
    var env = getEnv();
    var configuredTemporality = env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE.trim().toLowerCase();
    if (configuredTemporality === 'cumulative') {
        return CumulativeTemporalitySelector;
    }
    if (configuredTemporality === 'delta') {
        return DeltaTemporalitySelector;
    }
    if (configuredTemporality === 'lowmemory') {
        return LowMemoryTemporalitySelector;
    }
    diag.warn("OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE is set to '" + env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE + "', but only 'cumulative' and 'delta' are allowed. Using default ('cumulative') instead.");
    return CumulativeTemporalitySelector;
}
function chooseTemporalitySelector(temporalityPreference) {
    // Directly passed preference has priority.
    if (temporalityPreference != null) {
        if (temporalityPreference === AggregationTemporalityPreference.DELTA) {
            return DeltaTemporalitySelector;
        }
        else if (temporalityPreference === AggregationTemporalityPreference.LOWMEMORY) {
            return LowMemoryTemporalitySelector;
        }
        return CumulativeTemporalitySelector;
    }
    return chooseTemporalitySelectorFromEnvironment();
}
function chooseAggregationSelector(config) {
    if (config === null || config === void 0 ? void 0 : config.aggregationPreference) {
        return config.aggregationPreference;
    }
    else {
        return function (_instrumentType) { return Aggregation.Default(); };
    }
}
var OTLPMetricExporterBase = /** @class */ (function (_super) {
    __extends(OTLPMetricExporterBase, _super);
    function OTLPMetricExporterBase(delegate, config) {
        var _this = _super.call(this, delegate) || this;
        _this._aggregationSelector = chooseAggregationSelector(config);
        _this._aggregationTemporalitySelector = chooseTemporalitySelector(config === null || config === void 0 ? void 0 : config.temporalityPreference);
        return _this;
    }
    OTLPMetricExporterBase.prototype.selectAggregation = function (instrumentType) {
        return this._aggregationSelector(instrumentType);
    };
    OTLPMetricExporterBase.prototype.selectAggregationTemporality = function (instrumentType) {
        return this._aggregationTemporalitySelector(instrumentType);
    };
    return OTLPMetricExporterBase;
}(OTLPExporterBase));
export { OTLPMetricExporterBase };
//# sourceMappingURL=OTLPMetricExporterBase.js.map