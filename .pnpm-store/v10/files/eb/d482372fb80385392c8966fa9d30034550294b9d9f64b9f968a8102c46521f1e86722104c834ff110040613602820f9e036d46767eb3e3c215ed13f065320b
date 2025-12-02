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
exports.getSpanProcessorsFromEnv = exports.getOtlpProtocolFromEnv = exports.filterBlanksAndNulls = exports.getResourceDetectorsFromEnv = void 0;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const exporter_trace_otlp_proto_1 = require("@opentelemetry/exporter-trace-otlp-proto");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const exporter_trace_otlp_grpc_1 = require("@opentelemetry/exporter-trace-otlp-grpc");
const exporter_zipkin_1 = require("@opentelemetry/exporter-zipkin");
const resources_1 = require("@opentelemetry/resources");
const sdk_trace_base_1 = require("@opentelemetry/sdk-trace-base");
const RESOURCE_DETECTOR_ENVIRONMENT = 'env';
const RESOURCE_DETECTOR_HOST = 'host';
const RESOURCE_DETECTOR_OS = 'os';
const RESOURCE_DETECTOR_PROCESS = 'process';
const RESOURCE_DETECTOR_SERVICE_INSTANCE_ID = 'serviceinstance';
function getResourceDetectorsFromEnv() {
    var _a, _b;
    // When updating this list, make sure to also update the section `resourceDetectors` on README.
    const resourceDetectors = new Map([
        [RESOURCE_DETECTOR_ENVIRONMENT, resources_1.envDetectorSync],
        [RESOURCE_DETECTOR_HOST, resources_1.hostDetectorSync],
        [RESOURCE_DETECTOR_OS, resources_1.osDetectorSync],
        [RESOURCE_DETECTOR_SERVICE_INSTANCE_ID, resources_1.serviceInstanceIdDetectorSync],
        [RESOURCE_DETECTOR_PROCESS, resources_1.processDetectorSync],
    ]);
    const resourceDetectorsFromEnv = (_b = (_a = process.env.OTEL_NODE_RESOURCE_DETECTORS) === null || _a === void 0 ? void 0 : _a.split(',')) !== null && _b !== void 0 ? _b : ['all'];
    if (resourceDetectorsFromEnv.includes('all')) {
        return [...resourceDetectors.values()].flat();
    }
    if (resourceDetectorsFromEnv.includes('none')) {
        return [];
    }
    return resourceDetectorsFromEnv.flatMap(detector => {
        const resourceDetector = resourceDetectors.get(detector);
        if (!resourceDetector) {
            api_1.diag.warn(`Invalid resource detector "${detector}" specified in the environment variable OTEL_NODE_RESOURCE_DETECTORS`);
        }
        return resourceDetector || [];
    });
}
exports.getResourceDetectorsFromEnv = getResourceDetectorsFromEnv;
function filterBlanksAndNulls(list) {
    return list.map(item => item.trim()).filter(s => s !== 'null' && s !== '');
}
exports.filterBlanksAndNulls = filterBlanksAndNulls;
function getOtlpProtocolFromEnv() {
    var _a, _b, _c;
    const parsedEnvValues = (0, core_1.getEnvWithoutDefaults)();
    return ((_c = (_b = (_a = parsedEnvValues.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL) !== null && _a !== void 0 ? _a : parsedEnvValues.OTEL_EXPORTER_OTLP_PROTOCOL) !== null && _b !== void 0 ? _b : (0, core_1.getEnv)().OTEL_EXPORTER_OTLP_TRACES_PROTOCOL) !== null && _c !== void 0 ? _c : (0, core_1.getEnv)().OTEL_EXPORTER_OTLP_PROTOCOL);
}
exports.getOtlpProtocolFromEnv = getOtlpProtocolFromEnv;
function getOtlpExporterFromEnv() {
    const protocol = getOtlpProtocolFromEnv();
    switch (protocol) {
        case 'grpc':
            return new exporter_trace_otlp_grpc_1.OTLPTraceExporter();
        case 'http/json':
            return new exporter_trace_otlp_http_1.OTLPTraceExporter();
        case 'http/protobuf':
            return new exporter_trace_otlp_proto_1.OTLPTraceExporter();
        default:
            api_1.diag.warn(`Unsupported OTLP traces protocol: ${protocol}. Using http/protobuf.`);
            return new exporter_trace_otlp_proto_1.OTLPTraceExporter();
    }
}
function getJaegerExporter() {
    // The JaegerExporter does not support being required in bundled
    // environments. By delaying the require statement to here, we only crash when
    // the exporter is actually used in such an environment.
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
        return new JaegerExporter();
    }
    catch (e) {
        throw new Error(`Could not instantiate JaegerExporter. This could be due to the JaegerExporter's lack of support for bundling. If possible, use @opentelemetry/exporter-trace-otlp-proto instead. Original Error: ${e}`);
    }
}
function getSpanProcessorsFromEnv() {
    var _a;
    const exportersMap = new Map([
        ['otlp', () => getOtlpExporterFromEnv()],
        ['zipkin', () => new exporter_zipkin_1.ZipkinExporter()],
        ['console', () => new sdk_trace_base_1.ConsoleSpanExporter()],
        ['jaeger', () => getJaegerExporter()],
    ]);
    const exporters = [];
    const processors = [];
    let traceExportersList = filterBlanksAndNulls(Array.from(new Set((0, core_1.getEnv)().OTEL_TRACES_EXPORTER.split(','))));
    if (traceExportersList[0] === 'none') {
        api_1.diag.warn('OTEL_TRACES_EXPORTER contains "none". SDK will not be initialized.');
        return [];
    }
    if (traceExportersList.length === 0) {
        api_1.diag.warn('OTEL_TRACES_EXPORTER is empty. Using default otlp exporter.');
        traceExportersList = ['otlp'];
    }
    else if (traceExportersList.length > 1 &&
        traceExportersList.includes('none')) {
        api_1.diag.warn('OTEL_TRACES_EXPORTER contains "none" along with other exporters. Using default otlp exporter.');
        traceExportersList = ['otlp'];
    }
    for (const name of traceExportersList) {
        const exporter = (_a = exportersMap.get(name)) === null || _a === void 0 ? void 0 : _a();
        if (exporter) {
            exporters.push(exporter);
        }
        else {
            api_1.diag.warn(`Unrecognized OTEL_TRACES_EXPORTER value: ${name}.`);
        }
    }
    for (const exp of exporters) {
        if (exp instanceof sdk_trace_base_1.ConsoleSpanExporter) {
            processors.push(new sdk_trace_base_1.SimpleSpanProcessor(exp));
        }
        else {
            processors.push(new sdk_trace_base_1.BatchSpanProcessor(exp));
        }
    }
    if (exporters.length === 0) {
        api_1.diag.warn('Unable to set up trace exporter(s) due to invalid exporter and/or protocol values.');
    }
    return processors;
}
exports.getSpanProcessorsFromEnv = getSpanProcessorsFromEnv;
//# sourceMappingURL=utils.js.map