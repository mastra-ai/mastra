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
exports.OTLPMetricExporterBase = exports.LowMemoryTemporalitySelector = exports.DeltaTemporalitySelector = exports.CumulativeTemporalitySelector = void 0;
const core_1 = require("@opentelemetry/core");
const sdk_metrics_1 = require("@opentelemetry/sdk-metrics");
const OTLPMetricExporterOptions_1 = require("./OTLPMetricExporterOptions");
const otlp_exporter_base_1 = require("@opentelemetry/otlp-exporter-base");
const api_1 = require("@opentelemetry/api");
const CumulativeTemporalitySelector = () => sdk_metrics_1.AggregationTemporality.CUMULATIVE;
exports.CumulativeTemporalitySelector = CumulativeTemporalitySelector;
const DeltaTemporalitySelector = (instrumentType) => {
    switch (instrumentType) {
        case sdk_metrics_1.InstrumentType.COUNTER:
        case sdk_metrics_1.InstrumentType.OBSERVABLE_COUNTER:
        case sdk_metrics_1.InstrumentType.GAUGE:
        case sdk_metrics_1.InstrumentType.HISTOGRAM:
        case sdk_metrics_1.InstrumentType.OBSERVABLE_GAUGE:
            return sdk_metrics_1.AggregationTemporality.DELTA;
        case sdk_metrics_1.InstrumentType.UP_DOWN_COUNTER:
        case sdk_metrics_1.InstrumentType.OBSERVABLE_UP_DOWN_COUNTER:
            return sdk_metrics_1.AggregationTemporality.CUMULATIVE;
    }
};
exports.DeltaTemporalitySelector = DeltaTemporalitySelector;
const LowMemoryTemporalitySelector = (instrumentType) => {
    switch (instrumentType) {
        case sdk_metrics_1.InstrumentType.COUNTER:
        case sdk_metrics_1.InstrumentType.HISTOGRAM:
            return sdk_metrics_1.AggregationTemporality.DELTA;
        case sdk_metrics_1.InstrumentType.GAUGE:
        case sdk_metrics_1.InstrumentType.UP_DOWN_COUNTER:
        case sdk_metrics_1.InstrumentType.OBSERVABLE_UP_DOWN_COUNTER:
        case sdk_metrics_1.InstrumentType.OBSERVABLE_COUNTER:
        case sdk_metrics_1.InstrumentType.OBSERVABLE_GAUGE:
            return sdk_metrics_1.AggregationTemporality.CUMULATIVE;
    }
};
exports.LowMemoryTemporalitySelector = LowMemoryTemporalitySelector;
function chooseTemporalitySelectorFromEnvironment() {
    const env = (0, core_1.getEnv)();
    const configuredTemporality = env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE.trim().toLowerCase();
    if (configuredTemporality === 'cumulative') {
        return exports.CumulativeTemporalitySelector;
    }
    if (configuredTemporality === 'delta') {
        return exports.DeltaTemporalitySelector;
    }
    if (configuredTemporality === 'lowmemory') {
        return exports.LowMemoryTemporalitySelector;
    }
    api_1.diag.warn(`OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE is set to '${env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE}', but only 'cumulative' and 'delta' are allowed. Using default ('cumulative') instead.`);
    return exports.CumulativeTemporalitySelector;
}
function chooseTemporalitySelector(temporalityPreference) {
    // Directly passed preference has priority.
    if (temporalityPreference != null) {
        if (temporalityPreference === OTLPMetricExporterOptions_1.AggregationTemporalityPreference.DELTA) {
            return exports.DeltaTemporalitySelector;
        }
        else if (temporalityPreference === OTLPMetricExporterOptions_1.AggregationTemporalityPreference.LOWMEMORY) {
            return exports.LowMemoryTemporalitySelector;
        }
        return exports.CumulativeTemporalitySelector;
    }
    return chooseTemporalitySelectorFromEnvironment();
}
function chooseAggregationSelector(config) {
    if (config === null || config === void 0 ? void 0 : config.aggregationPreference) {
        return config.aggregationPreference;
    }
    else {
        return (_instrumentType) => sdk_metrics_1.Aggregation.Default();
    }
}
class OTLPMetricExporterBase extends otlp_exporter_base_1.OTLPExporterBase {
    constructor(delegate, config) {
        super(delegate);
        this._aggregationSelector = chooseAggregationSelector(config);
        this._aggregationTemporalitySelector = chooseTemporalitySelector(config === null || config === void 0 ? void 0 : config.temporalityPreference);
    }
    selectAggregation(instrumentType) {
        return this._aggregationSelector(instrumentType);
    }
    selectAggregationTemporality(instrumentType) {
        return this._aggregationTemporalitySelector(instrumentType);
    }
}
exports.OTLPMetricExporterBase = OTLPMetricExporterBase;
//# sourceMappingURL=OTLPMetricExporterBase.js.map