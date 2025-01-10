module.exports = {

"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.DEFAULT_MAX_RECEIVE_MESSAGE_LENGTH = exports.DEFAULT_MAX_SEND_MESSAGE_LENGTH = exports.Propagate = exports.LogVerbosity = exports.Status = void 0;
var Status;
(function(Status) {
    Status[Status["OK"] = 0] = "OK";
    Status[Status["CANCELLED"] = 1] = "CANCELLED";
    Status[Status["UNKNOWN"] = 2] = "UNKNOWN";
    Status[Status["INVALID_ARGUMENT"] = 3] = "INVALID_ARGUMENT";
    Status[Status["DEADLINE_EXCEEDED"] = 4] = "DEADLINE_EXCEEDED";
    Status[Status["NOT_FOUND"] = 5] = "NOT_FOUND";
    Status[Status["ALREADY_EXISTS"] = 6] = "ALREADY_EXISTS";
    Status[Status["PERMISSION_DENIED"] = 7] = "PERMISSION_DENIED";
    Status[Status["RESOURCE_EXHAUSTED"] = 8] = "RESOURCE_EXHAUSTED";
    Status[Status["FAILED_PRECONDITION"] = 9] = "FAILED_PRECONDITION";
    Status[Status["ABORTED"] = 10] = "ABORTED";
    Status[Status["OUT_OF_RANGE"] = 11] = "OUT_OF_RANGE";
    Status[Status["UNIMPLEMENTED"] = 12] = "UNIMPLEMENTED";
    Status[Status["INTERNAL"] = 13] = "INTERNAL";
    Status[Status["UNAVAILABLE"] = 14] = "UNAVAILABLE";
    Status[Status["DATA_LOSS"] = 15] = "DATA_LOSS";
    Status[Status["UNAUTHENTICATED"] = 16] = "UNAUTHENTICATED";
})(Status || (exports.Status = Status = {}));
var LogVerbosity;
(function(LogVerbosity) {
    LogVerbosity[LogVerbosity["DEBUG"] = 0] = "DEBUG";
    LogVerbosity[LogVerbosity["INFO"] = 1] = "INFO";
    LogVerbosity[LogVerbosity["ERROR"] = 2] = "ERROR";
    LogVerbosity[LogVerbosity["NONE"] = 3] = "NONE";
})(LogVerbosity || (exports.LogVerbosity = LogVerbosity = {}));
/**
 * NOTE: This enum is not currently used in any implemented API in this
 * library. It is included only for type parity with the other implementation.
 */ var Propagate;
(function(Propagate) {
    Propagate[Propagate["DEADLINE"] = 1] = "DEADLINE";
    Propagate[Propagate["CENSUS_STATS_CONTEXT"] = 2] = "CENSUS_STATS_CONTEXT";
    Propagate[Propagate["CENSUS_TRACING_CONTEXT"] = 4] = "CENSUS_TRACING_CONTEXT";
    Propagate[Propagate["CANCELLATION"] = 8] = "CANCELLATION";
    // https://github.com/grpc/grpc/blob/master/include/grpc/impl/codegen/propagation_bits.h#L43
    Propagate[Propagate["DEFAULTS"] = 65535] = "DEFAULTS";
})(Propagate || (exports.Propagate = Propagate = {}));
// -1 means unlimited
exports.DEFAULT_MAX_SEND_MESSAGE_LENGTH = -1;
// 4 MB default
exports.DEFAULT_MAX_RECEIVE_MESSAGE_LENGTH = 4 * 1024 * 1024; //# sourceMappingURL=constants.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/package.json (json)": ((__turbopack_context__) => {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, t: require } = __turbopack_context__;
{
__turbopack_export_value__(JSON.parse("{\"name\":\"@grpc/grpc-js\",\"version\":\"1.12.4\",\"description\":\"gRPC Library for Node - pure JS implementation\",\"homepage\":\"https://grpc.io/\",\"repository\":\"https://github.com/grpc/grpc-node/tree/master/packages/grpc-js\",\"main\":\"build/src/index.js\",\"engines\":{\"node\":\">=12.10.0\"},\"keywords\":[],\"author\":{\"name\":\"Google Inc.\"},\"types\":\"build/src/index.d.ts\",\"license\":\"Apache-2.0\",\"devDependencies\":{\"@grpc/proto-loader\":\"file:../proto-loader\",\"@types/gulp\":\"^4.0.17\",\"@types/gulp-mocha\":\"0.0.37\",\"@types/lodash\":\"^4.14.202\",\"@types/mocha\":\"^10.0.6\",\"@types/ncp\":\"^2.0.8\",\"@types/node\":\">=20.11.20\",\"@types/pify\":\"^5.0.4\",\"@types/semver\":\"^7.5.8\",\"@typescript-eslint/eslint-plugin\":\"^7.1.0\",\"@typescript-eslint/parser\":\"^7.1.0\",\"@typescript-eslint/typescript-estree\":\"^7.1.0\",\"clang-format\":\"^1.8.0\",\"eslint\":\"^8.42.0\",\"eslint-config-prettier\":\"^8.8.0\",\"eslint-plugin-node\":\"^11.1.0\",\"eslint-plugin-prettier\":\"^4.2.1\",\"execa\":\"^2.0.3\",\"gulp\":\"^4.0.2\",\"gulp-mocha\":\"^6.0.0\",\"lodash\":\"^4.17.21\",\"madge\":\"^5.0.1\",\"mocha-jenkins-reporter\":\"^0.4.1\",\"ncp\":\"^2.0.0\",\"pify\":\"^4.0.1\",\"prettier\":\"^2.8.8\",\"rimraf\":\"^3.0.2\",\"semver\":\"^7.6.0\",\"ts-node\":\"^10.9.2\",\"typescript\":\"^5.3.3\"},\"contributors\":[{\"name\":\"Google Inc.\"}],\"scripts\":{\"build\":\"npm run compile\",\"clean\":\"rimraf ./build\",\"compile\":\"tsc -p .\",\"format\":\"clang-format -i -style=\\\"{Language: JavaScript, BasedOnStyle: Google, ColumnLimit: 80}\\\" src/*.ts test/*.ts\",\"lint\":\"eslint src/*.ts test/*.ts\",\"prepare\":\"npm run generate-types && npm run compile\",\"test\":\"gulp test\",\"check\":\"npm run lint\",\"fix\":\"eslint --fix src/*.ts test/*.ts\",\"pretest\":\"npm run generate-types && npm run generate-test-types && npm run compile\",\"posttest\":\"npm run check && madge -c ./build/src\",\"generate-types\":\"proto-loader-gen-types --keepCase --longs String --enums String --defaults --oneofs --includeComments --includeDirs proto/ --include-dirs test/fixtures/ -O src/generated/ --grpcLib ../index channelz.proto\",\"generate-test-types\":\"proto-loader-gen-types --keepCase --longs String --enums String --defaults --oneofs --includeComments --include-dirs test/fixtures/ -O test/generated/ --grpcLib ../../src/index test_service.proto\"},\"dependencies\":{\"@grpc/proto-loader\":\"^0.7.13\",\"@js-sdsl/ordered-map\":\"^4.4.2\"},\"files\":[\"src/**/*.ts\",\"build/src/**/*.{js,d.ts,js.map}\",\"proto/*.proto\",\"LICENSE\",\"deps/envoy-api/envoy/api/v2/**/*.proto\",\"deps/envoy-api/envoy/config/**/*.proto\",\"deps/envoy-api/envoy/service/**/*.proto\",\"deps/envoy-api/envoy/type/**/*.proto\",\"deps/udpa/udpa/**/*.proto\",\"deps/googleapis/google/api/*.proto\",\"deps/googleapis/google/rpc/*.proto\",\"deps/protoc-gen-validate/validate/**/*.proto\"]}"));}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.isTracerEnabled = exports.trace = exports.log = exports.setLoggerVerbosity = exports.setLogger = exports.getLogger = void 0;
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const process_1 = __turbopack_require__("[externals]/ [external] (process, cjs)");
const clientVersion = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/package.json (json)").version;
const DEFAULT_LOGGER = {
    error: (message, ...optionalParams)=>{
        console.error('E ' + message, ...optionalParams);
    },
    info: (message, ...optionalParams)=>{
        console.error('I ' + message, ...optionalParams);
    },
    debug: (message, ...optionalParams)=>{
        console.error('D ' + message, ...optionalParams);
    }
};
let _logger = DEFAULT_LOGGER;
let _logVerbosity = constants_1.LogVerbosity.ERROR;
const verbosityString = (_b = (_a = process.env.GRPC_NODE_VERBOSITY) !== null && _a !== void 0 ? _a : process.env.GRPC_VERBOSITY) !== null && _b !== void 0 ? _b : '';
switch(verbosityString.toUpperCase()){
    case 'DEBUG':
        _logVerbosity = constants_1.LogVerbosity.DEBUG;
        break;
    case 'INFO':
        _logVerbosity = constants_1.LogVerbosity.INFO;
        break;
    case 'ERROR':
        _logVerbosity = constants_1.LogVerbosity.ERROR;
        break;
    case 'NONE':
        _logVerbosity = constants_1.LogVerbosity.NONE;
        break;
    default:
}
const getLogger = ()=>{
    return _logger;
};
exports.getLogger = getLogger;
const setLogger = (logger)=>{
    _logger = logger;
};
exports.setLogger = setLogger;
const setLoggerVerbosity = (verbosity)=>{
    _logVerbosity = verbosity;
};
exports.setLoggerVerbosity = setLoggerVerbosity;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (severity, ...args)=>{
    let logFunction;
    if (severity >= _logVerbosity) {
        switch(severity){
            case constants_1.LogVerbosity.DEBUG:
                logFunction = _logger.debug;
                break;
            case constants_1.LogVerbosity.INFO:
                logFunction = _logger.info;
                break;
            case constants_1.LogVerbosity.ERROR:
                logFunction = _logger.error;
                break;
        }
        /* Fall back to _logger.error when other methods are not available for
         * compatiblity with older behavior that always logged to _logger.error */ if (!logFunction) {
            logFunction = _logger.error;
        }
        if (logFunction) {
            logFunction.bind(_logger)(...args);
        }
    }
};
exports.log = log;
const tracersString = (_d = (_c = process.env.GRPC_NODE_TRACE) !== null && _c !== void 0 ? _c : process.env.GRPC_TRACE) !== null && _d !== void 0 ? _d : '';
const enabledTracers = new Set();
const disabledTracers = new Set();
for (const tracerName of tracersString.split(',')){
    if (tracerName.startsWith('-')) {
        disabledTracers.add(tracerName.substring(1));
    } else {
        enabledTracers.add(tracerName);
    }
}
const allEnabled = enabledTracers.has('all');
function trace(severity, tracer, text) {
    if (isTracerEnabled(tracer)) {
        (0, exports.log)(severity, new Date().toISOString() + ' | v' + clientVersion + ' ' + process_1.pid + ' | ' + tracer + ' | ' + text);
    }
}
exports.trace = trace;
function isTracerEnabled(tracer) {
    return !disabledTracers.has(tracer) && (allEnabled || enabledTracers.has(tracer));
}
exports.isTracerEnabled = isTracerEnabled; //# sourceMappingURL=logging.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/error.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getErrorCode = exports.getErrorMessage = void 0;
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    } else {
        return String(error);
    }
}
exports.getErrorMessage = getErrorMessage;
function getErrorCode(error) {
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number') {
        return error.code;
    } else {
        return null;
    }
}
exports.getErrorCode = getErrorCode; //# sourceMappingURL=error.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Metadata = void 0;
const logging_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const error_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/error.js [app-rsc] (ecmascript)");
const LEGAL_KEY_REGEX = /^[0-9a-z_.-]+$/;
const LEGAL_NON_BINARY_VALUE_REGEX = /^[ -~]*$/;
function isLegalKey(key) {
    return LEGAL_KEY_REGEX.test(key);
}
function isLegalNonBinaryValue(value) {
    return LEGAL_NON_BINARY_VALUE_REGEX.test(value);
}
function isBinaryKey(key) {
    return key.endsWith('-bin');
}
function isCustomMetadata(key) {
    return !key.startsWith('grpc-');
}
function normalizeKey(key) {
    return key.toLowerCase();
}
function validate(key, value) {
    if (!isLegalKey(key)) {
        throw new Error('Metadata key "' + key + '" contains illegal characters');
    }
    if (value !== null && value !== undefined) {
        if (isBinaryKey(key)) {
            if (!Buffer.isBuffer(value)) {
                throw new Error("keys that end with '-bin' must have Buffer values");
            }
        } else {
            if (Buffer.isBuffer(value)) {
                throw new Error("keys that don't end with '-bin' must have String values");
            }
            if (!isLegalNonBinaryValue(value)) {
                throw new Error('Metadata string value "' + value + '" contains illegal characters');
            }
        }
    }
}
/**
 * A class for storing metadata. Keys are normalized to lowercase ASCII.
 */ class Metadata {
    constructor(options = {}){
        this.internalRepr = new Map();
        this.options = options;
    }
    /**
     * Sets the given value for the given key by replacing any other values
     * associated with that key. Normalizes the key.
     * @param key The key to whose value should be set.
     * @param value The value to set. Must be a buffer if and only
     *   if the normalized key ends with '-bin'.
     */ set(key, value) {
        key = normalizeKey(key);
        validate(key, value);
        this.internalRepr.set(key, [
            value
        ]);
    }
    /**
     * Adds the given value for the given key by appending to a list of previous
     * values associated with that key. Normalizes the key.
     * @param key The key for which a new value should be appended.
     * @param value The value to add. Must be a buffer if and only
     *   if the normalized key ends with '-bin'.
     */ add(key, value) {
        key = normalizeKey(key);
        validate(key, value);
        const existingValue = this.internalRepr.get(key);
        if (existingValue === undefined) {
            this.internalRepr.set(key, [
                value
            ]);
        } else {
            existingValue.push(value);
        }
    }
    /**
     * Removes the given key and any associated values. Normalizes the key.
     * @param key The key whose values should be removed.
     */ remove(key) {
        key = normalizeKey(key);
        // validate(key);
        this.internalRepr.delete(key);
    }
    /**
     * Gets a list of all values associated with the key. Normalizes the key.
     * @param key The key whose value should be retrieved.
     * @return A list of values associated with the given key.
     */ get(key) {
        key = normalizeKey(key);
        // validate(key);
        return this.internalRepr.get(key) || [];
    }
    /**
     * Gets a plain object mapping each key to the first value associated with it.
     * This reflects the most common way that people will want to see metadata.
     * @return A key/value mapping of the metadata.
     */ getMap() {
        const result = {};
        for (const [key, values] of this.internalRepr){
            if (values.length > 0) {
                const v = values[0];
                result[key] = Buffer.isBuffer(v) ? Buffer.from(v) : v;
            }
        }
        return result;
    }
    /**
     * Clones the metadata object.
     * @return The newly cloned object.
     */ clone() {
        const newMetadata = new Metadata(this.options);
        const newInternalRepr = newMetadata.internalRepr;
        for (const [key, value] of this.internalRepr){
            const clonedValue = value.map((v)=>{
                if (Buffer.isBuffer(v)) {
                    return Buffer.from(v);
                } else {
                    return v;
                }
            });
            newInternalRepr.set(key, clonedValue);
        }
        return newMetadata;
    }
    /**
     * Merges all key-value pairs from a given Metadata object into this one.
     * If both this object and the given object have values in the same key,
     * values from the other Metadata object will be appended to this object's
     * values.
     * @param other A Metadata object.
     */ merge(other) {
        for (const [key, values] of other.internalRepr){
            const mergedValue = (this.internalRepr.get(key) || []).concat(values);
            this.internalRepr.set(key, mergedValue);
        }
    }
    setOptions(options) {
        this.options = options;
    }
    getOptions() {
        return this.options;
    }
    /**
     * Creates an OutgoingHttpHeaders object that can be used with the http2 API.
     */ toHttp2Headers() {
        // NOTE: Node <8.9 formats http2 headers incorrectly.
        const result = {};
        for (const [key, values] of this.internalRepr){
            // We assume that the user's interaction with this object is limited to
            // through its public API (i.e. keys and values are already validated).
            result[key] = values.map(bufToString);
        }
        return result;
    }
    /**
     * This modifies the behavior of JSON.stringify to show an object
     * representation of the metadata map.
     */ toJSON() {
        const result = {};
        for (const [key, values] of this.internalRepr){
            result[key] = values;
        }
        return result;
    }
    /**
     * Returns a new Metadata object based fields in a given IncomingHttpHeaders
     * object.
     * @param headers An IncomingHttpHeaders object.
     */ static fromHttp2Headers(headers) {
        const result = new Metadata();
        for (const key of Object.keys(headers)){
            // Reserved headers (beginning with `:`) are not valid keys.
            if (key.charAt(0) === ':') {
                continue;
            }
            const values = headers[key];
            try {
                if (isBinaryKey(key)) {
                    if (Array.isArray(values)) {
                        values.forEach((value)=>{
                            result.add(key, Buffer.from(value, 'base64'));
                        });
                    } else if (values !== undefined) {
                        if (isCustomMetadata(key)) {
                            values.split(',').forEach((v)=>{
                                result.add(key, Buffer.from(v.trim(), 'base64'));
                            });
                        } else {
                            result.add(key, Buffer.from(values, 'base64'));
                        }
                    }
                } else {
                    if (Array.isArray(values)) {
                        values.forEach((value)=>{
                            result.add(key, value);
                        });
                    } else if (values !== undefined) {
                        result.add(key, values);
                    }
                }
            } catch (error) {
                const message = `Failed to add metadata entry ${key}: ${values}. ${(0, error_1.getErrorMessage)(error)}. For more information see https://github.com/grpc/grpc-node/issues/1173`;
                (0, logging_1.log)(constants_1.LogVerbosity.ERROR, message);
            }
        }
        return result;
    }
}
exports.Metadata = Metadata;
const bufToString = (val)=>{
    return Buffer.isBuffer(val) ? val.toString('base64') : val;
}; //# sourceMappingURL=metadata.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/call-credentials.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.CallCredentials = void 0;
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
function isCurrentOauth2Client(client) {
    return 'getRequestHeaders' in client && typeof client.getRequestHeaders === 'function';
}
/**
 * A class that represents a generic method of adding authentication-related
 * metadata on a per-request basis.
 */ class CallCredentials {
    /**
     * Creates a new CallCredentials object from a given function that generates
     * Metadata objects.
     * @param metadataGenerator A function that accepts a set of options, and
     * generates a Metadata object based on these options, which is passed back
     * to the caller via a supplied (err, metadata) callback.
     */ static createFromMetadataGenerator(metadataGenerator) {
        return new SingleCallCredentials(metadataGenerator);
    }
    /**
     * Create a gRPC credential from a Google credential object.
     * @param googleCredentials The authentication client to use.
     * @return The resulting CallCredentials object.
     */ static createFromGoogleCredential(googleCredentials) {
        return CallCredentials.createFromMetadataGenerator((options, callback)=>{
            let getHeaders;
            if (isCurrentOauth2Client(googleCredentials)) {
                getHeaders = googleCredentials.getRequestHeaders(options.service_url);
            } else {
                getHeaders = new Promise((resolve, reject)=>{
                    googleCredentials.getRequestMetadata(options.service_url, (err, headers)=>{
                        if (err) {
                            reject(err);
                            return;
                        }
                        if (!headers) {
                            reject(new Error('Headers not set by metadata plugin'));
                            return;
                        }
                        resolve(headers);
                    });
                });
            }
            getHeaders.then((headers)=>{
                const metadata = new metadata_1.Metadata();
                for (const key of Object.keys(headers)){
                    metadata.add(key, headers[key]);
                }
                callback(null, metadata);
            }, (err)=>{
                callback(err);
            });
        });
    }
    static createEmpty() {
        return new EmptyCallCredentials();
    }
}
exports.CallCredentials = CallCredentials;
class ComposedCallCredentials extends CallCredentials {
    constructor(creds){
        super();
        this.creds = creds;
    }
    async generateMetadata(options) {
        const base = new metadata_1.Metadata();
        const generated = await Promise.all(this.creds.map((cred)=>cred.generateMetadata(options)));
        for (const gen of generated){
            base.merge(gen);
        }
        return base;
    }
    compose(other) {
        return new ComposedCallCredentials(this.creds.concat([
            other
        ]));
    }
    _equals(other) {
        if (this === other) {
            return true;
        }
        if (other instanceof ComposedCallCredentials) {
            return this.creds.every((value, index)=>value._equals(other.creds[index]));
        } else {
            return false;
        }
    }
}
class SingleCallCredentials extends CallCredentials {
    constructor(metadataGenerator){
        super();
        this.metadataGenerator = metadataGenerator;
    }
    generateMetadata(options) {
        return new Promise((resolve, reject)=>{
            this.metadataGenerator(options, (err, metadata)=>{
                if (metadata !== undefined) {
                    resolve(metadata);
                } else {
                    reject(err);
                }
            });
        });
    }
    compose(other) {
        return new ComposedCallCredentials([
            this,
            other
        ]);
    }
    _equals(other) {
        if (this === other) {
            return true;
        }
        if (other instanceof SingleCallCredentials) {
            return this.metadataGenerator === other.metadataGenerator;
        } else {
            return false;
        }
    }
}
class EmptyCallCredentials extends CallCredentials {
    generateMetadata(options) {
        return Promise.resolve(new metadata_1.Metadata());
    }
    compose(other) {
        return other;
    }
    _equals(other) {
        return other instanceof EmptyCallCredentials;
    }
} //# sourceMappingURL=call-credentials.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/tls-helpers.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getDefaultRootsData = exports.CIPHER_SUITES = void 0;
const fs = __turbopack_require__("[externals]/ [external] (fs, cjs)");
exports.CIPHER_SUITES = process.env.GRPC_SSL_CIPHER_SUITES;
const DEFAULT_ROOTS_FILE_PATH = process.env.GRPC_DEFAULT_SSL_ROOTS_FILE_PATH;
let defaultRootsData = null;
function getDefaultRootsData() {
    if (DEFAULT_ROOTS_FILE_PATH) {
        if (defaultRootsData === null) {
            defaultRootsData = fs.readFileSync(DEFAULT_ROOTS_FILE_PATH);
        }
        return defaultRootsData;
    }
    return null;
}
exports.getDefaultRootsData = getDefaultRootsData; //# sourceMappingURL=tls-helpers.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channel-credentials.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.createCertificateProviderChannelCredentials = exports.ChannelCredentials = void 0;
const tls_1 = __turbopack_require__("[externals]/ [external] (tls, cjs)");
const call_credentials_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/call-credentials.js [app-rsc] (ecmascript)");
const tls_helpers_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/tls-helpers.js [app-rsc] (ecmascript)");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function verifyIsBufferOrNull(obj, friendlyName) {
    if (obj && !(obj instanceof Buffer)) {
        throw new TypeError(`${friendlyName}, if provided, must be a Buffer.`);
    }
}
/**
 * A class that contains credentials for communicating over a channel, as well
 * as a set of per-call credentials, which are applied to every method call made
 * over a channel initialized with an instance of this class.
 */ class ChannelCredentials {
    constructor(callCredentials){
        this.callCredentials = callCredentials || call_credentials_1.CallCredentials.createEmpty();
    }
    /**
     * Gets the set of per-call credentials associated with this instance.
     */ _getCallCredentials() {
        return this.callCredentials;
    }
    _ref() {
    // Do nothing by default
    }
    _unref() {
    // Do nothing by default
    }
    /**
     * Return a new ChannelCredentials instance with a given set of credentials.
     * The resulting instance can be used to construct a Channel that communicates
     * over TLS.
     * @param rootCerts The root certificate data.
     * @param privateKey The client certificate private key, if available.
     * @param certChain The client certificate key chain, if available.
     * @param verifyOptions Additional options to modify certificate verification
     */ static createSsl(rootCerts, privateKey, certChain, verifyOptions) {
        var _a;
        verifyIsBufferOrNull(rootCerts, 'Root certificate');
        verifyIsBufferOrNull(privateKey, 'Private key');
        verifyIsBufferOrNull(certChain, 'Certificate chain');
        if (privateKey && !certChain) {
            throw new Error('Private key must be given with accompanying certificate chain');
        }
        if (!privateKey && certChain) {
            throw new Error('Certificate chain must be given with accompanying private key');
        }
        const secureContext = (0, tls_1.createSecureContext)({
            ca: (_a = rootCerts !== null && rootCerts !== void 0 ? rootCerts : (0, tls_helpers_1.getDefaultRootsData)()) !== null && _a !== void 0 ? _a : undefined,
            key: privateKey !== null && privateKey !== void 0 ? privateKey : undefined,
            cert: certChain !== null && certChain !== void 0 ? certChain : undefined,
            ciphers: tls_helpers_1.CIPHER_SUITES
        });
        return new SecureChannelCredentialsImpl(secureContext, verifyOptions !== null && verifyOptions !== void 0 ? verifyOptions : {});
    }
    /**
     * Return a new ChannelCredentials instance with credentials created using
     * the provided secureContext. The resulting instances can be used to
     * construct a Channel that communicates over TLS. gRPC will not override
     * anything in the provided secureContext, so the environment variables
     * GRPC_SSL_CIPHER_SUITES and GRPC_DEFAULT_SSL_ROOTS_FILE_PATH will
     * not be applied.
     * @param secureContext The return value of tls.createSecureContext()
     * @param verifyOptions Additional options to modify certificate verification
     */ static createFromSecureContext(secureContext, verifyOptions) {
        return new SecureChannelCredentialsImpl(secureContext, verifyOptions !== null && verifyOptions !== void 0 ? verifyOptions : {});
    }
    /**
     * Return a new ChannelCredentials instance with no credentials.
     */ static createInsecure() {
        return new InsecureChannelCredentialsImpl();
    }
}
exports.ChannelCredentials = ChannelCredentials;
class InsecureChannelCredentialsImpl extends ChannelCredentials {
    constructor(){
        super();
    }
    compose(callCredentials) {
        throw new Error('Cannot compose insecure credentials');
    }
    _getConnectionOptions() {
        return {};
    }
    _isSecure() {
        return false;
    }
    _equals(other) {
        return other instanceof InsecureChannelCredentialsImpl;
    }
}
class SecureChannelCredentialsImpl extends ChannelCredentials {
    constructor(secureContext, verifyOptions){
        super();
        this.secureContext = secureContext;
        this.verifyOptions = verifyOptions;
        this.connectionOptions = {
            secureContext
        };
        // Node asserts that this option is a function, so we cannot pass undefined
        if (verifyOptions === null || verifyOptions === void 0 ? void 0 : verifyOptions.checkServerIdentity) {
            this.connectionOptions.checkServerIdentity = verifyOptions.checkServerIdentity;
        }
        if ((verifyOptions === null || verifyOptions === void 0 ? void 0 : verifyOptions.rejectUnauthorized) !== undefined) {
            this.connectionOptions.rejectUnauthorized = verifyOptions.rejectUnauthorized;
        }
    }
    compose(callCredentials) {
        const combinedCallCredentials = this.callCredentials.compose(callCredentials);
        return new ComposedChannelCredentialsImpl(this, combinedCallCredentials);
    }
    _getConnectionOptions() {
        // Copy to prevent callers from mutating this.connectionOptions
        return Object.assign({}, this.connectionOptions);
    }
    _isSecure() {
        return true;
    }
    _equals(other) {
        if (this === other) {
            return true;
        }
        if (other instanceof SecureChannelCredentialsImpl) {
            return this.secureContext === other.secureContext && this.verifyOptions.checkServerIdentity === other.verifyOptions.checkServerIdentity;
        } else {
            return false;
        }
    }
}
class CertificateProviderChannelCredentialsImpl extends ChannelCredentials {
    constructor(caCertificateProvider, identityCertificateProvider, verifyOptions){
        super();
        this.caCertificateProvider = caCertificateProvider;
        this.identityCertificateProvider = identityCertificateProvider;
        this.verifyOptions = verifyOptions;
        this.refcount = 0;
        this.latestCaUpdate = null;
        this.latestIdentityUpdate = null;
        this.caCertificateUpdateListener = this.handleCaCertificateUpdate.bind(this);
        this.identityCertificateUpdateListener = this.handleIdentityCertitificateUpdate.bind(this);
    }
    compose(callCredentials) {
        const combinedCallCredentials = this.callCredentials.compose(callCredentials);
        return new ComposedChannelCredentialsImpl(this, combinedCallCredentials);
    }
    _getConnectionOptions() {
        var _a, _b, _c;
        if (this.latestCaUpdate === null) {
            return null;
        }
        if (this.identityCertificateProvider !== null && this.latestIdentityUpdate === null) {
            return null;
        }
        const secureContext = (0, tls_1.createSecureContext)({
            ca: this.latestCaUpdate.caCertificate,
            key: (_a = this.latestIdentityUpdate) === null || _a === void 0 ? void 0 : _a.privateKey,
            cert: (_b = this.latestIdentityUpdate) === null || _b === void 0 ? void 0 : _b.certificate,
            ciphers: tls_helpers_1.CIPHER_SUITES
        });
        const options = {
            secureContext: secureContext
        };
        if ((_c = this.verifyOptions) === null || _c === void 0 ? void 0 : _c.checkServerIdentity) {
            options.checkServerIdentity = this.verifyOptions.checkServerIdentity;
        }
        return options;
    }
    _isSecure() {
        return true;
    }
    _equals(other) {
        var _a, _b;
        if (this === other) {
            return true;
        }
        if (other instanceof CertificateProviderChannelCredentialsImpl) {
            return this.caCertificateProvider === other.caCertificateProvider && this.identityCertificateProvider === other.identityCertificateProvider && ((_a = this.verifyOptions) === null || _a === void 0 ? void 0 : _a.checkServerIdentity) === ((_b = other.verifyOptions) === null || _b === void 0 ? void 0 : _b.checkServerIdentity);
        } else {
            return false;
        }
    }
    _ref() {
        var _a;
        if (this.refcount === 0) {
            this.caCertificateProvider.addCaCertificateListener(this.caCertificateUpdateListener);
            (_a = this.identityCertificateProvider) === null || _a === void 0 ? void 0 : _a.addIdentityCertificateListener(this.identityCertificateUpdateListener);
        }
        this.refcount += 1;
    }
    _unref() {
        var _a;
        this.refcount -= 1;
        if (this.refcount === 0) {
            this.caCertificateProvider.removeCaCertificateListener(this.caCertificateUpdateListener);
            (_a = this.identityCertificateProvider) === null || _a === void 0 ? void 0 : _a.removeIdentityCertificateListener(this.identityCertificateUpdateListener);
        }
    }
    handleCaCertificateUpdate(update) {
        this.latestCaUpdate = update;
    }
    handleIdentityCertitificateUpdate(update) {
        this.latestIdentityUpdate = update;
    }
}
function createCertificateProviderChannelCredentials(caCertificateProvider, identityCertificateProvider, verifyOptions) {
    return new CertificateProviderChannelCredentialsImpl(caCertificateProvider, identityCertificateProvider, verifyOptions !== null && verifyOptions !== void 0 ? verifyOptions : null);
}
exports.createCertificateProviderChannelCredentials = createCertificateProviderChannelCredentials;
class ComposedChannelCredentialsImpl extends ChannelCredentials {
    constructor(channelCredentials, callCreds){
        super(callCreds);
        this.channelCredentials = channelCredentials;
        if (!channelCredentials._isSecure()) {
            throw new Error('Cannot compose insecure credentials');
        }
    }
    compose(callCredentials) {
        const combinedCallCredentials = this.callCredentials.compose(callCredentials);
        return new ComposedChannelCredentialsImpl(this.channelCredentials, combinedCallCredentials);
    }
    _getConnectionOptions() {
        return this.channelCredentials._getConnectionOptions();
    }
    _isSecure() {
        return true;
    }
    _equals(other) {
        if (this === other) {
            return true;
        }
        if (other instanceof ComposedChannelCredentialsImpl) {
            return this.channelCredentials._equals(other.channelCredentials) && this.callCredentials._equals(other.callCredentials);
        } else {
            return false;
        }
    }
} //# sourceMappingURL=channel-credentials.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.selectLbConfigFromList = exports.getDefaultConfig = exports.parseLoadBalancingConfig = exports.isLoadBalancerNameRegistered = exports.createLoadBalancer = exports.registerDefaultLoadBalancerType = exports.registerLoadBalancerType = exports.createChildChannelControlHelper = void 0;
const logging_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
/**
 * Create a child ChannelControlHelper that overrides some methods of the
 * parent while letting others pass through to the parent unmodified. This
 * allows other code to create these children without needing to know about
 * all of the methods to be passed through.
 * @param parent
 * @param overrides
 */ function createChildChannelControlHelper(parent, overrides) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    return {
        createSubchannel: (_b = (_a = overrides.createSubchannel) === null || _a === void 0 ? void 0 : _a.bind(overrides)) !== null && _b !== void 0 ? _b : parent.createSubchannel.bind(parent),
        updateState: (_d = (_c = overrides.updateState) === null || _c === void 0 ? void 0 : _c.bind(overrides)) !== null && _d !== void 0 ? _d : parent.updateState.bind(parent),
        requestReresolution: (_f = (_e = overrides.requestReresolution) === null || _e === void 0 ? void 0 : _e.bind(overrides)) !== null && _f !== void 0 ? _f : parent.requestReresolution.bind(parent),
        addChannelzChild: (_h = (_g = overrides.addChannelzChild) === null || _g === void 0 ? void 0 : _g.bind(overrides)) !== null && _h !== void 0 ? _h : parent.addChannelzChild.bind(parent),
        removeChannelzChild: (_k = (_j = overrides.removeChannelzChild) === null || _j === void 0 ? void 0 : _j.bind(overrides)) !== null && _k !== void 0 ? _k : parent.removeChannelzChild.bind(parent)
    };
}
exports.createChildChannelControlHelper = createChildChannelControlHelper;
const registeredLoadBalancerTypes = {};
let defaultLoadBalancerType = null;
function registerLoadBalancerType(typeName, loadBalancerType, loadBalancingConfigType) {
    registeredLoadBalancerTypes[typeName] = {
        LoadBalancer: loadBalancerType,
        LoadBalancingConfig: loadBalancingConfigType
    };
}
exports.registerLoadBalancerType = registerLoadBalancerType;
function registerDefaultLoadBalancerType(typeName) {
    defaultLoadBalancerType = typeName;
}
exports.registerDefaultLoadBalancerType = registerDefaultLoadBalancerType;
function createLoadBalancer(config, channelControlHelper, credentials, options) {
    const typeName = config.getLoadBalancerName();
    if (typeName in registeredLoadBalancerTypes) {
        return new registeredLoadBalancerTypes[typeName].LoadBalancer(channelControlHelper, credentials, options);
    } else {
        return null;
    }
}
exports.createLoadBalancer = createLoadBalancer;
function isLoadBalancerNameRegistered(typeName) {
    return typeName in registeredLoadBalancerTypes;
}
exports.isLoadBalancerNameRegistered = isLoadBalancerNameRegistered;
function parseLoadBalancingConfig(rawConfig) {
    const keys = Object.keys(rawConfig);
    if (keys.length !== 1) {
        throw new Error('Provided load balancing config has multiple conflicting entries');
    }
    const typeName = keys[0];
    if (typeName in registeredLoadBalancerTypes) {
        try {
            return registeredLoadBalancerTypes[typeName].LoadBalancingConfig.createFromJson(rawConfig[typeName]);
        } catch (e) {
            throw new Error(`${typeName}: ${e.message}`);
        }
    } else {
        throw new Error(`Unrecognized load balancing config name ${typeName}`);
    }
}
exports.parseLoadBalancingConfig = parseLoadBalancingConfig;
function getDefaultConfig() {
    if (!defaultLoadBalancerType) {
        throw new Error('No default load balancer type registered');
    }
    return new registeredLoadBalancerTypes[defaultLoadBalancerType].LoadBalancingConfig();
}
exports.getDefaultConfig = getDefaultConfig;
function selectLbConfigFromList(configs, fallbackTodefault = false) {
    for (const config of configs){
        try {
            return parseLoadBalancingConfig(config);
        } catch (e) {
            (0, logging_1.log)(constants_1.LogVerbosity.DEBUG, 'Config parsing failed with error', e.message);
            continue;
        }
    }
    if (fallbackTodefault) {
        if (defaultLoadBalancerType) {
            return new registeredLoadBalancerTypes[defaultLoadBalancerType].LoadBalancingConfig();
        } else {
            return null;
        }
    } else {
        return null;
    }
}
exports.selectLbConfigFromList = selectLbConfigFromList; //# sourceMappingURL=load-balancer.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/service-config.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.extractAndSelectServiceConfig = exports.validateServiceConfig = exports.validateRetryThrottling = void 0;
/* This file implements gRFC A2 and the service config spec:
 * https://github.com/grpc/proposal/blob/master/A2-service-configs-in-dns.md
 * https://github.com/grpc/grpc/blob/master/doc/service_config.md. Each
 * function here takes an object with unknown structure and returns its
 * specific object type if the input has the right structure, and throws an
 * error otherwise. */ /* The any type is purposely used here. All functions validate their input at
 * runtime */ /* eslint-disable @typescript-eslint/no-explicit-any */ const os = __turbopack_require__("[externals]/ [external] (os, cjs)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
/**
 * Recognizes a number with up to 9 digits after the decimal point, followed by
 * an "s", representing a number of seconds.
 */ const DURATION_REGEX = /^\d+(\.\d{1,9})?s$/;
/**
 * Client language name used for determining whether this client matches a
 * `ServiceConfigCanaryConfig`'s `clientLanguage` list.
 */ const CLIENT_LANGUAGE_STRING = 'node';
function validateName(obj) {
    // In this context, and unset field and '' are considered the same
    if ('service' in obj && obj.service !== '') {
        if (typeof obj.service !== 'string') {
            throw new Error(`Invalid method config name: invalid service: expected type string, got ${typeof obj.service}`);
        }
        if ('method' in obj && obj.method !== '') {
            if (typeof obj.method !== 'string') {
                throw new Error(`Invalid method config name: invalid method: expected type string, got ${typeof obj.service}`);
            }
            return {
                service: obj.service,
                method: obj.method
            };
        } else {
            return {
                service: obj.service
            };
        }
    } else {
        if ('method' in obj && obj.method !== undefined) {
            throw new Error(`Invalid method config name: method set with empty or unset service`);
        }
        return {};
    }
}
function validateRetryPolicy(obj) {
    if (!('maxAttempts' in obj) || !Number.isInteger(obj.maxAttempts) || obj.maxAttempts < 2) {
        throw new Error('Invalid method config retry policy: maxAttempts must be an integer at least 2');
    }
    if (!('initialBackoff' in obj) || typeof obj.initialBackoff !== 'string' || !DURATION_REGEX.test(obj.initialBackoff)) {
        throw new Error('Invalid method config retry policy: initialBackoff must be a string consisting of a positive integer or decimal followed by s');
    }
    if (!('maxBackoff' in obj) || typeof obj.maxBackoff !== 'string' || !DURATION_REGEX.test(obj.maxBackoff)) {
        throw new Error('Invalid method config retry policy: maxBackoff must be a string consisting of a positive integer or decimal followed by s');
    }
    if (!('backoffMultiplier' in obj) || typeof obj.backoffMultiplier !== 'number' || obj.backoffMultiplier <= 0) {
        throw new Error('Invalid method config retry policy: backoffMultiplier must be a number greater than 0');
    }
    if (!('retryableStatusCodes' in obj && Array.isArray(obj.retryableStatusCodes))) {
        throw new Error('Invalid method config retry policy: retryableStatusCodes is required');
    }
    if (obj.retryableStatusCodes.length === 0) {
        throw new Error('Invalid method config retry policy: retryableStatusCodes must be non-empty');
    }
    for (const value of obj.retryableStatusCodes){
        if (typeof value === 'number') {
            if (!Object.values(constants_1.Status).includes(value)) {
                throw new Error('Invalid method config retry policy: retryableStatusCodes value not in status code range');
            }
        } else if (typeof value === 'string') {
            if (!Object.values(constants_1.Status).includes(value.toUpperCase())) {
                throw new Error('Invalid method config retry policy: retryableStatusCodes value not a status code name');
            }
        } else {
            throw new Error('Invalid method config retry policy: retryableStatusCodes value must be a string or number');
        }
    }
    return {
        maxAttempts: obj.maxAttempts,
        initialBackoff: obj.initialBackoff,
        maxBackoff: obj.maxBackoff,
        backoffMultiplier: obj.backoffMultiplier,
        retryableStatusCodes: obj.retryableStatusCodes
    };
}
function validateHedgingPolicy(obj) {
    if (!('maxAttempts' in obj) || !Number.isInteger(obj.maxAttempts) || obj.maxAttempts < 2) {
        throw new Error('Invalid method config hedging policy: maxAttempts must be an integer at least 2');
    }
    if ('hedgingDelay' in obj && (typeof obj.hedgingDelay !== 'string' || !DURATION_REGEX.test(obj.hedgingDelay))) {
        throw new Error('Invalid method config hedging policy: hedgingDelay must be a string consisting of a positive integer followed by s');
    }
    if ('nonFatalStatusCodes' in obj && Array.isArray(obj.nonFatalStatusCodes)) {
        for (const value of obj.nonFatalStatusCodes){
            if (typeof value === 'number') {
                if (!Object.values(constants_1.Status).includes(value)) {
                    throw new Error('Invalid method config hedging policy: nonFatalStatusCodes value not in status code range');
                }
            } else if (typeof value === 'string') {
                if (!Object.values(constants_1.Status).includes(value.toUpperCase())) {
                    throw new Error('Invalid method config hedging policy: nonFatalStatusCodes value not a status code name');
                }
            } else {
                throw new Error('Invalid method config hedging policy: nonFatalStatusCodes value must be a string or number');
            }
        }
    }
    const result = {
        maxAttempts: obj.maxAttempts
    };
    if (obj.hedgingDelay) {
        result.hedgingDelay = obj.hedgingDelay;
    }
    if (obj.nonFatalStatusCodes) {
        result.nonFatalStatusCodes = obj.nonFatalStatusCodes;
    }
    return result;
}
function validateMethodConfig(obj) {
    var _a;
    const result = {
        name: []
    };
    if (!('name' in obj) || !Array.isArray(obj.name)) {
        throw new Error('Invalid method config: invalid name array');
    }
    for (const name of obj.name){
        result.name.push(validateName(name));
    }
    if ('waitForReady' in obj) {
        if (typeof obj.waitForReady !== 'boolean') {
            throw new Error('Invalid method config: invalid waitForReady');
        }
        result.waitForReady = obj.waitForReady;
    }
    if ('timeout' in obj) {
        if (typeof obj.timeout === 'object') {
            if (!('seconds' in obj.timeout) || !(typeof obj.timeout.seconds === 'number')) {
                throw new Error('Invalid method config: invalid timeout.seconds');
            }
            if (!('nanos' in obj.timeout) || !(typeof obj.timeout.nanos === 'number')) {
                throw new Error('Invalid method config: invalid timeout.nanos');
            }
            result.timeout = obj.timeout;
        } else if (typeof obj.timeout === 'string' && DURATION_REGEX.test(obj.timeout)) {
            const timeoutParts = obj.timeout.substring(0, obj.timeout.length - 1).split('.');
            result.timeout = {
                seconds: timeoutParts[0] | 0,
                nanos: ((_a = timeoutParts[1]) !== null && _a !== void 0 ? _a : 0) | 0
            };
        } else {
            throw new Error('Invalid method config: invalid timeout');
        }
    }
    if ('maxRequestBytes' in obj) {
        if (typeof obj.maxRequestBytes !== 'number') {
            throw new Error('Invalid method config: invalid maxRequestBytes');
        }
        result.maxRequestBytes = obj.maxRequestBytes;
    }
    if ('maxResponseBytes' in obj) {
        if (typeof obj.maxResponseBytes !== 'number') {
            throw new Error('Invalid method config: invalid maxRequestBytes');
        }
        result.maxResponseBytes = obj.maxResponseBytes;
    }
    if ('retryPolicy' in obj) {
        if ('hedgingPolicy' in obj) {
            throw new Error('Invalid method config: retryPolicy and hedgingPolicy cannot both be specified');
        } else {
            result.retryPolicy = validateRetryPolicy(obj.retryPolicy);
        }
    } else if ('hedgingPolicy' in obj) {
        result.hedgingPolicy = validateHedgingPolicy(obj.hedgingPolicy);
    }
    return result;
}
function validateRetryThrottling(obj) {
    if (!('maxTokens' in obj) || typeof obj.maxTokens !== 'number' || obj.maxTokens <= 0 || obj.maxTokens > 1000) {
        throw new Error('Invalid retryThrottling: maxTokens must be a number in (0, 1000]');
    }
    if (!('tokenRatio' in obj) || typeof obj.tokenRatio !== 'number' || obj.tokenRatio <= 0) {
        throw new Error('Invalid retryThrottling: tokenRatio must be a number greater than 0');
    }
    return {
        maxTokens: +obj.maxTokens.toFixed(3),
        tokenRatio: +obj.tokenRatio.toFixed(3)
    };
}
exports.validateRetryThrottling = validateRetryThrottling;
function validateLoadBalancingConfig(obj) {
    if (!(typeof obj === 'object' && obj !== null)) {
        throw new Error(`Invalid loadBalancingConfig: unexpected type ${typeof obj}`);
    }
    const keys = Object.keys(obj);
    if (keys.length > 1) {
        throw new Error(`Invalid loadBalancingConfig: unexpected multiple keys ${keys}`);
    }
    if (keys.length === 0) {
        throw new Error('Invalid loadBalancingConfig: load balancing policy name required');
    }
    return {
        [keys[0]]: obj[keys[0]]
    };
}
function validateServiceConfig(obj) {
    const result = {
        loadBalancingConfig: [],
        methodConfig: []
    };
    if ('loadBalancingPolicy' in obj) {
        if (typeof obj.loadBalancingPolicy === 'string') {
            result.loadBalancingPolicy = obj.loadBalancingPolicy;
        } else {
            throw new Error('Invalid service config: invalid loadBalancingPolicy');
        }
    }
    if ('loadBalancingConfig' in obj) {
        if (Array.isArray(obj.loadBalancingConfig)) {
            for (const config of obj.loadBalancingConfig){
                result.loadBalancingConfig.push(validateLoadBalancingConfig(config));
            }
        } else {
            throw new Error('Invalid service config: invalid loadBalancingConfig');
        }
    }
    if ('methodConfig' in obj) {
        if (Array.isArray(obj.methodConfig)) {
            for (const methodConfig of obj.methodConfig){
                result.methodConfig.push(validateMethodConfig(methodConfig));
            }
        }
    }
    if ('retryThrottling' in obj) {
        result.retryThrottling = validateRetryThrottling(obj.retryThrottling);
    }
    // Validate method name uniqueness
    const seenMethodNames = [];
    for (const methodConfig of result.methodConfig){
        for (const name of methodConfig.name){
            for (const seenName of seenMethodNames){
                if (name.service === seenName.service && name.method === seenName.method) {
                    throw new Error(`Invalid service config: duplicate name ${name.service}/${name.method}`);
                }
            }
            seenMethodNames.push(name);
        }
    }
    return result;
}
exports.validateServiceConfig = validateServiceConfig;
function validateCanaryConfig(obj) {
    if (!('serviceConfig' in obj)) {
        throw new Error('Invalid service config choice: missing service config');
    }
    const result = {
        serviceConfig: validateServiceConfig(obj.serviceConfig)
    };
    if ('clientLanguage' in obj) {
        if (Array.isArray(obj.clientLanguage)) {
            result.clientLanguage = [];
            for (const lang of obj.clientLanguage){
                if (typeof lang === 'string') {
                    result.clientLanguage.push(lang);
                } else {
                    throw new Error('Invalid service config choice: invalid clientLanguage');
                }
            }
        } else {
            throw new Error('Invalid service config choice: invalid clientLanguage');
        }
    }
    if ('clientHostname' in obj) {
        if (Array.isArray(obj.clientHostname)) {
            result.clientHostname = [];
            for (const lang of obj.clientHostname){
                if (typeof lang === 'string') {
                    result.clientHostname.push(lang);
                } else {
                    throw new Error('Invalid service config choice: invalid clientHostname');
                }
            }
        } else {
            throw new Error('Invalid service config choice: invalid clientHostname');
        }
    }
    if ('percentage' in obj) {
        if (typeof obj.percentage === 'number' && 0 <= obj.percentage && obj.percentage <= 100) {
            result.percentage = obj.percentage;
        } else {
            throw new Error('Invalid service config choice: invalid percentage');
        }
    }
    // Validate that no unexpected fields are present
    const allowedFields = [
        'clientLanguage',
        'percentage',
        'clientHostname',
        'serviceConfig'
    ];
    for(const field in obj){
        if (!allowedFields.includes(field)) {
            throw new Error(`Invalid service config choice: unexpected field ${field}`);
        }
    }
    return result;
}
function validateAndSelectCanaryConfig(obj, percentage) {
    if (!Array.isArray(obj)) {
        throw new Error('Invalid service config list');
    }
    for (const config of obj){
        const validatedConfig = validateCanaryConfig(config);
        /* For each field, we check if it is present, then only discard the
         * config if the field value does not match the current client */ if (typeof validatedConfig.percentage === 'number' && percentage > validatedConfig.percentage) {
            continue;
        }
        if (Array.isArray(validatedConfig.clientHostname)) {
            let hostnameMatched = false;
            for (const hostname of validatedConfig.clientHostname){
                if (hostname === os.hostname()) {
                    hostnameMatched = true;
                }
            }
            if (!hostnameMatched) {
                continue;
            }
        }
        if (Array.isArray(validatedConfig.clientLanguage)) {
            let languageMatched = false;
            for (const language of validatedConfig.clientLanguage){
                if (language === CLIENT_LANGUAGE_STRING) {
                    languageMatched = true;
                }
            }
            if (!languageMatched) {
                continue;
            }
        }
        return validatedConfig.serviceConfig;
    }
    throw new Error('No matching service config found');
}
/**
 * Find the "grpc_config" record among the TXT records, parse its value as JSON, validate its contents,
 * and select a service config with selection fields that all match this client. Most of these steps
 * can fail with an error; the caller must handle any errors thrown this way.
 * @param txtRecord The TXT record array that is output from a successful call to dns.resolveTxt
 * @param percentage A number chosen from the range [0, 100) that is used to select which config to use
 * @return The service configuration to use, given the percentage value, or null if the service config
 *     data has a valid format but none of the options match the current client.
 */ function extractAndSelectServiceConfig(txtRecord, percentage) {
    for (const record of txtRecord){
        if (record.length > 0 && record[0].startsWith('grpc_config=')) {
            /* Treat the list of strings in this record as a single string and remove
             * "grpc_config=" from the beginning. The rest should be a JSON string */ const recordString = record.join('').substring('grpc_config='.length);
            const recordJson = JSON.parse(recordString);
            return validateAndSelectCanaryConfig(recordJson, percentage);
        }
    }
    return null;
}
exports.extractAndSelectServiceConfig = extractAndSelectServiceConfig; //# sourceMappingURL=service-config.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2021 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ConnectivityState = void 0;
var ConnectivityState;
(function(ConnectivityState) {
    ConnectivityState[ConnectivityState["IDLE"] = 0] = "IDLE";
    ConnectivityState[ConnectivityState["CONNECTING"] = 1] = "CONNECTING";
    ConnectivityState[ConnectivityState["READY"] = 2] = "READY";
    ConnectivityState[ConnectivityState["TRANSIENT_FAILURE"] = 3] = "TRANSIENT_FAILURE";
    ConnectivityState[ConnectivityState["SHUTDOWN"] = 4] = "SHUTDOWN";
})(ConnectivityState || (exports.ConnectivityState = ConnectivityState = {})); //# sourceMappingURL=connectivity-state.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2020 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.uriToString = exports.combineHostPort = exports.splitHostPort = exports.parseUri = void 0;
/*
 * The groups correspond to URI parts as follows:
 * 1. scheme
 * 2. authority
 * 3. path
 */ const URI_REGEX = /^(?:([A-Za-z0-9+.-]+):)?(?:\/\/([^/]*)\/)?(.+)$/;
function parseUri(uriString) {
    const parsedUri = URI_REGEX.exec(uriString);
    if (parsedUri === null) {
        return null;
    }
    return {
        scheme: parsedUri[1],
        authority: parsedUri[2],
        path: parsedUri[3]
    };
}
exports.parseUri = parseUri;
const NUMBER_REGEX = /^\d+$/;
function splitHostPort(path) {
    if (path.startsWith('[')) {
        const hostEnd = path.indexOf(']');
        if (hostEnd === -1) {
            return null;
        }
        const host = path.substring(1, hostEnd);
        /* Only an IPv6 address should be in bracketed notation, and an IPv6
         * address should have at least one colon */ if (host.indexOf(':') === -1) {
            return null;
        }
        if (path.length > hostEnd + 1) {
            if (path[hostEnd + 1] === ':') {
                const portString = path.substring(hostEnd + 2);
                if (NUMBER_REGEX.test(portString)) {
                    return {
                        host: host,
                        port: +portString
                    };
                } else {
                    return null;
                }
            } else {
                return null;
            }
        } else {
            return {
                host
            };
        }
    } else {
        const splitPath = path.split(':');
        /* Exactly one colon means that this is host:port. Zero colons means that
         * there is no port. And multiple colons means that this is a bare IPv6
         * address with no port */ if (splitPath.length === 2) {
            if (NUMBER_REGEX.test(splitPath[1])) {
                return {
                    host: splitPath[0],
                    port: +splitPath[1]
                };
            } else {
                return null;
            }
        } else {
            return {
                host: path
            };
        }
    }
}
exports.splitHostPort = splitHostPort;
function combineHostPort(hostPort) {
    if (hostPort.port === undefined) {
        return hostPort.host;
    } else {
        // Only an IPv6 host should include a colon
        if (hostPort.host.includes(':')) {
            return `[${hostPort.host}]:${hostPort.port}`;
        } else {
            return `${hostPort.host}:${hostPort.port}`;
        }
    }
}
exports.combineHostPort = combineHostPort;
function uriToString(uri) {
    let result = '';
    if (uri.scheme !== undefined) {
        result += uri.scheme + ':';
    }
    if (uri.authority !== undefined) {
        result += '//' + uri.authority + '/';
    }
    result += uri.path;
    return result;
}
exports.uriToString = uriToString; //# sourceMappingURL=uri-parser.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.mapUriDefaultScheme = exports.getDefaultAuthority = exports.createResolver = exports.registerDefaultScheme = exports.registerResolver = void 0;
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const registeredResolvers = {};
let defaultScheme = null;
/**
 * Register a resolver class to handle target names prefixed with the `prefix`
 * string. This prefix should correspond to a URI scheme name listed in the
 * [gRPC Name Resolution document](https://github.com/grpc/grpc/blob/master/doc/naming.md)
 * @param prefix
 * @param resolverClass
 */ function registerResolver(scheme, resolverClass) {
    registeredResolvers[scheme] = resolverClass;
}
exports.registerResolver = registerResolver;
/**
 * Register a default resolver to handle target names that do not start with
 * any registered prefix.
 * @param resolverClass
 */ function registerDefaultScheme(scheme) {
    defaultScheme = scheme;
}
exports.registerDefaultScheme = registerDefaultScheme;
/**
 * Create a name resolver for the specified target, if possible. Throws an
 * error if no such name resolver can be created.
 * @param target
 * @param listener
 */ function createResolver(target, listener, options) {
    if (target.scheme !== undefined && target.scheme in registeredResolvers) {
        return new registeredResolvers[target.scheme](target, listener, options);
    } else {
        throw new Error(`No resolver could be created for target ${(0, uri_parser_1.uriToString)(target)}`);
    }
}
exports.createResolver = createResolver;
/**
 * Get the default authority for the specified target, if possible. Throws an
 * error if no registered name resolver can parse that target string.
 * @param target
 */ function getDefaultAuthority(target) {
    if (target.scheme !== undefined && target.scheme in registeredResolvers) {
        return registeredResolvers[target.scheme].getDefaultAuthority(target);
    } else {
        throw new Error(`Invalid target ${(0, uri_parser_1.uriToString)(target)}`);
    }
}
exports.getDefaultAuthority = getDefaultAuthority;
function mapUriDefaultScheme(target) {
    if (target.scheme === undefined || !(target.scheme in registeredResolvers)) {
        if (defaultScheme !== null) {
            return {
                scheme: defaultScheme,
                authority: undefined,
                path: (0, uri_parser_1.uriToString)(target)
            };
        } else {
            return null;
        }
    }
    return target;
}
exports.mapUriDefaultScheme = mapUriDefaultScheme; //# sourceMappingURL=resolver.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/picker.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.QueuePicker = exports.UnavailablePicker = exports.PickResultType = void 0;
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
var PickResultType;
(function(PickResultType) {
    PickResultType[PickResultType["COMPLETE"] = 0] = "COMPLETE";
    PickResultType[PickResultType["QUEUE"] = 1] = "QUEUE";
    PickResultType[PickResultType["TRANSIENT_FAILURE"] = 2] = "TRANSIENT_FAILURE";
    PickResultType[PickResultType["DROP"] = 3] = "DROP";
})(PickResultType || (exports.PickResultType = PickResultType = {}));
/**
 * A standard picker representing a load balancer in the TRANSIENT_FAILURE
 * state. Always responds to every pick request with an UNAVAILABLE status.
 */ class UnavailablePicker {
    constructor(status){
        this.status = Object.assign({
            code: constants_1.Status.UNAVAILABLE,
            details: 'No connection established',
            metadata: new metadata_1.Metadata()
        }, status);
    }
    pick(pickArgs) {
        return {
            pickResultType: PickResultType.TRANSIENT_FAILURE,
            subchannel: null,
            status: this.status,
            onCallStarted: null,
            onCallEnded: null
        };
    }
}
exports.UnavailablePicker = UnavailablePicker;
/**
 * A standard picker representing a load balancer in the IDLE or CONNECTING
 * state. Always responds to every pick request with a QUEUE pick result
 * indicating that the pick should be tried again with the next `Picker`. Also
 * reports back to the load balancer that a connection should be established
 * once any pick is attempted.
 * If the childPicker is provided, delegate to it instead of returning the
 * hardcoded QUEUE pick result, but still calls exitIdle.
 */ class QueuePicker {
    // Constructed with a load balancer. Calls exitIdle on it the first time pick is called
    constructor(loadBalancer, childPicker){
        this.loadBalancer = loadBalancer;
        this.childPicker = childPicker;
        this.calledExitIdle = false;
    }
    pick(pickArgs) {
        if (!this.calledExitIdle) {
            process.nextTick(()=>{
                this.loadBalancer.exitIdle();
            });
            this.calledExitIdle = true;
        }
        if (this.childPicker) {
            return this.childPicker.pick(pickArgs);
        } else {
            return {
                pickResultType: PickResultType.QUEUE,
                subchannel: null,
                status: null,
                onCallStarted: null,
                onCallEnded: null
            };
        }
    }
}
exports.QueuePicker = QueuePicker; //# sourceMappingURL=picker.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/backoff-timeout.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.BackoffTimeout = void 0;
const INITIAL_BACKOFF_MS = 1000;
const BACKOFF_MULTIPLIER = 1.6;
const MAX_BACKOFF_MS = 120000;
const BACKOFF_JITTER = 0.2;
/**
 * Get a number uniformly at random in the range [min, max)
 * @param min
 * @param max
 */ function uniformRandom(min, max) {
    return Math.random() * (max - min) + min;
}
class BackoffTimeout {
    constructor(callback, options){
        this.callback = callback;
        /**
         * The delay time at the start, and after each reset.
         */ this.initialDelay = INITIAL_BACKOFF_MS;
        /**
         * The exponential backoff multiplier.
         */ this.multiplier = BACKOFF_MULTIPLIER;
        /**
         * The maximum delay time
         */ this.maxDelay = MAX_BACKOFF_MS;
        /**
         * The maximum fraction by which the delay time can randomly vary after
         * applying the multiplier.
         */ this.jitter = BACKOFF_JITTER;
        /**
         * Indicates whether the timer is currently running.
         */ this.running = false;
        /**
         * Indicates whether the timer should keep the Node process running if no
         * other async operation is doing so.
         */ this.hasRef = true;
        /**
         * The time that the currently running timer was started. Only valid if
         * running is true.
         */ this.startTime = new Date();
        /**
         * The approximate time that the currently running timer will end. Only valid
         * if running is true.
         */ this.endTime = new Date();
        if (options) {
            if (options.initialDelay) {
                this.initialDelay = options.initialDelay;
            }
            if (options.multiplier) {
                this.multiplier = options.multiplier;
            }
            if (options.jitter) {
                this.jitter = options.jitter;
            }
            if (options.maxDelay) {
                this.maxDelay = options.maxDelay;
            }
        }
        this.nextDelay = this.initialDelay;
        this.timerId = setTimeout(()=>{}, 0);
        clearTimeout(this.timerId);
    }
    runTimer(delay) {
        var _a, _b;
        this.endTime = this.startTime;
        this.endTime.setMilliseconds(this.endTime.getMilliseconds() + this.nextDelay);
        clearTimeout(this.timerId);
        this.timerId = setTimeout(()=>{
            this.callback();
            this.running = false;
        }, delay);
        if (!this.hasRef) {
            (_b = (_a = this.timerId).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
    }
    /**
     * Call the callback after the current amount of delay time
     */ runOnce() {
        this.running = true;
        this.startTime = new Date();
        this.runTimer(this.nextDelay);
        const nextBackoff = Math.min(this.nextDelay * this.multiplier, this.maxDelay);
        const jitterMagnitude = nextBackoff * this.jitter;
        this.nextDelay = nextBackoff + uniformRandom(-jitterMagnitude, jitterMagnitude);
    }
    /**
     * Stop the timer. The callback will not be called until `runOnce` is called
     * again.
     */ stop() {
        clearTimeout(this.timerId);
        this.running = false;
    }
    /**
     * Reset the delay time to its initial value. If the timer is still running,
     * retroactively apply that reset to the current timer.
     */ reset() {
        this.nextDelay = this.initialDelay;
        if (this.running) {
            const now = new Date();
            const newEndTime = this.startTime;
            newEndTime.setMilliseconds(newEndTime.getMilliseconds() + this.nextDelay);
            clearTimeout(this.timerId);
            if (now < newEndTime) {
                this.runTimer(newEndTime.getTime() - now.getTime());
            } else {
                this.running = false;
            }
        }
    }
    /**
     * Check whether the timer is currently running.
     */ isRunning() {
        return this.running;
    }
    /**
     * Set that while the timer is running, it should keep the Node process
     * running.
     */ ref() {
        var _a, _b;
        this.hasRef = true;
        (_b = (_a = this.timerId).ref) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    /**
     * Set that while the timer is running, it should not keep the Node process
     * running.
     */ unref() {
        var _a, _b;
        this.hasRef = false;
        (_b = (_a = this.timerId).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    /**
     * Get the approximate timestamp of when the timer will fire. Only valid if
     * this.isRunning() is true.
     */ getEndTime() {
        return this.endTime;
    }
}
exports.BackoffTimeout = BackoffTimeout; //# sourceMappingURL=backoff-timeout.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-child-handler.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2020 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ChildLoadBalancerHandler = void 0;
const load_balancer_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer.js [app-rsc] (ecmascript)");
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
const TYPE_NAME = 'child_load_balancer_helper';
class ChildLoadBalancerHandler {
    constructor(channelControlHelper, credentials, options){
        this.channelControlHelper = channelControlHelper;
        this.credentials = credentials;
        this.options = options;
        this.currentChild = null;
        this.pendingChild = null;
        this.latestConfig = null;
        this.ChildPolicyHelper = class {
            constructor(parent){
                this.parent = parent;
                this.child = null;
            }
            createSubchannel(subchannelAddress, subchannelArgs, credentialsOverride) {
                return this.parent.channelControlHelper.createSubchannel(subchannelAddress, subchannelArgs, credentialsOverride);
            }
            updateState(connectivityState, picker) {
                var _a;
                if (this.calledByPendingChild()) {
                    if (connectivityState === connectivity_state_1.ConnectivityState.CONNECTING) {
                        return;
                    }
                    (_a = this.parent.currentChild) === null || _a === void 0 ? void 0 : _a.destroy();
                    this.parent.currentChild = this.parent.pendingChild;
                    this.parent.pendingChild = null;
                } else if (!this.calledByCurrentChild()) {
                    return;
                }
                this.parent.channelControlHelper.updateState(connectivityState, picker);
            }
            requestReresolution() {
                var _a;
                const latestChild = (_a = this.parent.pendingChild) !== null && _a !== void 0 ? _a : this.parent.currentChild;
                if (this.child === latestChild) {
                    this.parent.channelControlHelper.requestReresolution();
                }
            }
            setChild(newChild) {
                this.child = newChild;
            }
            addChannelzChild(child) {
                this.parent.channelControlHelper.addChannelzChild(child);
            }
            removeChannelzChild(child) {
                this.parent.channelControlHelper.removeChannelzChild(child);
            }
            calledByPendingChild() {
                return this.child === this.parent.pendingChild;
            }
            calledByCurrentChild() {
                return this.child === this.parent.currentChild;
            }
        };
    }
    configUpdateRequiresNewPolicyInstance(oldConfig, newConfig) {
        return oldConfig.getLoadBalancerName() !== newConfig.getLoadBalancerName();
    }
    /**
     * Prerequisites: lbConfig !== null and lbConfig.name is registered
     * @param endpointList
     * @param lbConfig
     * @param attributes
     */ updateAddressList(endpointList, lbConfig, attributes) {
        let childToUpdate;
        if (this.currentChild === null || this.latestConfig === null || this.configUpdateRequiresNewPolicyInstance(this.latestConfig, lbConfig)) {
            const newHelper = new this.ChildPolicyHelper(this);
            const newChild = (0, load_balancer_1.createLoadBalancer)(lbConfig, newHelper, this.credentials, this.options);
            newHelper.setChild(newChild);
            if (this.currentChild === null) {
                this.currentChild = newChild;
                childToUpdate = this.currentChild;
            } else {
                if (this.pendingChild) {
                    this.pendingChild.destroy();
                }
                this.pendingChild = newChild;
                childToUpdate = this.pendingChild;
            }
        } else {
            if (this.pendingChild === null) {
                childToUpdate = this.currentChild;
            } else {
                childToUpdate = this.pendingChild;
            }
        }
        this.latestConfig = lbConfig;
        childToUpdate.updateAddressList(endpointList, lbConfig, attributes);
    }
    exitIdle() {
        if (this.currentChild) {
            this.currentChild.exitIdle();
            if (this.pendingChild) {
                this.pendingChild.exitIdle();
            }
        }
    }
    resetBackoff() {
        if (this.currentChild) {
            this.currentChild.resetBackoff();
            if (this.pendingChild) {
                this.pendingChild.resetBackoff();
            }
        }
    }
    destroy() {
        /* Note: state updates are only propagated from the child balancer if that
         * object is equal to this.currentChild or this.pendingChild. Since this
         * function sets both of those to null, no further state updates will
         * occur after this function returns. */ if (this.currentChild) {
            this.currentChild.destroy();
            this.currentChild = null;
        }
        if (this.pendingChild) {
            this.pendingChild.destroy();
            this.pendingChild = null;
        }
    }
    getTypeName() {
        return TYPE_NAME;
    }
}
exports.ChildLoadBalancerHandler = ChildLoadBalancerHandler; //# sourceMappingURL=load-balancer-child-handler.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolving-load-balancer.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ResolvingLoadBalancer = void 0;
const load_balancer_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer.js [app-rsc] (ecmascript)");
const service_config_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/service-config.js [app-rsc] (ecmascript)");
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
const resolver_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver.js [app-rsc] (ecmascript)");
const picker_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/picker.js [app-rsc] (ecmascript)");
const backoff_timeout_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/backoff-timeout.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const constants_2 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const load_balancer_child_handler_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-child-handler.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'resolving_load_balancer';
function trace(text) {
    logging.trace(constants_2.LogVerbosity.DEBUG, TRACER_NAME, text);
}
/**
 * Name match levels in order from most to least specific. This is the order in
 * which searches will be performed.
 */ const NAME_MATCH_LEVEL_ORDER = [
    'SERVICE_AND_METHOD',
    'SERVICE',
    'EMPTY'
];
function hasMatchingName(service, method, methodConfig, matchLevel) {
    for (const name of methodConfig.name){
        switch(matchLevel){
            case 'EMPTY':
                if (!name.service && !name.method) {
                    return true;
                }
                break;
            case 'SERVICE':
                if (name.service === service && !name.method) {
                    return true;
                }
                break;
            case 'SERVICE_AND_METHOD':
                if (name.service === service && name.method === method) {
                    return true;
                }
        }
    }
    return false;
}
function findMatchingConfig(service, method, methodConfigs, matchLevel) {
    for (const config of methodConfigs){
        if (hasMatchingName(service, method, config, matchLevel)) {
            return config;
        }
    }
    return null;
}
function getDefaultConfigSelector(serviceConfig) {
    return function defaultConfigSelector(methodName, metadata) {
        var _a, _b;
        const splitName = methodName.split('/').filter((x)=>x.length > 0);
        const service = (_a = splitName[0]) !== null && _a !== void 0 ? _a : '';
        const method = (_b = splitName[1]) !== null && _b !== void 0 ? _b : '';
        if (serviceConfig && serviceConfig.methodConfig) {
            /* Check for the following in order, and return the first method
             * config that matches:
             * 1. A name that exactly matches the service and method
             * 2. A name with no method set that matches the service
             * 3. An empty name
             */ for (const matchLevel of NAME_MATCH_LEVEL_ORDER){
                const matchingConfig = findMatchingConfig(service, method, serviceConfig.methodConfig, matchLevel);
                if (matchingConfig) {
                    return {
                        methodConfig: matchingConfig,
                        pickInformation: {},
                        status: constants_1.Status.OK,
                        dynamicFilterFactories: []
                    };
                }
            }
        }
        return {
            methodConfig: {
                name: []
            },
            pickInformation: {},
            status: constants_1.Status.OK,
            dynamicFilterFactories: []
        };
    };
}
class ResolvingLoadBalancer {
    /**
     * Wrapper class that behaves like a `LoadBalancer` and also handles name
     * resolution internally.
     * @param target The address of the backend to connect to.
     * @param channelControlHelper `ChannelControlHelper` instance provided by
     *     this load balancer's owner.
     * @param defaultServiceConfig The default service configuration to be used
     *     if none is provided by the name resolver. A `null` value indicates
     *     that the default behavior should be the default unconfigured behavior.
     *     In practice, that means using the "pick first" load balancer
     *     implmentation
     */ constructor(target, channelControlHelper, credentials, channelOptions, onSuccessfulResolution, onFailedResolution){
        this.target = target;
        this.channelControlHelper = channelControlHelper;
        this.onSuccessfulResolution = onSuccessfulResolution;
        this.onFailedResolution = onFailedResolution;
        this.latestChildState = connectivity_state_1.ConnectivityState.IDLE;
        this.latestChildPicker = new picker_1.QueuePicker(this);
        /**
         * This resolving load balancer's current connectivity state.
         */ this.currentState = connectivity_state_1.ConnectivityState.IDLE;
        /**
         * The service config object from the last successful resolution, if
         * available. A value of null indicates that we have not yet received a valid
         * service config from the resolver.
         */ this.previousServiceConfig = null;
        /**
         * Indicates whether we should attempt to resolve again after the backoff
         * timer runs out.
         */ this.continueResolving = false;
        if (channelOptions['grpc.service_config']) {
            this.defaultServiceConfig = (0, service_config_1.validateServiceConfig)(JSON.parse(channelOptions['grpc.service_config']));
        } else {
            this.defaultServiceConfig = {
                loadBalancingConfig: [],
                methodConfig: []
            };
        }
        this.updateState(connectivity_state_1.ConnectivityState.IDLE, new picker_1.QueuePicker(this));
        this.childLoadBalancer = new load_balancer_child_handler_1.ChildLoadBalancerHandler({
            createSubchannel: channelControlHelper.createSubchannel.bind(channelControlHelper),
            requestReresolution: ()=>{
                /* If the backoffTimeout is running, we're still backing off from
                 * making resolve requests, so we shouldn't make another one here.
                 * In that case, the backoff timer callback will call
                 * updateResolution */ if (this.backoffTimeout.isRunning()) {
                    trace('requestReresolution delayed by backoff timer until ' + this.backoffTimeout.getEndTime().toISOString());
                    this.continueResolving = true;
                } else {
                    this.updateResolution();
                }
            },
            updateState: (newState, picker)=>{
                this.latestChildState = newState;
                this.latestChildPicker = picker;
                this.updateState(newState, picker);
            },
            addChannelzChild: channelControlHelper.addChannelzChild.bind(channelControlHelper),
            removeChannelzChild: channelControlHelper.removeChannelzChild.bind(channelControlHelper)
        }, credentials, channelOptions);
        this.innerResolver = (0, resolver_1.createResolver)(target, {
            onSuccessfulResolution: (endpointList, serviceConfig, serviceConfigError, configSelector, attributes)=>{
                var _a;
                this.backoffTimeout.stop();
                this.backoffTimeout.reset();
                let workingServiceConfig = null;
                /* This first group of conditionals implements the algorithm described
                 * in https://github.com/grpc/proposal/blob/master/A21-service-config-error-handling.md
                 * in the section called "Behavior on receiving a new gRPC Config".
                 */ if (serviceConfig === null) {
                    // Step 4 and 5
                    if (serviceConfigError === null) {
                        // Step 5
                        this.previousServiceConfig = null;
                        workingServiceConfig = this.defaultServiceConfig;
                    } else {
                        // Step 4
                        if (this.previousServiceConfig === null) {
                            // Step 4.ii
                            this.handleResolutionFailure(serviceConfigError);
                        } else {
                            // Step 4.i
                            workingServiceConfig = this.previousServiceConfig;
                        }
                    }
                } else {
                    // Step 3
                    workingServiceConfig = serviceConfig;
                    this.previousServiceConfig = serviceConfig;
                }
                const workingConfigList = (_a = workingServiceConfig === null || workingServiceConfig === void 0 ? void 0 : workingServiceConfig.loadBalancingConfig) !== null && _a !== void 0 ? _a : [];
                const loadBalancingConfig = (0, load_balancer_1.selectLbConfigFromList)(workingConfigList, true);
                if (loadBalancingConfig === null) {
                    // There were load balancing configs but none are supported. This counts as a resolution failure
                    this.handleResolutionFailure({
                        code: constants_1.Status.UNAVAILABLE,
                        details: 'All load balancer options in service config are not compatible',
                        metadata: new metadata_1.Metadata()
                    });
                    return;
                }
                this.childLoadBalancer.updateAddressList(endpointList, loadBalancingConfig, attributes);
                const finalServiceConfig = workingServiceConfig !== null && workingServiceConfig !== void 0 ? workingServiceConfig : this.defaultServiceConfig;
                this.onSuccessfulResolution(finalServiceConfig, configSelector !== null && configSelector !== void 0 ? configSelector : getDefaultConfigSelector(finalServiceConfig));
            },
            onError: (error)=>{
                this.handleResolutionFailure(error);
            }
        }, channelOptions);
        const backoffOptions = {
            initialDelay: channelOptions['grpc.initial_reconnect_backoff_ms'],
            maxDelay: channelOptions['grpc.max_reconnect_backoff_ms']
        };
        this.backoffTimeout = new backoff_timeout_1.BackoffTimeout(()=>{
            if (this.continueResolving) {
                this.updateResolution();
                this.continueResolving = false;
            } else {
                this.updateState(this.latestChildState, this.latestChildPicker);
            }
        }, backoffOptions);
        this.backoffTimeout.unref();
    }
    updateResolution() {
        this.innerResolver.updateResolution();
        if (this.currentState === connectivity_state_1.ConnectivityState.IDLE) {
            /* this.latestChildPicker is initialized as new QueuePicker(this), which
             * is an appropriate value here if the child LB policy is unset.
             * Otherwise, we want to delegate to the child here, in case that
             * triggers something. */ this.updateState(connectivity_state_1.ConnectivityState.CONNECTING, this.latestChildPicker);
        }
        this.backoffTimeout.runOnce();
    }
    updateState(connectivityState, picker) {
        trace((0, uri_parser_1.uriToString)(this.target) + ' ' + connectivity_state_1.ConnectivityState[this.currentState] + ' -> ' + connectivity_state_1.ConnectivityState[connectivityState]);
        // Ensure that this.exitIdle() is called by the picker
        if (connectivityState === connectivity_state_1.ConnectivityState.IDLE) {
            picker = new picker_1.QueuePicker(this, picker);
        }
        this.currentState = connectivityState;
        this.channelControlHelper.updateState(connectivityState, picker);
    }
    handleResolutionFailure(error) {
        if (this.latestChildState === connectivity_state_1.ConnectivityState.IDLE) {
            this.updateState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE, new picker_1.UnavailablePicker(error));
            this.onFailedResolution(error);
        }
    }
    exitIdle() {
        if (this.currentState === connectivity_state_1.ConnectivityState.IDLE || this.currentState === connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE) {
            if (this.backoffTimeout.isRunning()) {
                this.continueResolving = true;
            } else {
                this.updateResolution();
            }
        }
        this.childLoadBalancer.exitIdle();
    }
    updateAddressList(endpointList, lbConfig) {
        throw new Error('updateAddressList not supported on ResolvingLoadBalancer');
    }
    resetBackoff() {
        this.backoffTimeout.reset();
        this.childLoadBalancer.resetBackoff();
    }
    destroy() {
        this.childLoadBalancer.destroy();
        this.innerResolver.destroy();
        this.backoffTimeout.reset();
        this.backoffTimeout.stop();
        this.latestChildState = connectivity_state_1.ConnectivityState.IDLE;
        this.latestChildPicker = new picker_1.QueuePicker(this);
        this.currentState = connectivity_state_1.ConnectivityState.IDLE;
        this.previousServiceConfig = null;
        this.continueResolving = false;
    }
    getTypeName() {
        return 'resolving_load_balancer';
    }
}
exports.ResolvingLoadBalancer = ResolvingLoadBalancer; //# sourceMappingURL=resolving-load-balancer.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channel-options.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.channelOptionsEqual = exports.recognizedOptions = void 0;
/**
 * This is for checking provided options at runtime. This is an object for
 * easier membership checking.
 */ exports.recognizedOptions = {
    'grpc.ssl_target_name_override': true,
    'grpc.primary_user_agent': true,
    'grpc.secondary_user_agent': true,
    'grpc.default_authority': true,
    'grpc.keepalive_time_ms': true,
    'grpc.keepalive_timeout_ms': true,
    'grpc.keepalive_permit_without_calls': true,
    'grpc.service_config': true,
    'grpc.max_concurrent_streams': true,
    'grpc.initial_reconnect_backoff_ms': true,
    'grpc.max_reconnect_backoff_ms': true,
    'grpc.use_local_subchannel_pool': true,
    'grpc.max_send_message_length': true,
    'grpc.max_receive_message_length': true,
    'grpc.enable_http_proxy': true,
    'grpc.enable_channelz': true,
    'grpc.dns_min_time_between_resolutions_ms': true,
    'grpc.enable_retries': true,
    'grpc.per_rpc_retry_buffer_size': true,
    'grpc.retry_buffer_size': true,
    'grpc.max_connection_age_ms': true,
    'grpc.max_connection_age_grace_ms': true,
    'grpc-node.max_session_memory': true,
    'grpc.service_config_disable_resolution': true,
    'grpc.client_idle_timeout_ms': true,
    'grpc-node.tls_enable_trace': true,
    'grpc.lb.ring_hash.ring_size_cap': true,
    'grpc-node.retry_max_attempts_limit': true
};
function channelOptionsEqual(options1, options2) {
    const keys1 = Object.keys(options1).sort();
    const keys2 = Object.keys(options2).sort();
    if (keys1.length !== keys2.length) {
        return false;
    }
    for(let i = 0; i < keys1.length; i += 1){
        if (keys1[i] !== keys2[i]) {
            return false;
        }
        if (options1[keys1[i]] !== options2[keys2[i]]) {
            return false;
        }
    }
    return true;
}
exports.channelOptionsEqual = channelOptionsEqual; //# sourceMappingURL=channel-options.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2021 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.EndpointMap = exports.endpointHasAddress = exports.endpointToString = exports.endpointEqual = exports.stringToSubchannelAddress = exports.subchannelAddressToString = exports.subchannelAddressEqual = exports.isTcpSubchannelAddress = void 0;
const net_1 = __turbopack_require__("[externals]/ [external] (net, cjs)");
function isTcpSubchannelAddress(address) {
    return 'port' in address;
}
exports.isTcpSubchannelAddress = isTcpSubchannelAddress;
function subchannelAddressEqual(address1, address2) {
    if (!address1 && !address2) {
        return true;
    }
    if (!address1 || !address2) {
        return false;
    }
    if (isTcpSubchannelAddress(address1)) {
        return isTcpSubchannelAddress(address2) && address1.host === address2.host && address1.port === address2.port;
    } else {
        return !isTcpSubchannelAddress(address2) && address1.path === address2.path;
    }
}
exports.subchannelAddressEqual = subchannelAddressEqual;
function subchannelAddressToString(address) {
    if (isTcpSubchannelAddress(address)) {
        if ((0, net_1.isIPv6)(address.host)) {
            return '[' + address.host + ']:' + address.port;
        } else {
            return address.host + ':' + address.port;
        }
    } else {
        return address.path;
    }
}
exports.subchannelAddressToString = subchannelAddressToString;
const DEFAULT_PORT = 443;
function stringToSubchannelAddress(addressString, port) {
    if ((0, net_1.isIP)(addressString)) {
        return {
            host: addressString,
            port: port !== null && port !== void 0 ? port : DEFAULT_PORT
        };
    } else {
        return {
            path: addressString
        };
    }
}
exports.stringToSubchannelAddress = stringToSubchannelAddress;
function endpointEqual(endpoint1, endpoint2) {
    if (endpoint1.addresses.length !== endpoint2.addresses.length) {
        return false;
    }
    for(let i = 0; i < endpoint1.addresses.length; i++){
        if (!subchannelAddressEqual(endpoint1.addresses[i], endpoint2.addresses[i])) {
            return false;
        }
    }
    return true;
}
exports.endpointEqual = endpointEqual;
function endpointToString(endpoint) {
    return '[' + endpoint.addresses.map(subchannelAddressToString).join(', ') + ']';
}
exports.endpointToString = endpointToString;
function endpointHasAddress(endpoint, expectedAddress) {
    for (const address of endpoint.addresses){
        if (subchannelAddressEqual(address, expectedAddress)) {
            return true;
        }
    }
    return false;
}
exports.endpointHasAddress = endpointHasAddress;
function endpointEqualUnordered(endpoint1, endpoint2) {
    if (endpoint1.addresses.length !== endpoint2.addresses.length) {
        return false;
    }
    for (const address1 of endpoint1.addresses){
        let matchFound = false;
        for (const address2 of endpoint2.addresses){
            if (subchannelAddressEqual(address1, address2)) {
                matchFound = true;
                break;
            }
        }
        if (!matchFound) {
            return false;
        }
    }
    return true;
}
class EndpointMap {
    constructor(){
        this.map = new Set();
    }
    get size() {
        return this.map.size;
    }
    getForSubchannelAddress(address) {
        for (const entry of this.map){
            if (endpointHasAddress(entry.key, address)) {
                return entry.value;
            }
        }
        return undefined;
    }
    /**
     * Delete any entries in this map with keys that are not in endpoints
     * @param endpoints
     */ deleteMissing(endpoints) {
        const removedValues = [];
        for (const entry of this.map){
            let foundEntry = false;
            for (const endpoint of endpoints){
                if (endpointEqualUnordered(endpoint, entry.key)) {
                    foundEntry = true;
                }
            }
            if (!foundEntry) {
                removedValues.push(entry.value);
                this.map.delete(entry);
            }
        }
        return removedValues;
    }
    get(endpoint) {
        for (const entry of this.map){
            if (endpointEqualUnordered(endpoint, entry.key)) {
                return entry.value;
            }
        }
        return undefined;
    }
    set(endpoint, mapEntry) {
        for (const entry of this.map){
            if (endpointEqualUnordered(endpoint, entry.key)) {
                entry.value = mapEntry;
                return;
            }
        }
        this.map.add({
            key: endpoint,
            value: mapEntry
        });
    }
    delete(endpoint) {
        for (const entry of this.map){
            if (endpointEqualUnordered(endpoint, entry.key)) {
                this.map.delete(entry);
                return;
            }
        }
    }
    has(endpoint) {
        for (const entry of this.map){
            if (endpointEqualUnordered(endpoint, entry.key)) {
                return true;
            }
        }
        return false;
    }
    clear() {
        this.map.clear();
    }
    *keys() {
        for (const entry of this.map){
            yield entry.key;
        }
    }
    *values() {
        for (const entry of this.map){
            yield entry.value;
        }
    }
    *entries() {
        for (const entry of this.map){
            yield [
                entry.key,
                entry.value
            ];
        }
    }
}
exports.EndpointMap = EndpointMap; //# sourceMappingURL=subchannel-address.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/admin.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2021 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.addAdminServicesToServer = exports.registerAdminService = void 0;
const registeredAdminServices = [];
function registerAdminService(getServiceDefinition, getHandlers) {
    registeredAdminServices.push({
        getServiceDefinition,
        getHandlers
    });
}
exports.registerAdminService = registerAdminService;
function addAdminServicesToServer(server) {
    for (const { getServiceDefinition, getHandlers } of registeredAdminServices){
        server.addService(getServiceDefinition(), getHandlers());
    }
}
exports.addAdminServicesToServer = addAdminServicesToServer; //# sourceMappingURL=admin.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/call.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ClientDuplexStreamImpl = exports.ClientWritableStreamImpl = exports.ClientReadableStreamImpl = exports.ClientUnaryCallImpl = exports.callErrorFromStatus = void 0;
const events_1 = __turbopack_require__("[externals]/ [external] (events, cjs)");
const stream_1 = __turbopack_require__("[externals]/ [external] (stream, cjs)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
/**
 * Construct a ServiceError from a StatusObject. This function exists primarily
 * as an attempt to make the error stack trace clearly communicate that the
 * error is not necessarily a problem in gRPC itself.
 * @param status
 */ function callErrorFromStatus(status, callerStack) {
    const message = `${status.code} ${constants_1.Status[status.code]}: ${status.details}`;
    const error = new Error(message);
    const stack = `${error.stack}\nfor call at\n${callerStack}`;
    return Object.assign(new Error(message), status, {
        stack
    });
}
exports.callErrorFromStatus = callErrorFromStatus;
class ClientUnaryCallImpl extends events_1.EventEmitter {
    constructor(){
        super();
    }
    cancel() {
        var _a;
        (_a = this.call) === null || _a === void 0 ? void 0 : _a.cancelWithStatus(constants_1.Status.CANCELLED, 'Cancelled on client');
    }
    getPeer() {
        var _a, _b;
        return (_b = (_a = this.call) === null || _a === void 0 ? void 0 : _a.getPeer()) !== null && _b !== void 0 ? _b : 'unknown';
    }
}
exports.ClientUnaryCallImpl = ClientUnaryCallImpl;
class ClientReadableStreamImpl extends stream_1.Readable {
    constructor(deserialize){
        super({
            objectMode: true
        });
        this.deserialize = deserialize;
    }
    cancel() {
        var _a;
        (_a = this.call) === null || _a === void 0 ? void 0 : _a.cancelWithStatus(constants_1.Status.CANCELLED, 'Cancelled on client');
    }
    getPeer() {
        var _a, _b;
        return (_b = (_a = this.call) === null || _a === void 0 ? void 0 : _a.getPeer()) !== null && _b !== void 0 ? _b : 'unknown';
    }
    _read(_size) {
        var _a;
        (_a = this.call) === null || _a === void 0 ? void 0 : _a.startRead();
    }
}
exports.ClientReadableStreamImpl = ClientReadableStreamImpl;
class ClientWritableStreamImpl extends stream_1.Writable {
    constructor(serialize){
        super({
            objectMode: true
        });
        this.serialize = serialize;
    }
    cancel() {
        var _a;
        (_a = this.call) === null || _a === void 0 ? void 0 : _a.cancelWithStatus(constants_1.Status.CANCELLED, 'Cancelled on client');
    }
    getPeer() {
        var _a, _b;
        return (_b = (_a = this.call) === null || _a === void 0 ? void 0 : _a.getPeer()) !== null && _b !== void 0 ? _b : 'unknown';
    }
    _write(chunk, encoding, cb) {
        var _a;
        const context = {
            callback: cb
        };
        const flags = Number(encoding);
        if (!Number.isNaN(flags)) {
            context.flags = flags;
        }
        (_a = this.call) === null || _a === void 0 ? void 0 : _a.sendMessageWithContext(context, chunk);
    }
    _final(cb) {
        var _a;
        (_a = this.call) === null || _a === void 0 ? void 0 : _a.halfClose();
        cb();
    }
}
exports.ClientWritableStreamImpl = ClientWritableStreamImpl;
class ClientDuplexStreamImpl extends stream_1.Duplex {
    constructor(serialize, deserialize){
        super({
            objectMode: true
        });
        this.serialize = serialize;
        this.deserialize = deserialize;
    }
    cancel() {
        var _a;
        (_a = this.call) === null || _a === void 0 ? void 0 : _a.cancelWithStatus(constants_1.Status.CANCELLED, 'Cancelled on client');
    }
    getPeer() {
        var _a, _b;
        return (_b = (_a = this.call) === null || _a === void 0 ? void 0 : _a.getPeer()) !== null && _b !== void 0 ? _b : 'unknown';
    }
    _read(_size) {
        var _a;
        (_a = this.call) === null || _a === void 0 ? void 0 : _a.startRead();
    }
    _write(chunk, encoding, cb) {
        var _a;
        const context = {
            callback: cb
        };
        const flags = Number(encoding);
        if (!Number.isNaN(flags)) {
            context.flags = flags;
        }
        (_a = this.call) === null || _a === void 0 ? void 0 : _a.sendMessageWithContext(context, chunk);
    }
    _final(cb) {
        var _a;
        (_a = this.call) === null || _a === void 0 ? void 0 : _a.halfClose();
        cb();
    }
}
exports.ClientDuplexStreamImpl = ClientDuplexStreamImpl; //# sourceMappingURL=call.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/call-interface.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InterceptingListenerImpl = exports.isInterceptingListener = void 0;
function isInterceptingListener(listener) {
    return listener.onReceiveMetadata !== undefined && listener.onReceiveMetadata.length === 1;
}
exports.isInterceptingListener = isInterceptingListener;
class InterceptingListenerImpl {
    constructor(listener, nextListener){
        this.listener = listener;
        this.nextListener = nextListener;
        this.processingMetadata = false;
        this.hasPendingMessage = false;
        this.processingMessage = false;
        this.pendingStatus = null;
    }
    processPendingMessage() {
        if (this.hasPendingMessage) {
            this.nextListener.onReceiveMessage(this.pendingMessage);
            this.pendingMessage = null;
            this.hasPendingMessage = false;
        }
    }
    processPendingStatus() {
        if (this.pendingStatus) {
            this.nextListener.onReceiveStatus(this.pendingStatus);
        }
    }
    onReceiveMetadata(metadata) {
        this.processingMetadata = true;
        this.listener.onReceiveMetadata(metadata, (metadata)=>{
            this.processingMetadata = false;
            this.nextListener.onReceiveMetadata(metadata);
            this.processPendingMessage();
            this.processPendingStatus();
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onReceiveMessage(message) {
        /* If this listener processes messages asynchronously, the last message may
         * be reordered with respect to the status */ this.processingMessage = true;
        this.listener.onReceiveMessage(message, (msg)=>{
            this.processingMessage = false;
            if (this.processingMetadata) {
                this.pendingMessage = msg;
                this.hasPendingMessage = true;
            } else {
                this.nextListener.onReceiveMessage(msg);
                this.processPendingStatus();
            }
        });
    }
    onReceiveStatus(status) {
        this.listener.onReceiveStatus(status, (processedStatus)=>{
            if (this.processingMetadata || this.processingMessage) {
                this.pendingStatus = processedStatus;
            } else {
                this.nextListener.onReceiveStatus(processedStatus);
            }
        });
    }
}
exports.InterceptingListenerImpl = InterceptingListenerImpl; //# sourceMappingURL=call-interface.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/client-interceptors.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getInterceptingCall = exports.InterceptingCall = exports.RequesterBuilder = exports.ListenerBuilder = exports.InterceptorConfigurationError = void 0;
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const call_interface_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/call-interface.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const error_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/error.js [app-rsc] (ecmascript)");
/**
 * Error class associated with passing both interceptors and interceptor
 * providers to a client constructor or as call options.
 */ class InterceptorConfigurationError extends Error {
    constructor(message){
        super(message);
        this.name = 'InterceptorConfigurationError';
        Error.captureStackTrace(this, InterceptorConfigurationError);
    }
}
exports.InterceptorConfigurationError = InterceptorConfigurationError;
class ListenerBuilder {
    constructor(){
        this.metadata = undefined;
        this.message = undefined;
        this.status = undefined;
    }
    withOnReceiveMetadata(onReceiveMetadata) {
        this.metadata = onReceiveMetadata;
        return this;
    }
    withOnReceiveMessage(onReceiveMessage) {
        this.message = onReceiveMessage;
        return this;
    }
    withOnReceiveStatus(onReceiveStatus) {
        this.status = onReceiveStatus;
        return this;
    }
    build() {
        return {
            onReceiveMetadata: this.metadata,
            onReceiveMessage: this.message,
            onReceiveStatus: this.status
        };
    }
}
exports.ListenerBuilder = ListenerBuilder;
class RequesterBuilder {
    constructor(){
        this.start = undefined;
        this.message = undefined;
        this.halfClose = undefined;
        this.cancel = undefined;
    }
    withStart(start) {
        this.start = start;
        return this;
    }
    withSendMessage(sendMessage) {
        this.message = sendMessage;
        return this;
    }
    withHalfClose(halfClose) {
        this.halfClose = halfClose;
        return this;
    }
    withCancel(cancel) {
        this.cancel = cancel;
        return this;
    }
    build() {
        return {
            start: this.start,
            sendMessage: this.message,
            halfClose: this.halfClose,
            cancel: this.cancel
        };
    }
}
exports.RequesterBuilder = RequesterBuilder;
/**
 * A Listener with a default pass-through implementation of each method. Used
 * for filling out Listeners with some methods omitted.
 */ const defaultListener = {
    onReceiveMetadata: (metadata, next)=>{
        next(metadata);
    },
    onReceiveMessage: (message, next)=>{
        next(message);
    },
    onReceiveStatus: (status, next)=>{
        next(status);
    }
};
/**
 * A Requester with a default pass-through implementation of each method. Used
 * for filling out Requesters with some methods omitted.
 */ const defaultRequester = {
    start: (metadata, listener, next)=>{
        next(metadata, listener);
    },
    sendMessage: (message, next)=>{
        next(message);
    },
    halfClose: (next)=>{
        next();
    },
    cancel: (next)=>{
        next();
    }
};
class InterceptingCall {
    constructor(nextCall, requester){
        var _a, _b, _c, _d;
        this.nextCall = nextCall;
        /**
         * Indicates that metadata has been passed to the requester's start
         * method but it has not been passed to the corresponding next callback
         */ this.processingMetadata = false;
        /**
         * Message context for a pending message that is waiting for
         */ this.pendingMessageContext = null;
        /**
         * Indicates that a message has been passed to the requester's sendMessage
         * method but it has not been passed to the corresponding next callback
         */ this.processingMessage = false;
        /**
         * Indicates that a status was received but could not be propagated because
         * a message was still being processed.
         */ this.pendingHalfClose = false;
        if (requester) {
            this.requester = {
                start: (_a = requester.start) !== null && _a !== void 0 ? _a : defaultRequester.start,
                sendMessage: (_b = requester.sendMessage) !== null && _b !== void 0 ? _b : defaultRequester.sendMessage,
                halfClose: (_c = requester.halfClose) !== null && _c !== void 0 ? _c : defaultRequester.halfClose,
                cancel: (_d = requester.cancel) !== null && _d !== void 0 ? _d : defaultRequester.cancel
            };
        } else {
            this.requester = defaultRequester;
        }
    }
    cancelWithStatus(status, details) {
        this.requester.cancel(()=>{
            this.nextCall.cancelWithStatus(status, details);
        });
    }
    getPeer() {
        return this.nextCall.getPeer();
    }
    processPendingMessage() {
        if (this.pendingMessageContext) {
            this.nextCall.sendMessageWithContext(this.pendingMessageContext, this.pendingMessage);
            this.pendingMessageContext = null;
            this.pendingMessage = null;
        }
    }
    processPendingHalfClose() {
        if (this.pendingHalfClose) {
            this.nextCall.halfClose();
        }
    }
    start(metadata, interceptingListener) {
        var _a, _b, _c, _d, _e, _f;
        const fullInterceptingListener = {
            onReceiveMetadata: (_b = (_a = interceptingListener === null || interceptingListener === void 0 ? void 0 : interceptingListener.onReceiveMetadata) === null || _a === void 0 ? void 0 : _a.bind(interceptingListener)) !== null && _b !== void 0 ? _b : (metadata)=>{},
            onReceiveMessage: (_d = (_c = interceptingListener === null || interceptingListener === void 0 ? void 0 : interceptingListener.onReceiveMessage) === null || _c === void 0 ? void 0 : _c.bind(interceptingListener)) !== null && _d !== void 0 ? _d : (message)=>{},
            onReceiveStatus: (_f = (_e = interceptingListener === null || interceptingListener === void 0 ? void 0 : interceptingListener.onReceiveStatus) === null || _e === void 0 ? void 0 : _e.bind(interceptingListener)) !== null && _f !== void 0 ? _f : (status)=>{}
        };
        this.processingMetadata = true;
        this.requester.start(metadata, fullInterceptingListener, (md, listener)=>{
            var _a, _b, _c;
            this.processingMetadata = false;
            let finalInterceptingListener;
            if ((0, call_interface_1.isInterceptingListener)(listener)) {
                finalInterceptingListener = listener;
            } else {
                const fullListener = {
                    onReceiveMetadata: (_a = listener.onReceiveMetadata) !== null && _a !== void 0 ? _a : defaultListener.onReceiveMetadata,
                    onReceiveMessage: (_b = listener.onReceiveMessage) !== null && _b !== void 0 ? _b : defaultListener.onReceiveMessage,
                    onReceiveStatus: (_c = listener.onReceiveStatus) !== null && _c !== void 0 ? _c : defaultListener.onReceiveStatus
                };
                finalInterceptingListener = new call_interface_1.InterceptingListenerImpl(fullListener, fullInterceptingListener);
            }
            this.nextCall.start(md, finalInterceptingListener);
            this.processPendingMessage();
            this.processPendingHalfClose();
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendMessageWithContext(context, message) {
        this.processingMessage = true;
        this.requester.sendMessage(message, (finalMessage)=>{
            this.processingMessage = false;
            if (this.processingMetadata) {
                this.pendingMessageContext = context;
                this.pendingMessage = message;
            } else {
                this.nextCall.sendMessageWithContext(context, finalMessage);
                this.processPendingHalfClose();
            }
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendMessage(message) {
        this.sendMessageWithContext({}, message);
    }
    startRead() {
        this.nextCall.startRead();
    }
    halfClose() {
        this.requester.halfClose(()=>{
            if (this.processingMetadata || this.processingMessage) {
                this.pendingHalfClose = true;
            } else {
                this.nextCall.halfClose();
            }
        });
    }
}
exports.InterceptingCall = InterceptingCall;
function getCall(channel, path, options) {
    var _a, _b;
    const deadline = (_a = options.deadline) !== null && _a !== void 0 ? _a : Infinity;
    const host = options.host;
    const parent = (_b = options.parent) !== null && _b !== void 0 ? _b : null;
    const propagateFlags = options.propagate_flags;
    const credentials = options.credentials;
    const call = channel.createCall(path, deadline, host, parent, propagateFlags);
    if (credentials) {
        call.setCredentials(credentials);
    }
    return call;
}
/**
 * InterceptingCall implementation that directly owns the underlying Call
 * object and handles serialization and deseraizliation.
 */ class BaseInterceptingCall {
    constructor(call, // eslint-disable-next-line @typescript-eslint/no-explicit-any
    methodDefinition){
        this.call = call;
        this.methodDefinition = methodDefinition;
    }
    cancelWithStatus(status, details) {
        this.call.cancelWithStatus(status, details);
    }
    getPeer() {
        return this.call.getPeer();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendMessageWithContext(context, message) {
        let serialized;
        try {
            serialized = this.methodDefinition.requestSerialize(message);
        } catch (e) {
            this.call.cancelWithStatus(constants_1.Status.INTERNAL, `Request message serialization failure: ${(0, error_1.getErrorMessage)(e)}`);
            return;
        }
        this.call.sendMessageWithContext(context, serialized);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendMessage(message) {
        this.sendMessageWithContext({}, message);
    }
    start(metadata, interceptingListener) {
        let readError = null;
        this.call.start(metadata, {
            onReceiveMetadata: (metadata)=>{
                var _a;
                (_a = interceptingListener === null || interceptingListener === void 0 ? void 0 : interceptingListener.onReceiveMetadata) === null || _a === void 0 ? void 0 : _a.call(interceptingListener, metadata);
            },
            onReceiveMessage: (message)=>{
                var _a;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let deserialized;
                try {
                    deserialized = this.methodDefinition.responseDeserialize(message);
                } catch (e) {
                    readError = {
                        code: constants_1.Status.INTERNAL,
                        details: `Response message parsing error: ${(0, error_1.getErrorMessage)(e)}`,
                        metadata: new metadata_1.Metadata()
                    };
                    this.call.cancelWithStatus(readError.code, readError.details);
                    return;
                }
                (_a = interceptingListener === null || interceptingListener === void 0 ? void 0 : interceptingListener.onReceiveMessage) === null || _a === void 0 ? void 0 : _a.call(interceptingListener, deserialized);
            },
            onReceiveStatus: (status)=>{
                var _a, _b;
                if (readError) {
                    (_a = interceptingListener === null || interceptingListener === void 0 ? void 0 : interceptingListener.onReceiveStatus) === null || _a === void 0 ? void 0 : _a.call(interceptingListener, readError);
                } else {
                    (_b = interceptingListener === null || interceptingListener === void 0 ? void 0 : interceptingListener.onReceiveStatus) === null || _b === void 0 ? void 0 : _b.call(interceptingListener, status);
                }
            }
        });
    }
    startRead() {
        this.call.startRead();
    }
    halfClose() {
        this.call.halfClose();
    }
}
/**
 * BaseInterceptingCall with special-cased behavior for methods with unary
 * responses.
 */ class BaseUnaryInterceptingCall extends BaseInterceptingCall {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(call, methodDefinition){
        super(call, methodDefinition);
    }
    start(metadata, listener) {
        var _a, _b;
        let receivedMessage = false;
        const wrapperListener = {
            onReceiveMetadata: (_b = (_a = listener === null || listener === void 0 ? void 0 : listener.onReceiveMetadata) === null || _a === void 0 ? void 0 : _a.bind(listener)) !== null && _b !== void 0 ? _b : (metadata)=>{},
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onReceiveMessage: (message)=>{
                var _a;
                receivedMessage = true;
                (_a = listener === null || listener === void 0 ? void 0 : listener.onReceiveMessage) === null || _a === void 0 ? void 0 : _a.call(listener, message);
            },
            onReceiveStatus: (status)=>{
                var _a, _b;
                if (!receivedMessage) {
                    (_a = listener === null || listener === void 0 ? void 0 : listener.onReceiveMessage) === null || _a === void 0 ? void 0 : _a.call(listener, null);
                }
                (_b = listener === null || listener === void 0 ? void 0 : listener.onReceiveStatus) === null || _b === void 0 ? void 0 : _b.call(listener, status);
            }
        };
        super.start(metadata, wrapperListener);
        this.call.startRead();
    }
}
/**
 * BaseInterceptingCall with special-cased behavior for methods with streaming
 * responses.
 */ class BaseStreamingInterceptingCall extends BaseInterceptingCall {
}
function getBottomInterceptingCall(channel, options, // eslint-disable-next-line @typescript-eslint/no-explicit-any
methodDefinition) {
    const call = getCall(channel, methodDefinition.path, options);
    if (methodDefinition.responseStream) {
        return new BaseStreamingInterceptingCall(call, methodDefinition);
    } else {
        return new BaseUnaryInterceptingCall(call, methodDefinition);
    }
}
function getInterceptingCall(interceptorArgs, // eslint-disable-next-line @typescript-eslint/no-explicit-any
methodDefinition, options, channel) {
    if (interceptorArgs.clientInterceptors.length > 0 && interceptorArgs.clientInterceptorProviders.length > 0) {
        throw new InterceptorConfigurationError('Both interceptors and interceptor_providers were passed as options ' + 'to the client constructor. Only one of these is allowed.');
    }
    if (interceptorArgs.callInterceptors.length > 0 && interceptorArgs.callInterceptorProviders.length > 0) {
        throw new InterceptorConfigurationError('Both interceptors and interceptor_providers were passed as call ' + 'options. Only one of these is allowed.');
    }
    let interceptors = [];
    // Interceptors passed to the call override interceptors passed to the client constructor
    if (interceptorArgs.callInterceptors.length > 0 || interceptorArgs.callInterceptorProviders.length > 0) {
        interceptors = [].concat(interceptorArgs.callInterceptors, interceptorArgs.callInterceptorProviders.map((provider)=>provider(methodDefinition))).filter((interceptor)=>interceptor);
    // Filter out falsy values when providers return nothing
    } else {
        interceptors = [].concat(interceptorArgs.clientInterceptors, interceptorArgs.clientInterceptorProviders.map((provider)=>provider(methodDefinition))).filter((interceptor)=>interceptor);
    // Filter out falsy values when providers return nothing
    }
    const interceptorOptions = Object.assign({}, options, {
        method_definition: methodDefinition
    });
    /* For each interceptor in the list, the nextCall function passed to it is
     * based on the next interceptor in the list, using a nextCall function
     * constructed with the following interceptor in the list, and so on. The
     * initialValue, which is effectively at the end of the list, is a nextCall
     * function that invokes getBottomInterceptingCall, the result of which
     * handles (de)serialization and also gets the underlying call from the
     * channel. */ const getCall = interceptors.reduceRight((nextCall, nextInterceptor)=>{
        return (currentOptions)=>nextInterceptor(currentOptions, nextCall);
    }, (finalOptions)=>getBottomInterceptingCall(channel, finalOptions, methodDefinition));
    return getCall(interceptorOptions);
}
exports.getInterceptingCall = getInterceptingCall; //# sourceMappingURL=client-interceptors.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/client.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Client = void 0;
const call_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/call.js [app-rsc] (ecmascript)");
const channel_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channel.js [app-rsc] (ecmascript)");
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const client_interceptors_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/client-interceptors.js [app-rsc] (ecmascript)");
const CHANNEL_SYMBOL = Symbol();
const INTERCEPTOR_SYMBOL = Symbol();
const INTERCEPTOR_PROVIDER_SYMBOL = Symbol();
const CALL_INVOCATION_TRANSFORMER_SYMBOL = Symbol();
function isFunction(arg) {
    return typeof arg === 'function';
}
function getErrorStackString(error) {
    var _a;
    return ((_a = error.stack) === null || _a === void 0 ? void 0 : _a.split('\n').slice(1).join('\n')) || 'no stack trace available';
}
/**
 * A generic gRPC client. Primarily useful as a base class for all generated
 * clients.
 */ class Client {
    constructor(address, credentials, options = {}){
        var _a, _b;
        options = Object.assign({}, options);
        this[INTERCEPTOR_SYMBOL] = (_a = options.interceptors) !== null && _a !== void 0 ? _a : [];
        delete options.interceptors;
        this[INTERCEPTOR_PROVIDER_SYMBOL] = (_b = options.interceptor_providers) !== null && _b !== void 0 ? _b : [];
        delete options.interceptor_providers;
        if (this[INTERCEPTOR_SYMBOL].length > 0 && this[INTERCEPTOR_PROVIDER_SYMBOL].length > 0) {
            throw new Error('Both interceptors and interceptor_providers were passed as options ' + 'to the client constructor. Only one of these is allowed.');
        }
        this[CALL_INVOCATION_TRANSFORMER_SYMBOL] = options.callInvocationTransformer;
        delete options.callInvocationTransformer;
        if (options.channelOverride) {
            this[CHANNEL_SYMBOL] = options.channelOverride;
        } else if (options.channelFactoryOverride) {
            const channelFactoryOverride = options.channelFactoryOverride;
            delete options.channelFactoryOverride;
            this[CHANNEL_SYMBOL] = channelFactoryOverride(address, credentials, options);
        } else {
            this[CHANNEL_SYMBOL] = new channel_1.ChannelImplementation(address, credentials, options);
        }
    }
    close() {
        this[CHANNEL_SYMBOL].close();
    }
    getChannel() {
        return this[CHANNEL_SYMBOL];
    }
    waitForReady(deadline, callback) {
        const checkState = (err)=>{
            if (err) {
                callback(new Error('Failed to connect before the deadline'));
                return;
            }
            let newState;
            try {
                newState = this[CHANNEL_SYMBOL].getConnectivityState(true);
            } catch (e) {
                callback(new Error('The channel has been closed'));
                return;
            }
            if (newState === connectivity_state_1.ConnectivityState.READY) {
                callback();
            } else {
                try {
                    this[CHANNEL_SYMBOL].watchConnectivityState(newState, deadline, checkState);
                } catch (e) {
                    callback(new Error('The channel has been closed'));
                }
            }
        };
        setImmediate(checkState);
    }
    checkOptionalUnaryResponseArguments(arg1, arg2, arg3) {
        if (isFunction(arg1)) {
            return {
                metadata: new metadata_1.Metadata(),
                options: {},
                callback: arg1
            };
        } else if (isFunction(arg2)) {
            if (arg1 instanceof metadata_1.Metadata) {
                return {
                    metadata: arg1,
                    options: {},
                    callback: arg2
                };
            } else {
                return {
                    metadata: new metadata_1.Metadata(),
                    options: arg1,
                    callback: arg2
                };
            }
        } else {
            if (!(arg1 instanceof metadata_1.Metadata && arg2 instanceof Object && isFunction(arg3))) {
                throw new Error('Incorrect arguments passed');
            }
            return {
                metadata: arg1,
                options: arg2,
                callback: arg3
            };
        }
    }
    makeUnaryRequest(method, serialize, deserialize, argument, metadata, options, callback) {
        var _a, _b;
        const checkedArguments = this.checkOptionalUnaryResponseArguments(metadata, options, callback);
        const methodDefinition = {
            path: method,
            requestStream: false,
            responseStream: false,
            requestSerialize: serialize,
            responseDeserialize: deserialize
        };
        let callProperties = {
            argument: argument,
            metadata: checkedArguments.metadata,
            call: new call_1.ClientUnaryCallImpl(),
            channel: this[CHANNEL_SYMBOL],
            methodDefinition: methodDefinition,
            callOptions: checkedArguments.options,
            callback: checkedArguments.callback
        };
        if (this[CALL_INVOCATION_TRANSFORMER_SYMBOL]) {
            callProperties = this[CALL_INVOCATION_TRANSFORMER_SYMBOL](callProperties);
        }
        const emitter = callProperties.call;
        const interceptorArgs = {
            clientInterceptors: this[INTERCEPTOR_SYMBOL],
            clientInterceptorProviders: this[INTERCEPTOR_PROVIDER_SYMBOL],
            callInterceptors: (_a = callProperties.callOptions.interceptors) !== null && _a !== void 0 ? _a : [],
            callInterceptorProviders: (_b = callProperties.callOptions.interceptor_providers) !== null && _b !== void 0 ? _b : []
        };
        const call = (0, client_interceptors_1.getInterceptingCall)(interceptorArgs, callProperties.methodDefinition, callProperties.callOptions, callProperties.channel);
        /* This needs to happen before the emitter is used. Unfortunately we can't
         * enforce this with the type system. We need to construct this emitter
         * before calling the CallInvocationTransformer, and we need to create the
         * call after that. */ emitter.call = call;
        let responseMessage = null;
        let receivedStatus = false;
        let callerStackError = new Error();
        call.start(callProperties.metadata, {
            onReceiveMetadata: (metadata)=>{
                emitter.emit('metadata', metadata);
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onReceiveMessage (message) {
                if (responseMessage !== null) {
                    call.cancelWithStatus(constants_1.Status.UNIMPLEMENTED, 'Too many responses received');
                }
                responseMessage = message;
            },
            onReceiveStatus (status) {
                if (receivedStatus) {
                    return;
                }
                receivedStatus = true;
                if (status.code === constants_1.Status.OK) {
                    if (responseMessage === null) {
                        const callerStack = getErrorStackString(callerStackError);
                        callProperties.callback((0, call_1.callErrorFromStatus)({
                            code: constants_1.Status.UNIMPLEMENTED,
                            details: 'No message received',
                            metadata: status.metadata
                        }, callerStack));
                    } else {
                        callProperties.callback(null, responseMessage);
                    }
                } else {
                    const callerStack = getErrorStackString(callerStackError);
                    callProperties.callback((0, call_1.callErrorFromStatus)(status, callerStack));
                }
                /* Avoid retaining the callerStackError object in the call context of
                 * the status event handler. */ callerStackError = null;
                emitter.emit('status', status);
            }
        });
        call.sendMessage(argument);
        call.halfClose();
        return emitter;
    }
    makeClientStreamRequest(method, serialize, deserialize, metadata, options, callback) {
        var _a, _b;
        const checkedArguments = this.checkOptionalUnaryResponseArguments(metadata, options, callback);
        const methodDefinition = {
            path: method,
            requestStream: true,
            responseStream: false,
            requestSerialize: serialize,
            responseDeserialize: deserialize
        };
        let callProperties = {
            metadata: checkedArguments.metadata,
            call: new call_1.ClientWritableStreamImpl(serialize),
            channel: this[CHANNEL_SYMBOL],
            methodDefinition: methodDefinition,
            callOptions: checkedArguments.options,
            callback: checkedArguments.callback
        };
        if (this[CALL_INVOCATION_TRANSFORMER_SYMBOL]) {
            callProperties = this[CALL_INVOCATION_TRANSFORMER_SYMBOL](callProperties);
        }
        const emitter = callProperties.call;
        const interceptorArgs = {
            clientInterceptors: this[INTERCEPTOR_SYMBOL],
            clientInterceptorProviders: this[INTERCEPTOR_PROVIDER_SYMBOL],
            callInterceptors: (_a = callProperties.callOptions.interceptors) !== null && _a !== void 0 ? _a : [],
            callInterceptorProviders: (_b = callProperties.callOptions.interceptor_providers) !== null && _b !== void 0 ? _b : []
        };
        const call = (0, client_interceptors_1.getInterceptingCall)(interceptorArgs, callProperties.methodDefinition, callProperties.callOptions, callProperties.channel);
        /* This needs to happen before the emitter is used. Unfortunately we can't
         * enforce this with the type system. We need to construct this emitter
         * before calling the CallInvocationTransformer, and we need to create the
         * call after that. */ emitter.call = call;
        let responseMessage = null;
        let receivedStatus = false;
        let callerStackError = new Error();
        call.start(callProperties.metadata, {
            onReceiveMetadata: (metadata)=>{
                emitter.emit('metadata', metadata);
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onReceiveMessage (message) {
                if (responseMessage !== null) {
                    call.cancelWithStatus(constants_1.Status.UNIMPLEMENTED, 'Too many responses received');
                }
                responseMessage = message;
                call.startRead();
            },
            onReceiveStatus (status) {
                if (receivedStatus) {
                    return;
                }
                receivedStatus = true;
                if (status.code === constants_1.Status.OK) {
                    if (responseMessage === null) {
                        const callerStack = getErrorStackString(callerStackError);
                        callProperties.callback((0, call_1.callErrorFromStatus)({
                            code: constants_1.Status.UNIMPLEMENTED,
                            details: 'No message received',
                            metadata: status.metadata
                        }, callerStack));
                    } else {
                        callProperties.callback(null, responseMessage);
                    }
                } else {
                    const callerStack = getErrorStackString(callerStackError);
                    callProperties.callback((0, call_1.callErrorFromStatus)(status, callerStack));
                }
                /* Avoid retaining the callerStackError object in the call context of
                 * the status event handler. */ callerStackError = null;
                emitter.emit('status', status);
            }
        });
        return emitter;
    }
    checkMetadataAndOptions(arg1, arg2) {
        let metadata;
        let options;
        if (arg1 instanceof metadata_1.Metadata) {
            metadata = arg1;
            if (arg2) {
                options = arg2;
            } else {
                options = {};
            }
        } else {
            if (arg1) {
                options = arg1;
            } else {
                options = {};
            }
            metadata = new metadata_1.Metadata();
        }
        return {
            metadata,
            options
        };
    }
    makeServerStreamRequest(method, serialize, deserialize, argument, metadata, options) {
        var _a, _b;
        const checkedArguments = this.checkMetadataAndOptions(metadata, options);
        const methodDefinition = {
            path: method,
            requestStream: false,
            responseStream: true,
            requestSerialize: serialize,
            responseDeserialize: deserialize
        };
        let callProperties = {
            argument: argument,
            metadata: checkedArguments.metadata,
            call: new call_1.ClientReadableStreamImpl(deserialize),
            channel: this[CHANNEL_SYMBOL],
            methodDefinition: methodDefinition,
            callOptions: checkedArguments.options
        };
        if (this[CALL_INVOCATION_TRANSFORMER_SYMBOL]) {
            callProperties = this[CALL_INVOCATION_TRANSFORMER_SYMBOL](callProperties);
        }
        const stream = callProperties.call;
        const interceptorArgs = {
            clientInterceptors: this[INTERCEPTOR_SYMBOL],
            clientInterceptorProviders: this[INTERCEPTOR_PROVIDER_SYMBOL],
            callInterceptors: (_a = callProperties.callOptions.interceptors) !== null && _a !== void 0 ? _a : [],
            callInterceptorProviders: (_b = callProperties.callOptions.interceptor_providers) !== null && _b !== void 0 ? _b : []
        };
        const call = (0, client_interceptors_1.getInterceptingCall)(interceptorArgs, callProperties.methodDefinition, callProperties.callOptions, callProperties.channel);
        /* This needs to happen before the emitter is used. Unfortunately we can't
         * enforce this with the type system. We need to construct this emitter
         * before calling the CallInvocationTransformer, and we need to create the
         * call after that. */ stream.call = call;
        let receivedStatus = false;
        let callerStackError = new Error();
        call.start(callProperties.metadata, {
            onReceiveMetadata (metadata) {
                stream.emit('metadata', metadata);
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onReceiveMessage (message) {
                stream.push(message);
            },
            onReceiveStatus (status) {
                if (receivedStatus) {
                    return;
                }
                receivedStatus = true;
                stream.push(null);
                if (status.code !== constants_1.Status.OK) {
                    const callerStack = getErrorStackString(callerStackError);
                    stream.emit('error', (0, call_1.callErrorFromStatus)(status, callerStack));
                }
                /* Avoid retaining the callerStackError object in the call context of
                 * the status event handler. */ callerStackError = null;
                stream.emit('status', status);
            }
        });
        call.sendMessage(argument);
        call.halfClose();
        return stream;
    }
    makeBidiStreamRequest(method, serialize, deserialize, metadata, options) {
        var _a, _b;
        const checkedArguments = this.checkMetadataAndOptions(metadata, options);
        const methodDefinition = {
            path: method,
            requestStream: true,
            responseStream: true,
            requestSerialize: serialize,
            responseDeserialize: deserialize
        };
        let callProperties = {
            metadata: checkedArguments.metadata,
            call: new call_1.ClientDuplexStreamImpl(serialize, deserialize),
            channel: this[CHANNEL_SYMBOL],
            methodDefinition: methodDefinition,
            callOptions: checkedArguments.options
        };
        if (this[CALL_INVOCATION_TRANSFORMER_SYMBOL]) {
            callProperties = this[CALL_INVOCATION_TRANSFORMER_SYMBOL](callProperties);
        }
        const stream = callProperties.call;
        const interceptorArgs = {
            clientInterceptors: this[INTERCEPTOR_SYMBOL],
            clientInterceptorProviders: this[INTERCEPTOR_PROVIDER_SYMBOL],
            callInterceptors: (_a = callProperties.callOptions.interceptors) !== null && _a !== void 0 ? _a : [],
            callInterceptorProviders: (_b = callProperties.callOptions.interceptor_providers) !== null && _b !== void 0 ? _b : []
        };
        const call = (0, client_interceptors_1.getInterceptingCall)(interceptorArgs, callProperties.methodDefinition, callProperties.callOptions, callProperties.channel);
        /* This needs to happen before the emitter is used. Unfortunately we can't
         * enforce this with the type system. We need to construct this emitter
         * before calling the CallInvocationTransformer, and we need to create the
         * call after that. */ stream.call = call;
        let receivedStatus = false;
        let callerStackError = new Error();
        call.start(callProperties.metadata, {
            onReceiveMetadata (metadata) {
                stream.emit('metadata', metadata);
            },
            onReceiveMessage (message) {
                stream.push(message);
            },
            onReceiveStatus (status) {
                if (receivedStatus) {
                    return;
                }
                receivedStatus = true;
                stream.push(null);
                if (status.code !== constants_1.Status.OK) {
                    const callerStack = getErrorStackString(callerStackError);
                    stream.emit('error', (0, call_1.callErrorFromStatus)(status, callerStack));
                }
                /* Avoid retaining the callerStackError object in the call context of
                 * the status event handler. */ callerStackError = null;
                stream.emit('status', status);
            }
        });
        return stream;
    }
}
exports.Client = Client; //# sourceMappingURL=client.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/make-client.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.loadPackageDefinition = exports.makeClientConstructor = void 0;
const client_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/client.js [app-rsc] (ecmascript)");
/**
 * Map with short names for each of the requester maker functions. Used in
 * makeClientConstructor
 * @private
 */ const requesterFuncs = {
    unary: client_1.Client.prototype.makeUnaryRequest,
    server_stream: client_1.Client.prototype.makeServerStreamRequest,
    client_stream: client_1.Client.prototype.makeClientStreamRequest,
    bidi: client_1.Client.prototype.makeBidiStreamRequest
};
/**
 * Returns true, if given key is included in the blacklisted
 * keys.
 * @param key key for check, string.
 */ function isPrototypePolluted(key) {
    return [
        '__proto__',
        'prototype',
        'constructor'
    ].includes(key);
}
/**
 * Creates a constructor for a client with the given methods, as specified in
 * the methods argument. The resulting class will have an instance method for
 * each method in the service, which is a partial application of one of the
 * [Client]{@link grpc.Client} request methods, depending on `requestSerialize`
 * and `responseSerialize`, with the `method`, `serialize`, and `deserialize`
 * arguments predefined.
 * @param methods An object mapping method names to
 *     method attributes
 * @param serviceName The fully qualified name of the service
 * @param classOptions An options object.
 * @return New client constructor, which is a subclass of
 *     {@link grpc.Client}, and has the same arguments as that constructor.
 */ function makeClientConstructor(methods, serviceName, classOptions) {
    if (!classOptions) {
        classOptions = {};
    }
    class ServiceClientImpl extends client_1.Client {
    }
    Object.keys(methods).forEach((name)=>{
        if (isPrototypePolluted(name)) {
            return;
        }
        const attrs = methods[name];
        let methodType;
        // TODO(murgatroid99): Verify that we don't need this anymore
        if (typeof name === 'string' && name.charAt(0) === '$') {
            throw new Error('Method names cannot start with $');
        }
        if (attrs.requestStream) {
            if (attrs.responseStream) {
                methodType = 'bidi';
            } else {
                methodType = 'client_stream';
            }
        } else {
            if (attrs.responseStream) {
                methodType = 'server_stream';
            } else {
                methodType = 'unary';
            }
        }
        const serialize = attrs.requestSerialize;
        const deserialize = attrs.responseDeserialize;
        const methodFunc = partial(requesterFuncs[methodType], attrs.path, serialize, deserialize);
        ServiceClientImpl.prototype[name] = methodFunc;
        // Associate all provided attributes with the method
        Object.assign(ServiceClientImpl.prototype[name], attrs);
        if (attrs.originalName && !isPrototypePolluted(attrs.originalName)) {
            ServiceClientImpl.prototype[attrs.originalName] = ServiceClientImpl.prototype[name];
        }
    });
    ServiceClientImpl.service = methods;
    ServiceClientImpl.serviceName = serviceName;
    return ServiceClientImpl;
}
exports.makeClientConstructor = makeClientConstructor;
function partial(fn, path, serialize, deserialize) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function(...args) {
        return fn.call(this, path, serialize, deserialize, ...args);
    };
}
function isProtobufTypeDefinition(obj) {
    return 'format' in obj;
}
/**
 * Load a gRPC package definition as a gRPC object hierarchy.
 * @param packageDef The package definition object.
 * @return The resulting gRPC object.
 */ function loadPackageDefinition(packageDef) {
    const result = {};
    for(const serviceFqn in packageDef){
        if (Object.prototype.hasOwnProperty.call(packageDef, serviceFqn)) {
            const service = packageDef[serviceFqn];
            const nameComponents = serviceFqn.split('.');
            if (nameComponents.some((comp)=>isPrototypePolluted(comp))) {
                continue;
            }
            const serviceName = nameComponents[nameComponents.length - 1];
            let current = result;
            for (const packageName of nameComponents.slice(0, -1)){
                if (!current[packageName]) {
                    current[packageName] = {};
                }
                current = current[packageName];
            }
            if (isProtobufTypeDefinition(service)) {
                current[serviceName] = service;
            } else {
                current[serviceName] = makeClientConstructor(service, serviceName, {});
            }
        }
    }
    return result;
}
exports.loadPackageDefinition = loadPackageDefinition; //# sourceMappingURL=make-client.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channelz.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2021 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.setup = exports.getChannelzServiceDefinition = exports.getChannelzHandlers = exports.unregisterChannelzRef = exports.registerChannelzSocket = exports.registerChannelzServer = exports.registerChannelzSubchannel = exports.registerChannelzChannel = exports.ChannelzCallTrackerStub = exports.ChannelzCallTracker = exports.ChannelzChildrenTrackerStub = exports.ChannelzChildrenTracker = exports.ChannelzTrace = exports.ChannelzTraceStub = void 0;
const net_1 = __turbopack_require__("[externals]/ [external] (net, cjs)");
const ordered_map_1 = __turbopack_require__("[project]/node_modules/.pnpm/@js-sdsl+ordered-map@4.4.2/node_modules/@js-sdsl/ordered-map/dist/esm/index.js [app-rsc] (ecmascript)");
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const subchannel_address_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
const admin_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/admin.js [app-rsc] (ecmascript)");
const make_client_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/make-client.js [app-rsc] (ecmascript)");
function channelRefToMessage(ref) {
    return {
        channel_id: ref.id,
        name: ref.name
    };
}
function subchannelRefToMessage(ref) {
    return {
        subchannel_id: ref.id,
        name: ref.name
    };
}
function serverRefToMessage(ref) {
    return {
        server_id: ref.id
    };
}
function socketRefToMessage(ref) {
    return {
        socket_id: ref.id,
        name: ref.name
    };
}
/**
 * The loose upper bound on the number of events that should be retained in a
 * trace. This may be exceeded by up to a factor of 2. Arbitrarily chosen as a
 * number that should be large enough to contain the recent relevant
 * information, but small enough to not use excessive memory.
 */ const TARGET_RETAINED_TRACES = 32;
/**
 * Default number of sockets/servers/channels/subchannels to return
 */ const DEFAULT_MAX_RESULTS = 100;
class ChannelzTraceStub {
    constructor(){
        this.events = [];
        this.creationTimestamp = new Date();
        this.eventsLogged = 0;
    }
    addTrace() {}
    getTraceMessage() {
        return {
            creation_timestamp: dateToProtoTimestamp(this.creationTimestamp),
            num_events_logged: this.eventsLogged,
            events: []
        };
    }
}
exports.ChannelzTraceStub = ChannelzTraceStub;
class ChannelzTrace {
    constructor(){
        this.events = [];
        this.eventsLogged = 0;
        this.creationTimestamp = new Date();
    }
    addTrace(severity, description, child) {
        const timestamp = new Date();
        this.events.push({
            description: description,
            severity: severity,
            timestamp: timestamp,
            childChannel: (child === null || child === void 0 ? void 0 : child.kind) === 'channel' ? child : undefined,
            childSubchannel: (child === null || child === void 0 ? void 0 : child.kind) === 'subchannel' ? child : undefined
        });
        // Whenever the trace array gets too large, discard the first half
        if (this.events.length >= TARGET_RETAINED_TRACES * 2) {
            this.events = this.events.slice(TARGET_RETAINED_TRACES);
        }
        this.eventsLogged += 1;
    }
    getTraceMessage() {
        return {
            creation_timestamp: dateToProtoTimestamp(this.creationTimestamp),
            num_events_logged: this.eventsLogged,
            events: this.events.map((event)=>{
                return {
                    description: event.description,
                    severity: event.severity,
                    timestamp: dateToProtoTimestamp(event.timestamp),
                    channel_ref: event.childChannel ? channelRefToMessage(event.childChannel) : null,
                    subchannel_ref: event.childSubchannel ? subchannelRefToMessage(event.childSubchannel) : null
                };
            })
        };
    }
}
exports.ChannelzTrace = ChannelzTrace;
class ChannelzChildrenTracker {
    constructor(){
        this.channelChildren = new ordered_map_1.OrderedMap();
        this.subchannelChildren = new ordered_map_1.OrderedMap();
        this.socketChildren = new ordered_map_1.OrderedMap();
        this.trackerMap = {
            ["channel" /* EntityTypes.channel */ ]: this.channelChildren,
            ["subchannel" /* EntityTypes.subchannel */ ]: this.subchannelChildren,
            ["socket" /* EntityTypes.socket */ ]: this.socketChildren
        };
    }
    refChild(child) {
        const tracker = this.trackerMap[child.kind];
        const trackedChild = tracker.find(child.id);
        if (trackedChild.equals(tracker.end())) {
            tracker.setElement(child.id, {
                ref: child,
                count: 1
            }, trackedChild);
        } else {
            trackedChild.pointer[1].count += 1;
        }
    }
    unrefChild(child) {
        const tracker = this.trackerMap[child.kind];
        const trackedChild = tracker.getElementByKey(child.id);
        if (trackedChild !== undefined) {
            trackedChild.count -= 1;
            if (trackedChild.count === 0) {
                tracker.eraseElementByKey(child.id);
            }
        }
    }
    getChildLists() {
        return {
            channels: this.channelChildren,
            subchannels: this.subchannelChildren,
            sockets: this.socketChildren
        };
    }
}
exports.ChannelzChildrenTracker = ChannelzChildrenTracker;
class ChannelzChildrenTrackerStub extends ChannelzChildrenTracker {
    refChild() {}
    unrefChild() {}
}
exports.ChannelzChildrenTrackerStub = ChannelzChildrenTrackerStub;
class ChannelzCallTracker {
    constructor(){
        this.callsStarted = 0;
        this.callsSucceeded = 0;
        this.callsFailed = 0;
        this.lastCallStartedTimestamp = null;
    }
    addCallStarted() {
        this.callsStarted += 1;
        this.lastCallStartedTimestamp = new Date();
    }
    addCallSucceeded() {
        this.callsSucceeded += 1;
    }
    addCallFailed() {
        this.callsFailed += 1;
    }
}
exports.ChannelzCallTracker = ChannelzCallTracker;
class ChannelzCallTrackerStub extends ChannelzCallTracker {
    addCallStarted() {}
    addCallSucceeded() {}
    addCallFailed() {}
}
exports.ChannelzCallTrackerStub = ChannelzCallTrackerStub;
const entityMaps = {
    ["channel" /* EntityTypes.channel */ ]: new ordered_map_1.OrderedMap(),
    ["subchannel" /* EntityTypes.subchannel */ ]: new ordered_map_1.OrderedMap(),
    ["server" /* EntityTypes.server */ ]: new ordered_map_1.OrderedMap(),
    ["socket" /* EntityTypes.socket */ ]: new ordered_map_1.OrderedMap()
};
const generateRegisterFn = (kind)=>{
    let nextId = 1;
    function getNextId() {
        return nextId++;
    }
    const entityMap = entityMaps[kind];
    return (name, getInfo, channelzEnabled)=>{
        const id = getNextId();
        const ref = {
            id,
            name,
            kind
        };
        if (channelzEnabled) {
            entityMap.setElement(id, {
                ref,
                getInfo
            });
        }
        return ref;
    };
};
exports.registerChannelzChannel = generateRegisterFn("channel" /* EntityTypes.channel */ );
exports.registerChannelzSubchannel = generateRegisterFn("subchannel" /* EntityTypes.subchannel */ );
exports.registerChannelzServer = generateRegisterFn("server" /* EntityTypes.server */ );
exports.registerChannelzSocket = generateRegisterFn("socket" /* EntityTypes.socket */ );
function unregisterChannelzRef(ref) {
    entityMaps[ref.kind].eraseElementByKey(ref.id);
}
exports.unregisterChannelzRef = unregisterChannelzRef;
/**
 * Parse a single section of an IPv6 address as two bytes
 * @param addressSection A hexadecimal string of length up to 4
 * @returns The pair of bytes representing this address section
 */ function parseIPv6Section(addressSection) {
    const numberValue = Number.parseInt(addressSection, 16);
    return [
        numberValue / 256 | 0,
        numberValue % 256
    ];
}
/**
 * Parse a chunk of an IPv6 address string to some number of bytes
 * @param addressChunk Some number of segments of up to 4 hexadecimal
 *   characters each, joined by colons.
 * @returns The list of bytes representing this address chunk
 */ function parseIPv6Chunk(addressChunk) {
    if (addressChunk === '') {
        return [];
    }
    const bytePairs = addressChunk.split(':').map((section)=>parseIPv6Section(section));
    const result = [];
    return result.concat(...bytePairs);
}
/**
 * Converts an IPv4 or IPv6 address from string representation to binary
 * representation
 * @param ipAddress an IP address in standard IPv4 or IPv6 text format
 * @returns
 */ function ipAddressStringToBuffer(ipAddress) {
    if ((0, net_1.isIPv4)(ipAddress)) {
        return Buffer.from(Uint8Array.from(ipAddress.split('.').map((segment)=>Number.parseInt(segment))));
    } else if ((0, net_1.isIPv6)(ipAddress)) {
        let leftSection;
        let rightSection;
        const doubleColonIndex = ipAddress.indexOf('::');
        if (doubleColonIndex === -1) {
            leftSection = ipAddress;
            rightSection = '';
        } else {
            leftSection = ipAddress.substring(0, doubleColonIndex);
            rightSection = ipAddress.substring(doubleColonIndex + 2);
        }
        const leftBuffer = Buffer.from(parseIPv6Chunk(leftSection));
        const rightBuffer = Buffer.from(parseIPv6Chunk(rightSection));
        const middleBuffer = Buffer.alloc(16 - leftBuffer.length - rightBuffer.length, 0);
        return Buffer.concat([
            leftBuffer,
            middleBuffer,
            rightBuffer
        ]);
    } else {
        return null;
    }
}
function connectivityStateToMessage(state) {
    switch(state){
        case connectivity_state_1.ConnectivityState.CONNECTING:
            return {
                state: 'CONNECTING'
            };
        case connectivity_state_1.ConnectivityState.IDLE:
            return {
                state: 'IDLE'
            };
        case connectivity_state_1.ConnectivityState.READY:
            return {
                state: 'READY'
            };
        case connectivity_state_1.ConnectivityState.SHUTDOWN:
            return {
                state: 'SHUTDOWN'
            };
        case connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE:
            return {
                state: 'TRANSIENT_FAILURE'
            };
        default:
            return {
                state: 'UNKNOWN'
            };
    }
}
function dateToProtoTimestamp(date) {
    if (!date) {
        return null;
    }
    const millisSinceEpoch = date.getTime();
    return {
        seconds: millisSinceEpoch / 1000 | 0,
        nanos: millisSinceEpoch % 1000 * 1000000
    };
}
function getChannelMessage(channelEntry) {
    const resolvedInfo = channelEntry.getInfo();
    const channelRef = [];
    const subchannelRef = [];
    resolvedInfo.children.channels.forEach((el)=>{
        channelRef.push(channelRefToMessage(el[1].ref));
    });
    resolvedInfo.children.subchannels.forEach((el)=>{
        subchannelRef.push(subchannelRefToMessage(el[1].ref));
    });
    return {
        ref: channelRefToMessage(channelEntry.ref),
        data: {
            target: resolvedInfo.target,
            state: connectivityStateToMessage(resolvedInfo.state),
            calls_started: resolvedInfo.callTracker.callsStarted,
            calls_succeeded: resolvedInfo.callTracker.callsSucceeded,
            calls_failed: resolvedInfo.callTracker.callsFailed,
            last_call_started_timestamp: dateToProtoTimestamp(resolvedInfo.callTracker.lastCallStartedTimestamp),
            trace: resolvedInfo.trace.getTraceMessage()
        },
        channel_ref: channelRef,
        subchannel_ref: subchannelRef
    };
}
function GetChannel(call, callback) {
    const channelId = parseInt(call.request.channel_id, 10);
    const channelEntry = entityMaps["channel" /* EntityTypes.channel */ ].getElementByKey(channelId);
    if (channelEntry === undefined) {
        callback({
            code: constants_1.Status.NOT_FOUND,
            details: 'No channel data found for id ' + channelId
        });
        return;
    }
    callback(null, {
        channel: getChannelMessage(channelEntry)
    });
}
function GetTopChannels(call, callback) {
    const maxResults = parseInt(call.request.max_results, 10) || DEFAULT_MAX_RESULTS;
    const resultList = [];
    const startId = parseInt(call.request.start_channel_id, 10);
    const channelEntries = entityMaps["channel" /* EntityTypes.channel */ ];
    let i;
    for(i = channelEntries.lowerBound(startId); !i.equals(channelEntries.end()) && resultList.length < maxResults; i = i.next()){
        resultList.push(getChannelMessage(i.pointer[1]));
    }
    callback(null, {
        channel: resultList,
        end: i.equals(channelEntries.end())
    });
}
function getServerMessage(serverEntry) {
    const resolvedInfo = serverEntry.getInfo();
    const listenSocket = [];
    resolvedInfo.listenerChildren.sockets.forEach((el)=>{
        listenSocket.push(socketRefToMessage(el[1].ref));
    });
    return {
        ref: serverRefToMessage(serverEntry.ref),
        data: {
            calls_started: resolvedInfo.callTracker.callsStarted,
            calls_succeeded: resolvedInfo.callTracker.callsSucceeded,
            calls_failed: resolvedInfo.callTracker.callsFailed,
            last_call_started_timestamp: dateToProtoTimestamp(resolvedInfo.callTracker.lastCallStartedTimestamp),
            trace: resolvedInfo.trace.getTraceMessage()
        },
        listen_socket: listenSocket
    };
}
function GetServer(call, callback) {
    const serverId = parseInt(call.request.server_id, 10);
    const serverEntries = entityMaps["server" /* EntityTypes.server */ ];
    const serverEntry = serverEntries.getElementByKey(serverId);
    if (serverEntry === undefined) {
        callback({
            code: constants_1.Status.NOT_FOUND,
            details: 'No server data found for id ' + serverId
        });
        return;
    }
    callback(null, {
        server: getServerMessage(serverEntry)
    });
}
function GetServers(call, callback) {
    const maxResults = parseInt(call.request.max_results, 10) || DEFAULT_MAX_RESULTS;
    const startId = parseInt(call.request.start_server_id, 10);
    const serverEntries = entityMaps["server" /* EntityTypes.server */ ];
    const resultList = [];
    let i;
    for(i = serverEntries.lowerBound(startId); !i.equals(serverEntries.end()) && resultList.length < maxResults; i = i.next()){
        resultList.push(getServerMessage(i.pointer[1]));
    }
    callback(null, {
        server: resultList,
        end: i.equals(serverEntries.end())
    });
}
function GetSubchannel(call, callback) {
    const subchannelId = parseInt(call.request.subchannel_id, 10);
    const subchannelEntry = entityMaps["subchannel" /* EntityTypes.subchannel */ ].getElementByKey(subchannelId);
    if (subchannelEntry === undefined) {
        callback({
            code: constants_1.Status.NOT_FOUND,
            details: 'No subchannel data found for id ' + subchannelId
        });
        return;
    }
    const resolvedInfo = subchannelEntry.getInfo();
    const listenSocket = [];
    resolvedInfo.children.sockets.forEach((el)=>{
        listenSocket.push(socketRefToMessage(el[1].ref));
    });
    const subchannelMessage = {
        ref: subchannelRefToMessage(subchannelEntry.ref),
        data: {
            target: resolvedInfo.target,
            state: connectivityStateToMessage(resolvedInfo.state),
            calls_started: resolvedInfo.callTracker.callsStarted,
            calls_succeeded: resolvedInfo.callTracker.callsSucceeded,
            calls_failed: resolvedInfo.callTracker.callsFailed,
            last_call_started_timestamp: dateToProtoTimestamp(resolvedInfo.callTracker.lastCallStartedTimestamp),
            trace: resolvedInfo.trace.getTraceMessage()
        },
        socket_ref: listenSocket
    };
    callback(null, {
        subchannel: subchannelMessage
    });
}
function subchannelAddressToAddressMessage(subchannelAddress) {
    var _a;
    if ((0, subchannel_address_1.isTcpSubchannelAddress)(subchannelAddress)) {
        return {
            address: 'tcpip_address',
            tcpip_address: {
                ip_address: (_a = ipAddressStringToBuffer(subchannelAddress.host)) !== null && _a !== void 0 ? _a : undefined,
                port: subchannelAddress.port
            }
        };
    } else {
        return {
            address: 'uds_address',
            uds_address: {
                filename: subchannelAddress.path
            }
        };
    }
}
function GetSocket(call, callback) {
    var _a, _b, _c, _d, _e;
    const socketId = parseInt(call.request.socket_id, 10);
    const socketEntry = entityMaps["socket" /* EntityTypes.socket */ ].getElementByKey(socketId);
    if (socketEntry === undefined) {
        callback({
            code: constants_1.Status.NOT_FOUND,
            details: 'No socket data found for id ' + socketId
        });
        return;
    }
    const resolvedInfo = socketEntry.getInfo();
    const securityMessage = resolvedInfo.security ? {
        model: 'tls',
        tls: {
            cipher_suite: resolvedInfo.security.cipherSuiteStandardName ? 'standard_name' : 'other_name',
            standard_name: (_a = resolvedInfo.security.cipherSuiteStandardName) !== null && _a !== void 0 ? _a : undefined,
            other_name: (_b = resolvedInfo.security.cipherSuiteOtherName) !== null && _b !== void 0 ? _b : undefined,
            local_certificate: (_c = resolvedInfo.security.localCertificate) !== null && _c !== void 0 ? _c : undefined,
            remote_certificate: (_d = resolvedInfo.security.remoteCertificate) !== null && _d !== void 0 ? _d : undefined
        }
    } : null;
    const socketMessage = {
        ref: socketRefToMessage(socketEntry.ref),
        local: resolvedInfo.localAddress ? subchannelAddressToAddressMessage(resolvedInfo.localAddress) : null,
        remote: resolvedInfo.remoteAddress ? subchannelAddressToAddressMessage(resolvedInfo.remoteAddress) : null,
        remote_name: (_e = resolvedInfo.remoteName) !== null && _e !== void 0 ? _e : undefined,
        security: securityMessage,
        data: {
            keep_alives_sent: resolvedInfo.keepAlivesSent,
            streams_started: resolvedInfo.streamsStarted,
            streams_succeeded: resolvedInfo.streamsSucceeded,
            streams_failed: resolvedInfo.streamsFailed,
            last_local_stream_created_timestamp: dateToProtoTimestamp(resolvedInfo.lastLocalStreamCreatedTimestamp),
            last_remote_stream_created_timestamp: dateToProtoTimestamp(resolvedInfo.lastRemoteStreamCreatedTimestamp),
            messages_received: resolvedInfo.messagesReceived,
            messages_sent: resolvedInfo.messagesSent,
            last_message_received_timestamp: dateToProtoTimestamp(resolvedInfo.lastMessageReceivedTimestamp),
            last_message_sent_timestamp: dateToProtoTimestamp(resolvedInfo.lastMessageSentTimestamp),
            local_flow_control_window: resolvedInfo.localFlowControlWindow ? {
                value: resolvedInfo.localFlowControlWindow
            } : null,
            remote_flow_control_window: resolvedInfo.remoteFlowControlWindow ? {
                value: resolvedInfo.remoteFlowControlWindow
            } : null
        }
    };
    callback(null, {
        socket: socketMessage
    });
}
function GetServerSockets(call, callback) {
    const serverId = parseInt(call.request.server_id, 10);
    const serverEntry = entityMaps["server" /* EntityTypes.server */ ].getElementByKey(serverId);
    if (serverEntry === undefined) {
        callback({
            code: constants_1.Status.NOT_FOUND,
            details: 'No server data found for id ' + serverId
        });
        return;
    }
    const startId = parseInt(call.request.start_socket_id, 10);
    const maxResults = parseInt(call.request.max_results, 10) || DEFAULT_MAX_RESULTS;
    const resolvedInfo = serverEntry.getInfo();
    // If we wanted to include listener sockets in the result, this line would
    // instead say
    // const allSockets = resolvedInfo.listenerChildren.sockets.concat(resolvedInfo.sessionChildren.sockets).sort((ref1, ref2) => ref1.id - ref2.id);
    const allSockets = resolvedInfo.sessionChildren.sockets;
    const resultList = [];
    let i;
    for(i = allSockets.lowerBound(startId); !i.equals(allSockets.end()) && resultList.length < maxResults; i = i.next()){
        resultList.push(socketRefToMessage(i.pointer[1].ref));
    }
    callback(null, {
        socket_ref: resultList,
        end: i.equals(allSockets.end())
    });
}
function getChannelzHandlers() {
    return {
        GetChannel,
        GetTopChannels,
        GetServer,
        GetServers,
        GetSubchannel,
        GetSocket,
        GetServerSockets
    };
}
exports.getChannelzHandlers = getChannelzHandlers;
let loadedChannelzDefinition = null;
function getChannelzServiceDefinition() {
    if (loadedChannelzDefinition) {
        return loadedChannelzDefinition;
    }
    /* The purpose of this complexity is to avoid loading @grpc/proto-loader at
     * runtime for users who will not use/enable channelz. */ const loaderLoadSync = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+proto-loader@0.7.13/node_modules/@grpc/proto-loader/build/src/index.js [app-rsc] (ecmascript)").loadSync;
    const loadedProto = loaderLoadSync('channelz.proto', {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [
            `${__dirname}/../../proto`
        ]
    });
    const channelzGrpcObject = (0, make_client_1.loadPackageDefinition)(loadedProto);
    loadedChannelzDefinition = channelzGrpcObject.grpc.channelz.v1.Channelz.service;
    return loadedChannelzDefinition;
}
exports.getChannelzServiceDefinition = getChannelzServiceDefinition;
function setup() {
    (0, admin_1.registerAdminService)(getChannelzServiceDefinition, getChannelzHandlers);
}
exports.setup = setup; //# sourceMappingURL=channelz.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Subchannel = void 0;
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
const backoff_timeout_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/backoff-timeout.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const subchannel_address_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
const channelz_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channelz.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'subchannel';
/* setInterval and setTimeout only accept signed 32 bit integers. JS doesn't
 * have a constant for the max signed 32 bit integer, so this is a simple way
 * to calculate it */ const KEEPALIVE_MAX_TIME_MS = ~(1 << 31);
class Subchannel {
    /**
     * A class representing a connection to a single backend.
     * @param channelTarget The target string for the channel as a whole
     * @param subchannelAddress The address for the backend that this subchannel
     *     will connect to
     * @param options The channel options, plus any specific subchannel options
     *     for this subchannel
     * @param credentials The channel credentials used to establish this
     *     connection
     */ constructor(channelTarget, subchannelAddress, options, credentials, connector){
        var _a;
        this.channelTarget = channelTarget;
        this.subchannelAddress = subchannelAddress;
        this.options = options;
        this.credentials = credentials;
        this.connector = connector;
        /**
         * The subchannel's current connectivity state. Invariant: `session` === `null`
         * if and only if `connectivityState` is IDLE or TRANSIENT_FAILURE.
         */ this.connectivityState = connectivity_state_1.ConnectivityState.IDLE;
        /**
         * The underlying http2 session used to make requests.
         */ this.transport = null;
        /**
         * Indicates that the subchannel should transition from TRANSIENT_FAILURE to
         * CONNECTING instead of IDLE when the backoff timeout ends.
         */ this.continueConnecting = false;
        /**
         * A list of listener functions that will be called whenever the connectivity
         * state changes. Will be modified by `addConnectivityStateListener` and
         * `removeConnectivityStateListener`
         */ this.stateListeners = new Set();
        /**
         * Tracks channels and subchannel pools with references to this subchannel
         */ this.refcount = 0;
        // Channelz info
        this.channelzEnabled = true;
        const backoffOptions = {
            initialDelay: options['grpc.initial_reconnect_backoff_ms'],
            maxDelay: options['grpc.max_reconnect_backoff_ms']
        };
        this.backoffTimeout = new backoff_timeout_1.BackoffTimeout(()=>{
            this.handleBackoffTimer();
        }, backoffOptions);
        this.backoffTimeout.unref();
        this.subchannelAddressString = (0, subchannel_address_1.subchannelAddressToString)(subchannelAddress);
        this.keepaliveTime = (_a = options['grpc.keepalive_time_ms']) !== null && _a !== void 0 ? _a : -1;
        if (options['grpc.enable_channelz'] === 0) {
            this.channelzEnabled = false;
            this.channelzTrace = new channelz_1.ChannelzTraceStub();
            this.callTracker = new channelz_1.ChannelzCallTrackerStub();
            this.childrenTracker = new channelz_1.ChannelzChildrenTrackerStub();
            this.streamTracker = new channelz_1.ChannelzCallTrackerStub();
        } else {
            this.channelzTrace = new channelz_1.ChannelzTrace();
            this.callTracker = new channelz_1.ChannelzCallTracker();
            this.childrenTracker = new channelz_1.ChannelzChildrenTracker();
            this.streamTracker = new channelz_1.ChannelzCallTracker();
        }
        this.channelzRef = (0, channelz_1.registerChannelzSubchannel)(this.subchannelAddressString, ()=>this.getChannelzInfo(), this.channelzEnabled);
        this.channelzTrace.addTrace('CT_INFO', 'Subchannel created');
        this.trace('Subchannel constructed with options ' + JSON.stringify(options, undefined, 2));
        credentials._ref();
    }
    getChannelzInfo() {
        return {
            state: this.connectivityState,
            trace: this.channelzTrace,
            callTracker: this.callTracker,
            children: this.childrenTracker.getChildLists(),
            target: this.subchannelAddressString
        };
    }
    trace(text) {
        logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, '(' + this.channelzRef.id + ') ' + this.subchannelAddressString + ' ' + text);
    }
    refTrace(text) {
        logging.trace(constants_1.LogVerbosity.DEBUG, 'subchannel_refcount', '(' + this.channelzRef.id + ') ' + this.subchannelAddressString + ' ' + text);
    }
    handleBackoffTimer() {
        if (this.continueConnecting) {
            this.transitionToState([
                connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE
            ], connectivity_state_1.ConnectivityState.CONNECTING);
        } else {
            this.transitionToState([
                connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE
            ], connectivity_state_1.ConnectivityState.IDLE);
        }
    }
    /**
     * Start a backoff timer with the current nextBackoff timeout
     */ startBackoff() {
        this.backoffTimeout.runOnce();
    }
    stopBackoff() {
        this.backoffTimeout.stop();
        this.backoffTimeout.reset();
    }
    startConnectingInternal() {
        let options = this.options;
        if (options['grpc.keepalive_time_ms']) {
            const adjustedKeepaliveTime = Math.min(this.keepaliveTime, KEEPALIVE_MAX_TIME_MS);
            options = Object.assign(Object.assign({}, options), {
                'grpc.keepalive_time_ms': adjustedKeepaliveTime
            });
        }
        this.connector.connect(this.subchannelAddress, this.credentials, options).then((transport)=>{
            if (this.transitionToState([
                connectivity_state_1.ConnectivityState.CONNECTING
            ], connectivity_state_1.ConnectivityState.READY)) {
                this.transport = transport;
                if (this.channelzEnabled) {
                    this.childrenTracker.refChild(transport.getChannelzRef());
                }
                transport.addDisconnectListener((tooManyPings)=>{
                    this.transitionToState([
                        connectivity_state_1.ConnectivityState.READY
                    ], connectivity_state_1.ConnectivityState.IDLE);
                    if (tooManyPings && this.keepaliveTime > 0) {
                        this.keepaliveTime *= 2;
                        logging.log(constants_1.LogVerbosity.ERROR, `Connection to ${(0, uri_parser_1.uriToString)(this.channelTarget)} at ${this.subchannelAddressString} rejected by server because of excess pings. Increasing ping interval to ${this.keepaliveTime} ms`);
                    }
                });
            } else {
                /* If we can't transition from CONNECTING to READY here, we will
                 * not be using this transport, so release its resources. */ transport.shutdown();
            }
        }, (error)=>{
            this.transitionToState([
                connectivity_state_1.ConnectivityState.CONNECTING
            ], connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE, `${error}`);
        });
    }
    /**
     * Initiate a state transition from any element of oldStates to the new
     * state. If the current connectivityState is not in oldStates, do nothing.
     * @param oldStates The set of states to transition from
     * @param newState The state to transition to
     * @returns True if the state changed, false otherwise
     */ transitionToState(oldStates, newState, errorMessage) {
        var _a, _b;
        if (oldStates.indexOf(this.connectivityState) === -1) {
            return false;
        }
        if (errorMessage) {
            this.trace(connectivity_state_1.ConnectivityState[this.connectivityState] + ' -> ' + connectivity_state_1.ConnectivityState[newState] + ' with error "' + errorMessage + '"');
        } else {
            this.trace(connectivity_state_1.ConnectivityState[this.connectivityState] + ' -> ' + connectivity_state_1.ConnectivityState[newState]);
        }
        if (this.channelzEnabled) {
            this.channelzTrace.addTrace('CT_INFO', 'Connectivity state change to ' + connectivity_state_1.ConnectivityState[newState]);
        }
        const previousState = this.connectivityState;
        this.connectivityState = newState;
        switch(newState){
            case connectivity_state_1.ConnectivityState.READY:
                this.stopBackoff();
                break;
            case connectivity_state_1.ConnectivityState.CONNECTING:
                this.startBackoff();
                this.startConnectingInternal();
                this.continueConnecting = false;
                break;
            case connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE:
                if (this.channelzEnabled && this.transport) {
                    this.childrenTracker.unrefChild(this.transport.getChannelzRef());
                }
                (_a = this.transport) === null || _a === void 0 ? void 0 : _a.shutdown();
                this.transport = null;
                /* If the backoff timer has already ended by the time we get to the
                 * TRANSIENT_FAILURE state, we want to immediately transition out of
                 * TRANSIENT_FAILURE as though the backoff timer is ending right now */ if (!this.backoffTimeout.isRunning()) {
                    process.nextTick(()=>{
                        this.handleBackoffTimer();
                    });
                }
                break;
            case connectivity_state_1.ConnectivityState.IDLE:
                if (this.channelzEnabled && this.transport) {
                    this.childrenTracker.unrefChild(this.transport.getChannelzRef());
                }
                (_b = this.transport) === null || _b === void 0 ? void 0 : _b.shutdown();
                this.transport = null;
                break;
            default:
                throw new Error(`Invalid state: unknown ConnectivityState ${newState}`);
        }
        for (const listener of this.stateListeners){
            listener(this, previousState, newState, this.keepaliveTime, errorMessage);
        }
        return true;
    }
    ref() {
        this.refTrace('refcount ' + this.refcount + ' -> ' + (this.refcount + 1));
        this.refcount += 1;
    }
    unref() {
        this.refTrace('refcount ' + this.refcount + ' -> ' + (this.refcount - 1));
        this.refcount -= 1;
        if (this.refcount === 0) {
            this.channelzTrace.addTrace('CT_INFO', 'Shutting down');
            (0, channelz_1.unregisterChannelzRef)(this.channelzRef);
            this.credentials._unref();
            process.nextTick(()=>{
                this.transitionToState([
                    connectivity_state_1.ConnectivityState.CONNECTING,
                    connectivity_state_1.ConnectivityState.READY
                ], connectivity_state_1.ConnectivityState.IDLE);
            });
        }
    }
    unrefIfOneRef() {
        if (this.refcount === 1) {
            this.unref();
            return true;
        }
        return false;
    }
    createCall(metadata, host, method, listener) {
        if (!this.transport) {
            throw new Error('Cannot create call, subchannel not READY');
        }
        let statsTracker;
        if (this.channelzEnabled) {
            this.callTracker.addCallStarted();
            this.streamTracker.addCallStarted();
            statsTracker = {
                onCallEnd: (status)=>{
                    if (status.code === constants_1.Status.OK) {
                        this.callTracker.addCallSucceeded();
                    } else {
                        this.callTracker.addCallFailed();
                    }
                }
            };
        } else {
            statsTracker = {};
        }
        return this.transport.createCall(metadata, host, method, listener, statsTracker);
    }
    /**
     * If the subchannel is currently IDLE, start connecting and switch to the
     * CONNECTING state. If the subchannel is current in TRANSIENT_FAILURE,
     * the next time it would transition to IDLE, start connecting again instead.
     * Otherwise, do nothing.
     */ startConnecting() {
        process.nextTick(()=>{
            /* First, try to transition from IDLE to connecting. If that doesn't happen
             * because the state is not currently IDLE, check if it is
             * TRANSIENT_FAILURE, and if so indicate that it should go back to
             * connecting after the backoff timer ends. Otherwise do nothing */ if (!this.transitionToState([
                connectivity_state_1.ConnectivityState.IDLE
            ], connectivity_state_1.ConnectivityState.CONNECTING)) {
                if (this.connectivityState === connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE) {
                    this.continueConnecting = true;
                }
            }
        });
    }
    /**
     * Get the subchannel's current connectivity state.
     */ getConnectivityState() {
        return this.connectivityState;
    }
    /**
     * Add a listener function to be called whenever the subchannel's
     * connectivity state changes.
     * @param listener
     */ addConnectivityStateListener(listener) {
        this.stateListeners.add(listener);
    }
    /**
     * Remove a listener previously added with `addConnectivityStateListener`
     * @param listener A reference to a function previously passed to
     *     `addConnectivityStateListener`
     */ removeConnectivityStateListener(listener) {
        this.stateListeners.delete(listener);
    }
    /**
     * Reset the backoff timeout, and immediately start connecting if in backoff.
     */ resetBackoff() {
        process.nextTick(()=>{
            this.backoffTimeout.reset();
            this.transitionToState([
                connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE
            ], connectivity_state_1.ConnectivityState.CONNECTING);
        });
    }
    getAddress() {
        return this.subchannelAddressString;
    }
    getChannelzRef() {
        return this.channelzRef;
    }
    isHealthy() {
        return true;
    }
    addHealthStateWatcher(listener) {
    // Do nothing with the listener
    }
    removeHealthStateWatcher(listener) {
    // Do nothing with the listener
    }
    getRealSubchannel() {
        return this;
    }
    realSubchannelEquals(other) {
        return other.getRealSubchannel() === this;
    }
    throttleKeepalive(newKeepaliveTime) {
        if (newKeepaliveTime > this.keepaliveTime) {
            this.keepaliveTime = newKeepaliveTime;
        }
    }
}
exports.Subchannel = Subchannel; //# sourceMappingURL=subchannel.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/environment.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2024 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ var _a;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GRPC_NODE_USE_ALTERNATIVE_RESOLVER = void 0;
exports.GRPC_NODE_USE_ALTERNATIVE_RESOLVER = ((_a = process.env.GRPC_NODE_USE_ALTERNATIVE_RESOLVER) !== null && _a !== void 0 ? _a : 'false') === 'true'; //# sourceMappingURL=environment.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver-dns.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.setup = exports.DEFAULT_PORT = void 0;
const resolver_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver.js [app-rsc] (ecmascript)");
const dns_1 = __turbopack_require__("[externals]/ [external] (dns, cjs)");
const service_config_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/service-config.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const constants_2 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const net_1 = __turbopack_require__("[externals]/ [external] (net, cjs)");
const backoff_timeout_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/backoff-timeout.js [app-rsc] (ecmascript)");
const environment_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/environment.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'dns_resolver';
function trace(text) {
    logging.trace(constants_2.LogVerbosity.DEBUG, TRACER_NAME, text);
}
/**
 * The default TCP port to connect to if not explicitly specified in the target.
 */ exports.DEFAULT_PORT = 443;
const DEFAULT_MIN_TIME_BETWEEN_RESOLUTIONS_MS = 30000;
/**
 * Resolver implementation that handles DNS names and IP addresses.
 */ class DnsResolver {
    constructor(target, listener, channelOptions){
        var _a, _b, _c;
        this.target = target;
        this.listener = listener;
        this.pendingLookupPromise = null;
        this.pendingTxtPromise = null;
        this.latestLookupResult = null;
        this.latestServiceConfig = null;
        this.latestServiceConfigError = null;
        this.continueResolving = false;
        this.isNextResolutionTimerRunning = false;
        this.isServiceConfigEnabled = true;
        this.returnedIpResult = false;
        this.alternativeResolver = new dns_1.promises.Resolver();
        trace('Resolver constructed for target ' + (0, uri_parser_1.uriToString)(target));
        if (target.authority) {
            this.alternativeResolver.setServers([
                target.authority
            ]);
        }
        const hostPort = (0, uri_parser_1.splitHostPort)(target.path);
        if (hostPort === null) {
            this.ipResult = null;
            this.dnsHostname = null;
            this.port = null;
        } else {
            if ((0, net_1.isIPv4)(hostPort.host) || (0, net_1.isIPv6)(hostPort.host)) {
                this.ipResult = [
                    {
                        addresses: [
                            {
                                host: hostPort.host,
                                port: (_a = hostPort.port) !== null && _a !== void 0 ? _a : exports.DEFAULT_PORT
                            }
                        ]
                    }
                ];
                this.dnsHostname = null;
                this.port = null;
            } else {
                this.ipResult = null;
                this.dnsHostname = hostPort.host;
                this.port = (_b = hostPort.port) !== null && _b !== void 0 ? _b : exports.DEFAULT_PORT;
            }
        }
        this.percentage = Math.random() * 100;
        if (channelOptions['grpc.service_config_disable_resolution'] === 1) {
            this.isServiceConfigEnabled = false;
        }
        this.defaultResolutionError = {
            code: constants_1.Status.UNAVAILABLE,
            details: `Name resolution failed for target ${(0, uri_parser_1.uriToString)(this.target)}`,
            metadata: new metadata_1.Metadata()
        };
        const backoffOptions = {
            initialDelay: channelOptions['grpc.initial_reconnect_backoff_ms'],
            maxDelay: channelOptions['grpc.max_reconnect_backoff_ms']
        };
        this.backoff = new backoff_timeout_1.BackoffTimeout(()=>{
            if (this.continueResolving) {
                this.startResolutionWithBackoff();
            }
        }, backoffOptions);
        this.backoff.unref();
        this.minTimeBetweenResolutionsMs = (_c = channelOptions['grpc.dns_min_time_between_resolutions_ms']) !== null && _c !== void 0 ? _c : DEFAULT_MIN_TIME_BETWEEN_RESOLUTIONS_MS;
        this.nextResolutionTimer = setTimeout(()=>{}, 0);
        clearTimeout(this.nextResolutionTimer);
    }
    /**
     * If the target is an IP address, just provide that address as a result.
     * Otherwise, initiate A, AAAA, and TXT lookups
     */ startResolution() {
        if (this.ipResult !== null) {
            if (!this.returnedIpResult) {
                trace('Returning IP address for target ' + (0, uri_parser_1.uriToString)(this.target));
                setImmediate(()=>{
                    this.listener.onSuccessfulResolution(this.ipResult, null, null, null, {});
                });
                this.returnedIpResult = true;
            }
            this.backoff.stop();
            this.backoff.reset();
            this.stopNextResolutionTimer();
            return;
        }
        if (this.dnsHostname === null) {
            trace('Failed to parse DNS address ' + (0, uri_parser_1.uriToString)(this.target));
            setImmediate(()=>{
                this.listener.onError({
                    code: constants_1.Status.UNAVAILABLE,
                    details: `Failed to parse DNS address ${(0, uri_parser_1.uriToString)(this.target)}`,
                    metadata: new metadata_1.Metadata()
                });
            });
            this.stopNextResolutionTimer();
        } else {
            if (this.pendingLookupPromise !== null) {
                return;
            }
            trace('Looking up DNS hostname ' + this.dnsHostname);
            /* We clear out latestLookupResult here to ensure that it contains the
             * latest result since the last time we started resolving. That way, the
             * TXT resolution handler can use it, but only if it finishes second. We
             * don't clear out any previous service config results because it's
             * better to use a service config that's slightly out of date than to
             * revert to an effectively blank one. */ this.latestLookupResult = null;
            const hostname = this.dnsHostname;
            this.pendingLookupPromise = this.lookup(hostname);
            this.pendingLookupPromise.then((addressList)=>{
                if (this.pendingLookupPromise === null) {
                    return;
                }
                this.pendingLookupPromise = null;
                this.backoff.reset();
                this.backoff.stop();
                this.latestLookupResult = addressList.map((address)=>({
                        addresses: [
                            address
                        ]
                    }));
                const allAddressesString = '[' + addressList.map((addr)=>addr.host + ':' + addr.port).join(',') + ']';
                trace('Resolved addresses for target ' + (0, uri_parser_1.uriToString)(this.target) + ': ' + allAddressesString);
                if (this.latestLookupResult.length === 0) {
                    this.listener.onError(this.defaultResolutionError);
                    return;
                }
                /* If the TXT lookup has not yet finished, both of the last two
                 * arguments will be null, which is the equivalent of getting an
                 * empty TXT response. When the TXT lookup does finish, its handler
                 * can update the service config by using the same address list */ this.listener.onSuccessfulResolution(this.latestLookupResult, this.latestServiceConfig, this.latestServiceConfigError, null, {});
            }, (err)=>{
                if (this.pendingLookupPromise === null) {
                    return;
                }
                trace('Resolution error for target ' + (0, uri_parser_1.uriToString)(this.target) + ': ' + err.message);
                this.pendingLookupPromise = null;
                this.stopNextResolutionTimer();
                this.listener.onError(this.defaultResolutionError);
            });
            /* If there already is a still-pending TXT resolution, we can just use
             * that result when it comes in */ if (this.isServiceConfigEnabled && this.pendingTxtPromise === null) {
                /* We handle the TXT query promise differently than the others because
                 * the name resolution attempt as a whole is a success even if the TXT
                 * lookup fails */ this.pendingTxtPromise = this.resolveTxt(hostname);
                this.pendingTxtPromise.then((txtRecord)=>{
                    if (this.pendingTxtPromise === null) {
                        return;
                    }
                    this.pendingTxtPromise = null;
                    try {
                        this.latestServiceConfig = (0, service_config_1.extractAndSelectServiceConfig)(txtRecord, this.percentage);
                    } catch (err) {
                        this.latestServiceConfigError = {
                            code: constants_1.Status.UNAVAILABLE,
                            details: `Parsing service config failed with error ${err.message}`,
                            metadata: new metadata_1.Metadata()
                        };
                    }
                    if (this.latestLookupResult !== null) {
                        /* We rely here on the assumption that calling this function with
                         * identical parameters will be essentialy idempotent, and calling
                         * it with the same address list and a different service config
                         * should result in a fast and seamless switchover. */ this.listener.onSuccessfulResolution(this.latestLookupResult, this.latestServiceConfig, this.latestServiceConfigError, null, {});
                    }
                }, (err)=>{
                /* If TXT lookup fails we should do nothing, which means that we
                     * continue to use the result of the most recent successful lookup,
                     * or the default null config object if there has never been a
                     * successful lookup. We do not set the latestServiceConfigError
                     * here because that is specifically used for response validation
                     * errors. We still need to handle this error so that it does not
                     * bubble up as an unhandled promise rejection. */ });
            }
        }
    }
    async lookup(hostname) {
        if (environment_1.GRPC_NODE_USE_ALTERNATIVE_RESOLVER) {
            trace('Using alternative DNS resolver.');
            const records = await Promise.allSettled([
                this.alternativeResolver.resolve4(hostname),
                this.alternativeResolver.resolve6(hostname)
            ]);
            if (records.every((result)=>result.status === 'rejected')) {
                throw new Error(records[0].reason);
            }
            return records.reduce((acc, result)=>{
                return result.status === 'fulfilled' ? [
                    ...acc,
                    ...result.value
                ] : acc;
            }, []).map((addr)=>({
                    host: addr,
                    port: +this.port
                }));
        }
        /* We lookup both address families here and then split them up later
         * because when looking up a single family, dns.lookup outputs an error
         * if the name exists but there are no records for that family, and that
         * error is indistinguishable from other kinds of errors */ const addressList = await dns_1.promises.lookup(hostname, {
            all: true
        });
        return addressList.map((addr)=>({
                host: addr.address,
                port: +this.port
            }));
    }
    async resolveTxt(hostname) {
        if (environment_1.GRPC_NODE_USE_ALTERNATIVE_RESOLVER) {
            trace('Using alternative DNS resolver.');
            return this.alternativeResolver.resolveTxt(hostname);
        }
        return dns_1.promises.resolveTxt(hostname);
    }
    startNextResolutionTimer() {
        var _a, _b;
        clearTimeout(this.nextResolutionTimer);
        this.nextResolutionTimer = setTimeout(()=>{
            this.stopNextResolutionTimer();
            if (this.continueResolving) {
                this.startResolutionWithBackoff();
            }
        }, this.minTimeBetweenResolutionsMs);
        (_b = (_a = this.nextResolutionTimer).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
        this.isNextResolutionTimerRunning = true;
    }
    stopNextResolutionTimer() {
        clearTimeout(this.nextResolutionTimer);
        this.isNextResolutionTimerRunning = false;
    }
    startResolutionWithBackoff() {
        if (this.pendingLookupPromise === null) {
            this.continueResolving = false;
            this.backoff.runOnce();
            this.startNextResolutionTimer();
            this.startResolution();
        }
    }
    updateResolution() {
        /* If there is a pending lookup, just let it finish. Otherwise, if the
         * nextResolutionTimer or backoff timer is running, set the
         * continueResolving flag to resolve when whichever of those timers
         * fires. Otherwise, start resolving immediately. */ if (this.pendingLookupPromise === null) {
            if (this.isNextResolutionTimerRunning || this.backoff.isRunning()) {
                if (this.isNextResolutionTimerRunning) {
                    trace('resolution update delayed by "min time between resolutions" rate limit');
                } else {
                    trace('resolution update delayed by backoff timer until ' + this.backoff.getEndTime().toISOString());
                }
                this.continueResolving = true;
            } else {
                this.startResolutionWithBackoff();
            }
        }
    }
    /**
     * Reset the resolver to the same state it had when it was created. In-flight
     * DNS requests cannot be cancelled, but they are discarded and their results
     * will be ignored.
     */ destroy() {
        this.continueResolving = false;
        this.backoff.reset();
        this.backoff.stop();
        this.stopNextResolutionTimer();
        this.pendingLookupPromise = null;
        this.pendingTxtPromise = null;
        this.latestLookupResult = null;
        this.latestServiceConfig = null;
        this.latestServiceConfigError = null;
        this.returnedIpResult = false;
    }
    /**
     * Get the default authority for the given target. For IP targets, that is
     * the IP address. For DNS targets, it is the hostname.
     * @param target
     */ static getDefaultAuthority(target) {
        return target.path;
    }
}
/**
 * Set up the DNS resolver class by registering it as the handler for the
 * "dns:" prefix and as the default resolver.
 */ function setup() {
    (0, resolver_1.registerResolver)('dns', DnsResolver);
    (0, resolver_1.registerDefaultScheme)('dns');
}
exports.setup = setup; //# sourceMappingURL=resolver-dns.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/http_proxy.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getProxiedConnection = exports.mapProxyName = void 0;
const logging_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const resolver_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver.js [app-rsc] (ecmascript)");
const http = __turbopack_require__("[externals]/ [external] (http, cjs)");
const tls = __turbopack_require__("[externals]/ [external] (tls, cjs)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const subchannel_address_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const url_1 = __turbopack_require__("[externals]/ [external] (url, cjs)");
const resolver_dns_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver-dns.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'proxy';
function trace(text) {
    logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, text);
}
function getProxyInfo() {
    let proxyEnv = '';
    let envVar = '';
    /* Prefer using 'grpc_proxy'. Fallback on 'http_proxy' if it is not set.
     * Also prefer using 'https_proxy' with fallback on 'http_proxy'. The
     * fallback behavior can be removed if there's a demand for it.
     */ if (process.env.grpc_proxy) {
        envVar = 'grpc_proxy';
        proxyEnv = process.env.grpc_proxy;
    } else if (process.env.https_proxy) {
        envVar = 'https_proxy';
        proxyEnv = process.env.https_proxy;
    } else if (process.env.http_proxy) {
        envVar = 'http_proxy';
        proxyEnv = process.env.http_proxy;
    } else {
        return {};
    }
    let proxyUrl;
    try {
        proxyUrl = new url_1.URL(proxyEnv);
    } catch (e) {
        (0, logging_1.log)(constants_1.LogVerbosity.ERROR, `cannot parse value of "${envVar}" env var`);
        return {};
    }
    if (proxyUrl.protocol !== 'http:') {
        (0, logging_1.log)(constants_1.LogVerbosity.ERROR, `"${proxyUrl.protocol}" scheme not supported in proxy URI`);
        return {};
    }
    let userCred = null;
    if (proxyUrl.username) {
        if (proxyUrl.password) {
            (0, logging_1.log)(constants_1.LogVerbosity.INFO, 'userinfo found in proxy URI');
            userCred = decodeURIComponent(`${proxyUrl.username}:${proxyUrl.password}`);
        } else {
            userCred = proxyUrl.username;
        }
    }
    const hostname = proxyUrl.hostname;
    let port = proxyUrl.port;
    /* The proxy URL uses the scheme "http:", which has a default port number of
     * 80. We need to set that explicitly here if it is omitted because otherwise
     * it will use gRPC's default port 443. */ if (port === '') {
        port = '80';
    }
    const result = {
        address: `${hostname}:${port}`
    };
    if (userCred) {
        result.creds = userCred;
    }
    trace('Proxy server ' + result.address + ' set by environment variable ' + envVar);
    return result;
}
function getNoProxyHostList() {
    /* Prefer using 'no_grpc_proxy'. Fallback on 'no_proxy' if it is not set. */ let noProxyStr = process.env.no_grpc_proxy;
    let envVar = 'no_grpc_proxy';
    if (!noProxyStr) {
        noProxyStr = process.env.no_proxy;
        envVar = 'no_proxy';
    }
    if (noProxyStr) {
        trace('No proxy server list set by environment variable ' + envVar);
        return noProxyStr.split(',');
    } else {
        return [];
    }
}
function mapProxyName(target, options) {
    var _a;
    const noProxyResult = {
        target: target,
        extraOptions: {}
    };
    if (((_a = options['grpc.enable_http_proxy']) !== null && _a !== void 0 ? _a : 1) === 0) {
        return noProxyResult;
    }
    if (target.scheme === 'unix') {
        return noProxyResult;
    }
    const proxyInfo = getProxyInfo();
    if (!proxyInfo.address) {
        return noProxyResult;
    }
    const hostPort = (0, uri_parser_1.splitHostPort)(target.path);
    if (!hostPort) {
        return noProxyResult;
    }
    const serverHost = hostPort.host;
    for (const host of getNoProxyHostList()){
        if (host === serverHost) {
            trace('Not using proxy for target in no_proxy list: ' + (0, uri_parser_1.uriToString)(target));
            return noProxyResult;
        }
    }
    const extraOptions = {
        'grpc.http_connect_target': (0, uri_parser_1.uriToString)(target)
    };
    if (proxyInfo.creds) {
        extraOptions['grpc.http_connect_creds'] = proxyInfo.creds;
    }
    return {
        target: {
            scheme: 'dns',
            path: proxyInfo.address
        },
        extraOptions: extraOptions
    };
}
exports.mapProxyName = mapProxyName;
function getProxiedConnection(address, channelOptions, connectionOptions) {
    var _a;
    if (!('grpc.http_connect_target' in channelOptions)) {
        return Promise.resolve({});
    }
    const realTarget = channelOptions['grpc.http_connect_target'];
    const parsedTarget = (0, uri_parser_1.parseUri)(realTarget);
    if (parsedTarget === null) {
        return Promise.resolve({});
    }
    const splitHostPost = (0, uri_parser_1.splitHostPort)(parsedTarget.path);
    if (splitHostPost === null) {
        return Promise.resolve({});
    }
    const hostPort = `${splitHostPost.host}:${(_a = splitHostPost.port) !== null && _a !== void 0 ? _a : resolver_dns_1.DEFAULT_PORT}`;
    const options = {
        method: 'CONNECT',
        path: hostPort
    };
    const headers = {
        Host: hostPort
    };
    // Connect to the subchannel address as a proxy
    if ((0, subchannel_address_1.isTcpSubchannelAddress)(address)) {
        options.host = address.host;
        options.port = address.port;
    } else {
        options.socketPath = address.path;
    }
    if ('grpc.http_connect_creds' in channelOptions) {
        headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(channelOptions['grpc.http_connect_creds']).toString('base64');
    }
    options.headers = headers;
    const proxyAddressString = (0, subchannel_address_1.subchannelAddressToString)(address);
    trace('Using proxy ' + proxyAddressString + ' to connect to ' + options.path);
    return new Promise((resolve, reject)=>{
        const request = http.request(options);
        request.once('connect', (res, socket, head)=>{
            var _a;
            request.removeAllListeners();
            socket.removeAllListeners();
            if (res.statusCode === 200) {
                trace('Successfully connected to ' + options.path + ' through proxy ' + proxyAddressString);
                // The HTTP client may have already read a few bytes of the proxied
                // connection. If that's the case, put them back into the socket.
                // See https://github.com/grpc/grpc-node/issues/2744.
                if (head.length > 0) {
                    socket.unshift(head);
                }
                if ('secureContext' in connectionOptions) {
                    /* The proxy is connecting to a TLS server, so upgrade this socket
                     * connection to a TLS connection.
                     * This is a workaround for https://github.com/nodejs/node/issues/32922
                     * See https://github.com/grpc/grpc-node/pull/1369 for more info. */ const targetPath = (0, resolver_1.getDefaultAuthority)(parsedTarget);
                    const hostPort = (0, uri_parser_1.splitHostPort)(targetPath);
                    const remoteHost = (_a = hostPort === null || hostPort === void 0 ? void 0 : hostPort.host) !== null && _a !== void 0 ? _a : targetPath;
                    const cts = tls.connect(Object.assign({
                        host: remoteHost,
                        servername: remoteHost,
                        socket: socket
                    }, connectionOptions), ()=>{
                        trace('Successfully established a TLS connection to ' + options.path + ' through proxy ' + proxyAddressString);
                        resolve({
                            socket: cts,
                            realTarget: parsedTarget
                        });
                    });
                    cts.on('error', (error)=>{
                        trace('Failed to establish a TLS connection to ' + options.path + ' through proxy ' + proxyAddressString + ' with error ' + error.message);
                        reject();
                    });
                } else {
                    trace('Successfully established a plaintext connection to ' + options.path + ' through proxy ' + proxyAddressString);
                    resolve({
                        socket,
                        realTarget: parsedTarget
                    });
                }
            } else {
                (0, logging_1.log)(constants_1.LogVerbosity.ERROR, 'Failed to connect to ' + options.path + ' through proxy ' + proxyAddressString + ' with status ' + res.statusCode);
                reject();
            }
        });
        request.once('error', (err)=>{
            request.removeAllListeners();
            (0, logging_1.log)(constants_1.LogVerbosity.ERROR, 'Failed to connect to proxy ' + proxyAddressString + ' with error ' + err.message);
            reject();
        });
        request.end();
    });
}
exports.getProxiedConnection = getProxiedConnection; //# sourceMappingURL=http_proxy.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/stream-decoder.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.StreamDecoder = void 0;
var ReadState;
(function(ReadState) {
    ReadState[ReadState["NO_DATA"] = 0] = "NO_DATA";
    ReadState[ReadState["READING_SIZE"] = 1] = "READING_SIZE";
    ReadState[ReadState["READING_MESSAGE"] = 2] = "READING_MESSAGE";
})(ReadState || (ReadState = {}));
class StreamDecoder {
    constructor(maxReadMessageLength){
        this.maxReadMessageLength = maxReadMessageLength;
        this.readState = ReadState.NO_DATA;
        this.readCompressFlag = Buffer.alloc(1);
        this.readPartialSize = Buffer.alloc(4);
        this.readSizeRemaining = 4;
        this.readMessageSize = 0;
        this.readPartialMessage = [];
        this.readMessageRemaining = 0;
    }
    write(data) {
        let readHead = 0;
        let toRead;
        const result = [];
        while(readHead < data.length){
            switch(this.readState){
                case ReadState.NO_DATA:
                    this.readCompressFlag = data.slice(readHead, readHead + 1);
                    readHead += 1;
                    this.readState = ReadState.READING_SIZE;
                    this.readPartialSize.fill(0);
                    this.readSizeRemaining = 4;
                    this.readMessageSize = 0;
                    this.readMessageRemaining = 0;
                    this.readPartialMessage = [];
                    break;
                case ReadState.READING_SIZE:
                    toRead = Math.min(data.length - readHead, this.readSizeRemaining);
                    data.copy(this.readPartialSize, 4 - this.readSizeRemaining, readHead, readHead + toRead);
                    this.readSizeRemaining -= toRead;
                    readHead += toRead;
                    // readSizeRemaining >=0 here
                    if (this.readSizeRemaining === 0) {
                        this.readMessageSize = this.readPartialSize.readUInt32BE(0);
                        if (this.maxReadMessageLength !== -1 && this.readMessageSize > this.maxReadMessageLength) {
                            throw new Error(`Received message larger than max (${this.readMessageSize} vs ${this.maxReadMessageLength})`);
                        }
                        this.readMessageRemaining = this.readMessageSize;
                        if (this.readMessageRemaining > 0) {
                            this.readState = ReadState.READING_MESSAGE;
                        } else {
                            const message = Buffer.concat([
                                this.readCompressFlag,
                                this.readPartialSize
                            ], 5);
                            this.readState = ReadState.NO_DATA;
                            result.push(message);
                        }
                    }
                    break;
                case ReadState.READING_MESSAGE:
                    toRead = Math.min(data.length - readHead, this.readMessageRemaining);
                    this.readPartialMessage.push(data.slice(readHead, readHead + toRead));
                    this.readMessageRemaining -= toRead;
                    readHead += toRead;
                    // readMessageRemaining >=0 here
                    if (this.readMessageRemaining === 0) {
                        // At this point, we have read a full message
                        const framedMessageBuffers = [
                            this.readCompressFlag,
                            this.readPartialSize
                        ].concat(this.readPartialMessage);
                        const framedMessage = Buffer.concat(framedMessageBuffers, this.readMessageSize + 5);
                        this.readState = ReadState.NO_DATA;
                        result.push(framedMessage);
                    }
                    break;
                default:
                    throw new Error('Unexpected read state');
            }
        }
        return result;
    }
}
exports.StreamDecoder = StreamDecoder; //# sourceMappingURL=stream-decoder.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-call.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Http2SubchannelCall = void 0;
const http2 = __turbopack_require__("[externals]/ [external] (http2, cjs)");
const os = __turbopack_require__("[externals]/ [external] (os, cjs)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const stream_decoder_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/stream-decoder.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const constants_2 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'subchannel_call';
/**
 * Should do approximately the same thing as util.getSystemErrorName but the
 * TypeScript types don't have that function for some reason so I just made my
 * own.
 * @param errno
 */ function getSystemErrorName(errno) {
    for (const [name, num] of Object.entries(os.constants.errno)){
        if (num === errno) {
            return name;
        }
    }
    return 'Unknown system error ' + errno;
}
function mapHttpStatusCode(code) {
    const details = `Received HTTP status code ${code}`;
    let mappedStatusCode;
    switch(code){
        // TODO(murgatroid99): handle 100 and 101
        case 400:
            mappedStatusCode = constants_1.Status.INTERNAL;
            break;
        case 401:
            mappedStatusCode = constants_1.Status.UNAUTHENTICATED;
            break;
        case 403:
            mappedStatusCode = constants_1.Status.PERMISSION_DENIED;
            break;
        case 404:
            mappedStatusCode = constants_1.Status.UNIMPLEMENTED;
            break;
        case 429:
        case 502:
        case 503:
        case 504:
            mappedStatusCode = constants_1.Status.UNAVAILABLE;
            break;
        default:
            mappedStatusCode = constants_1.Status.UNKNOWN;
    }
    return {
        code: mappedStatusCode,
        details: details,
        metadata: new metadata_1.Metadata()
    };
}
class Http2SubchannelCall {
    constructor(http2Stream, callEventTracker, listener, transport, callId){
        var _a;
        this.http2Stream = http2Stream;
        this.callEventTracker = callEventTracker;
        this.listener = listener;
        this.transport = transport;
        this.callId = callId;
        this.isReadFilterPending = false;
        this.isPushPending = false;
        this.canPush = false;
        /**
         * Indicates that an 'end' event has come from the http2 stream, so there
         * will be no more data events.
         */ this.readsClosed = false;
        this.statusOutput = false;
        this.unpushedReadMessages = [];
        // This is populated (non-null) if and only if the call has ended
        this.finalStatus = null;
        this.internalError = null;
        this.serverEndedCall = false;
        this.connectionDropped = false;
        const maxReceiveMessageLength = (_a = transport.getOptions()['grpc.max_receive_message_length']) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_MAX_RECEIVE_MESSAGE_LENGTH;
        this.decoder = new stream_decoder_1.StreamDecoder(maxReceiveMessageLength);
        http2Stream.on('response', (headers, flags)=>{
            let headersString = '';
            for (const header of Object.keys(headers)){
                headersString += '\t\t' + header + ': ' + headers[header] + '\n';
            }
            this.trace('Received server headers:\n' + headersString);
            this.httpStatusCode = headers[':status'];
            if (flags & http2.constants.NGHTTP2_FLAG_END_STREAM) {
                this.handleTrailers(headers);
            } else {
                let metadata;
                try {
                    metadata = metadata_1.Metadata.fromHttp2Headers(headers);
                } catch (error) {
                    this.endCall({
                        code: constants_1.Status.UNKNOWN,
                        details: error.message,
                        metadata: new metadata_1.Metadata()
                    });
                    return;
                }
                this.listener.onReceiveMetadata(metadata);
            }
        });
        http2Stream.on('trailers', (headers)=>{
            this.handleTrailers(headers);
        });
        http2Stream.on('data', (data)=>{
            /* If the status has already been output, allow the http2 stream to
             * drain without processing the data. */ if (this.statusOutput) {
                return;
            }
            this.trace('receive HTTP/2 data frame of length ' + data.length);
            let messages;
            try {
                messages = this.decoder.write(data);
            } catch (e) {
                this.cancelWithStatus(constants_1.Status.RESOURCE_EXHAUSTED, e.message);
                return;
            }
            for (const message of messages){
                this.trace('parsed message of length ' + message.length);
                this.callEventTracker.addMessageReceived();
                this.tryPush(message);
            }
        });
        http2Stream.on('end', ()=>{
            this.readsClosed = true;
            this.maybeOutputStatus();
        });
        http2Stream.on('close', ()=>{
            this.serverEndedCall = true;
            /* Use process.next tick to ensure that this code happens after any
             * "error" event that may be emitted at about the same time, so that
             * we can bubble up the error message from that event. */ process.nextTick(()=>{
                var _a;
                this.trace('HTTP/2 stream closed with code ' + http2Stream.rstCode);
                /* If we have a final status with an OK status code, that means that
                 * we have received all of the messages and we have processed the
                 * trailers and the call completed successfully, so it doesn't matter
                 * how the stream ends after that */ if (((_a = this.finalStatus) === null || _a === void 0 ? void 0 : _a.code) === constants_1.Status.OK) {
                    return;
                }
                let code;
                let details = '';
                switch(http2Stream.rstCode){
                    case http2.constants.NGHTTP2_NO_ERROR:
                        /* If we get a NO_ERROR code and we already have a status, the
                         * stream completed properly and we just haven't fully processed
                         * it yet */ if (this.finalStatus !== null) {
                            return;
                        }
                        if (this.httpStatusCode && this.httpStatusCode !== 200) {
                            const mappedStatus = mapHttpStatusCode(this.httpStatusCode);
                            code = mappedStatus.code;
                            details = mappedStatus.details;
                        } else {
                            code = constants_1.Status.INTERNAL;
                            details = `Received RST_STREAM with code ${http2Stream.rstCode} (Call ended without gRPC status)`;
                        }
                        break;
                    case http2.constants.NGHTTP2_REFUSED_STREAM:
                        code = constants_1.Status.UNAVAILABLE;
                        details = 'Stream refused by server';
                        break;
                    case http2.constants.NGHTTP2_CANCEL:
                        /* Bug reports indicate that Node synthesizes a NGHTTP2_CANCEL
                         * code from connection drops. We want to prioritize reporting
                         * an unavailable status when that happens. */ if (this.connectionDropped) {
                            code = constants_1.Status.UNAVAILABLE;
                            details = 'Connection dropped';
                        } else {
                            code = constants_1.Status.CANCELLED;
                            details = 'Call cancelled';
                        }
                        break;
                    case http2.constants.NGHTTP2_ENHANCE_YOUR_CALM:
                        code = constants_1.Status.RESOURCE_EXHAUSTED;
                        details = 'Bandwidth exhausted or memory limit exceeded';
                        break;
                    case http2.constants.NGHTTP2_INADEQUATE_SECURITY:
                        code = constants_1.Status.PERMISSION_DENIED;
                        details = 'Protocol not secure enough';
                        break;
                    case http2.constants.NGHTTP2_INTERNAL_ERROR:
                        code = constants_1.Status.INTERNAL;
                        if (this.internalError === null) {
                            /* This error code was previously handled in the default case, and
                             * there are several instances of it online, so I wanted to
                             * preserve the original error message so that people find existing
                             * information in searches, but also include the more recognizable
                             * "Internal server error" message. */ details = `Received RST_STREAM with code ${http2Stream.rstCode} (Internal server error)`;
                        } else {
                            if (this.internalError.code === 'ECONNRESET' || this.internalError.code === 'ETIMEDOUT') {
                                code = constants_1.Status.UNAVAILABLE;
                                details = this.internalError.message;
                            } else {
                                /* The "Received RST_STREAM with code ..." error is preserved
                                 * here for continuity with errors reported online, but the
                                 * error message at the end will probably be more relevant in
                                 * most cases. */ details = `Received RST_STREAM with code ${http2Stream.rstCode} triggered by internal client error: ${this.internalError.message}`;
                            }
                        }
                        break;
                    default:
                        code = constants_1.Status.INTERNAL;
                        details = `Received RST_STREAM with code ${http2Stream.rstCode}`;
                }
                // This is a no-op if trailers were received at all.
                // This is OK, because status codes emitted here correspond to more
                // catastrophic issues that prevent us from receiving trailers in the
                // first place.
                this.endCall({
                    code,
                    details,
                    metadata: new metadata_1.Metadata(),
                    rstCode: http2Stream.rstCode
                });
            });
        });
        http2Stream.on('error', (err)=>{
            /* We need an error handler here to stop "Uncaught Error" exceptions
             * from bubbling up. However, errors here should all correspond to
             * "close" events, where we will handle the error more granularly */ /* Specifically looking for stream errors that were *not* constructed
             * from a RST_STREAM response here:
             * https://github.com/nodejs/node/blob/8b8620d580314050175983402dfddf2674e8e22a/lib/internal/http2/core.js#L2267
             */ if (err.code !== 'ERR_HTTP2_STREAM_ERROR') {
                this.trace('Node error event: message=' + err.message + ' code=' + err.code + ' errno=' + getSystemErrorName(err.errno) + ' syscall=' + err.syscall);
                this.internalError = err;
            }
            this.callEventTracker.onStreamEnd(false);
        });
    }
    getDeadlineInfo() {
        return [
            `remote_addr=${this.getPeer()}`
        ];
    }
    onDisconnect() {
        this.connectionDropped = true;
        /* Give the call an event loop cycle to finish naturally before reporting
         * the disconnection as an error. */ setImmediate(()=>{
            this.endCall({
                code: constants_1.Status.UNAVAILABLE,
                details: 'Connection dropped',
                metadata: new metadata_1.Metadata()
            });
        });
    }
    outputStatus() {
        /* Precondition: this.finalStatus !== null */ if (!this.statusOutput) {
            this.statusOutput = true;
            this.trace('ended with status: code=' + this.finalStatus.code + ' details="' + this.finalStatus.details + '"');
            this.callEventTracker.onCallEnd(this.finalStatus);
            /* We delay the actual action of bubbling up the status to insulate the
             * cleanup code in this class from any errors that may be thrown in the
             * upper layers as a result of bubbling up the status. In particular,
             * if the status is not OK, the "error" event may be emitted
             * synchronously at the top level, which will result in a thrown error if
             * the user does not handle that event. */ process.nextTick(()=>{
                this.listener.onReceiveStatus(this.finalStatus);
            });
            /* Leave the http2 stream in flowing state to drain incoming messages, to
             * ensure that the stream closure completes. The call stream already does
             * not push more messages after the status is output, so the messages go
             * nowhere either way. */ this.http2Stream.resume();
        }
    }
    trace(text) {
        logging.trace(constants_2.LogVerbosity.DEBUG, TRACER_NAME, '[' + this.callId + '] ' + text);
    }
    /**
     * On first call, emits a 'status' event with the given StatusObject.
     * Subsequent calls are no-ops.
     * @param status The status of the call.
     */ endCall(status) {
        /* If the status is OK and a new status comes in (e.g. from a
         * deserialization failure), that new status takes priority */ if (this.finalStatus === null || this.finalStatus.code === constants_1.Status.OK) {
            this.finalStatus = status;
            this.maybeOutputStatus();
        }
        this.destroyHttp2Stream();
    }
    maybeOutputStatus() {
        if (this.finalStatus !== null) {
            /* The combination check of readsClosed and that the two message buffer
             * arrays are empty checks that there all incoming data has been fully
             * processed */ if (this.finalStatus.code !== constants_1.Status.OK || this.readsClosed && this.unpushedReadMessages.length === 0 && !this.isReadFilterPending && !this.isPushPending) {
                this.outputStatus();
            }
        }
    }
    push(message) {
        this.trace('pushing to reader message of length ' + (message instanceof Buffer ? message.length : null));
        this.canPush = false;
        this.isPushPending = true;
        process.nextTick(()=>{
            this.isPushPending = false;
            /* If we have already output the status any later messages should be
             * ignored, and can cause out-of-order operation errors higher up in the
             * stack. Checking as late as possible here to avoid any race conditions.
             */ if (this.statusOutput) {
                return;
            }
            this.listener.onReceiveMessage(message);
            this.maybeOutputStatus();
        });
    }
    tryPush(messageBytes) {
        if (this.canPush) {
            this.http2Stream.pause();
            this.push(messageBytes);
        } else {
            this.trace('unpushedReadMessages.push message of length ' + messageBytes.length);
            this.unpushedReadMessages.push(messageBytes);
        }
    }
    handleTrailers(headers) {
        this.serverEndedCall = true;
        this.callEventTracker.onStreamEnd(true);
        let headersString = '';
        for (const header of Object.keys(headers)){
            headersString += '\t\t' + header + ': ' + headers[header] + '\n';
        }
        this.trace('Received server trailers:\n' + headersString);
        let metadata;
        try {
            metadata = metadata_1.Metadata.fromHttp2Headers(headers);
        } catch (e) {
            metadata = new metadata_1.Metadata();
        }
        const metadataMap = metadata.getMap();
        let status;
        if (typeof metadataMap['grpc-status'] === 'string') {
            const receivedStatus = Number(metadataMap['grpc-status']);
            this.trace('received status code ' + receivedStatus + ' from server');
            metadata.remove('grpc-status');
            let details = '';
            if (typeof metadataMap['grpc-message'] === 'string') {
                try {
                    details = decodeURI(metadataMap['grpc-message']);
                } catch (e) {
                    details = metadataMap['grpc-message'];
                }
                metadata.remove('grpc-message');
                this.trace('received status details string "' + details + '" from server');
            }
            status = {
                code: receivedStatus,
                details: details,
                metadata: metadata
            };
        } else if (this.httpStatusCode) {
            status = mapHttpStatusCode(this.httpStatusCode);
            status.metadata = metadata;
        } else {
            status = {
                code: constants_1.Status.UNKNOWN,
                details: 'No status information received',
                metadata: metadata
            };
        }
        // This is a no-op if the call was already ended when handling headers.
        this.endCall(status);
    }
    destroyHttp2Stream() {
        var _a;
        // The http2 stream could already have been destroyed if cancelWithStatus
        // is called in response to an internal http2 error.
        if (this.http2Stream.destroyed) {
            return;
        }
        /* If the server ended the call, sending an RST_STREAM is redundant, so we
         * just half close on the client side instead to finish closing the stream.
         */ if (this.serverEndedCall) {
            this.http2Stream.end();
        } else {
            /* If the call has ended with an OK status, communicate that when closing
             * the stream, partly to avoid a situation in which we detect an error
             * RST_STREAM as a result after we have the status */ let code;
            if (((_a = this.finalStatus) === null || _a === void 0 ? void 0 : _a.code) === constants_1.Status.OK) {
                code = http2.constants.NGHTTP2_NO_ERROR;
            } else {
                code = http2.constants.NGHTTP2_CANCEL;
            }
            this.trace('close http2 stream with code ' + code);
            this.http2Stream.close(code);
        }
    }
    cancelWithStatus(status, details) {
        this.trace('cancelWithStatus code: ' + status + ' details: "' + details + '"');
        this.endCall({
            code: status,
            details,
            metadata: new metadata_1.Metadata()
        });
    }
    getStatus() {
        return this.finalStatus;
    }
    getPeer() {
        return this.transport.getPeerName();
    }
    getCallNumber() {
        return this.callId;
    }
    startRead() {
        /* If the stream has ended with an error, we should not emit any more
         * messages and we should communicate that the stream has ended */ if (this.finalStatus !== null && this.finalStatus.code !== constants_1.Status.OK) {
            this.readsClosed = true;
            this.maybeOutputStatus();
            return;
        }
        this.canPush = true;
        if (this.unpushedReadMessages.length > 0) {
            const nextMessage = this.unpushedReadMessages.shift();
            this.push(nextMessage);
            return;
        }
        /* Only resume reading from the http2Stream if we don't have any pending
         * messages to emit */ this.http2Stream.resume();
    }
    sendMessageWithContext(context, message) {
        this.trace('write() called with message of length ' + message.length);
        const cb = (error)=>{
            /* nextTick here ensures that no stream action can be taken in the call
             * stack of the write callback, in order to hopefully work around
             * https://github.com/nodejs/node/issues/49147 */ process.nextTick(()=>{
                var _a;
                let code = constants_1.Status.UNAVAILABLE;
                if ((error === null || error === void 0 ? void 0 : error.code) === 'ERR_STREAM_WRITE_AFTER_END') {
                    code = constants_1.Status.INTERNAL;
                }
                if (error) {
                    this.cancelWithStatus(code, `Write error: ${error.message}`);
                }
                (_a = context.callback) === null || _a === void 0 ? void 0 : _a.call(context);
            });
        };
        this.trace('sending data chunk of length ' + message.length);
        this.callEventTracker.addMessageSent();
        try {
            this.http2Stream.write(message, cb);
        } catch (error) {
            this.endCall({
                code: constants_1.Status.UNAVAILABLE,
                details: `Write failed with error ${error.message}`,
                metadata: new metadata_1.Metadata()
            });
        }
    }
    halfClose() {
        this.trace('end() called');
        this.trace('calling end() on HTTP/2 stream');
        this.http2Stream.end();
    }
}
exports.Http2SubchannelCall = Http2SubchannelCall; //# sourceMappingURL=subchannel-call.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/call-number.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getNextCallNumber = void 0;
let nextCallNumber = 0;
function getNextCallNumber() {
    return nextCallNumber++;
}
exports.getNextCallNumber = getNextCallNumber; //# sourceMappingURL=call-number.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/transport.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2023 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Http2SubchannelConnector = void 0;
const http2 = __turbopack_require__("[externals]/ [external] (http2, cjs)");
const tls_1 = __turbopack_require__("[externals]/ [external] (tls, cjs)");
const channelz_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channelz.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const http_proxy_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/http_proxy.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const resolver_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver.js [app-rsc] (ecmascript)");
const subchannel_address_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const net = __turbopack_require__("[externals]/ [external] (net, cjs)");
const subchannel_call_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-call.js [app-rsc] (ecmascript)");
const call_number_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/call-number.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'transport';
const FLOW_CONTROL_TRACER_NAME = 'transport_flowctrl';
const clientVersion = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/package.json (json)").version;
const { HTTP2_HEADER_AUTHORITY, HTTP2_HEADER_CONTENT_TYPE, HTTP2_HEADER_METHOD, HTTP2_HEADER_PATH, HTTP2_HEADER_TE, HTTP2_HEADER_USER_AGENT } = http2.constants;
const KEEPALIVE_TIMEOUT_MS = 20000;
const tooManyPingsData = Buffer.from('too_many_pings', 'ascii');
class Http2Transport {
    constructor(session, subchannelAddress, options, /**
     * Name of the remote server, if it is not the same as the subchannel
     * address, i.e. if connecting through an HTTP CONNECT proxy.
     */ remoteName){
        this.session = session;
        this.options = options;
        this.remoteName = remoteName;
        /**
         * Timer reference indicating when to send the next ping or when the most recent ping will be considered lost.
         */ this.keepaliveTimer = null;
        /**
         * Indicates that the keepalive timer ran out while there were no active
         * calls, and a ping should be sent the next time a call starts.
         */ this.pendingSendKeepalivePing = false;
        this.activeCalls = new Set();
        this.disconnectListeners = [];
        this.disconnectHandled = false;
        this.channelzEnabled = true;
        this.keepalivesSent = 0;
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.lastMessageSentTimestamp = null;
        this.lastMessageReceivedTimestamp = null;
        /* Populate subchannelAddressString and channelzRef before doing anything
         * else, because they are used in the trace methods. */ this.subchannelAddressString = (0, subchannel_address_1.subchannelAddressToString)(subchannelAddress);
        if (options['grpc.enable_channelz'] === 0) {
            this.channelzEnabled = false;
            this.streamTracker = new channelz_1.ChannelzCallTrackerStub();
        } else {
            this.streamTracker = new channelz_1.ChannelzCallTracker();
        }
        this.channelzRef = (0, channelz_1.registerChannelzSocket)(this.subchannelAddressString, ()=>this.getChannelzInfo(), this.channelzEnabled);
        // Build user-agent string.
        this.userAgent = [
            options['grpc.primary_user_agent'],
            `grpc-node-js/${clientVersion}`,
            options['grpc.secondary_user_agent']
        ].filter((e)=>e).join(' '); // remove falsey values first
        if ('grpc.keepalive_time_ms' in options) {
            this.keepaliveTimeMs = options['grpc.keepalive_time_ms'];
        } else {
            this.keepaliveTimeMs = -1;
        }
        if ('grpc.keepalive_timeout_ms' in options) {
            this.keepaliveTimeoutMs = options['grpc.keepalive_timeout_ms'];
        } else {
            this.keepaliveTimeoutMs = KEEPALIVE_TIMEOUT_MS;
        }
        if ('grpc.keepalive_permit_without_calls' in options) {
            this.keepaliveWithoutCalls = options['grpc.keepalive_permit_without_calls'] === 1;
        } else {
            this.keepaliveWithoutCalls = false;
        }
        session.once('close', ()=>{
            this.trace('session closed');
            this.handleDisconnect();
        });
        session.once('goaway', (errorCode, lastStreamID, opaqueData)=>{
            let tooManyPings = false;
            /* See the last paragraph of
             * https://github.com/grpc/proposal/blob/master/A8-client-side-keepalive.md#basic-keepalive */ if (errorCode === http2.constants.NGHTTP2_ENHANCE_YOUR_CALM && opaqueData && opaqueData.equals(tooManyPingsData)) {
                tooManyPings = true;
            }
            this.trace('connection closed by GOAWAY with code ' + errorCode + ' and data ' + (opaqueData === null || opaqueData === void 0 ? void 0 : opaqueData.toString()));
            this.reportDisconnectToOwner(tooManyPings);
        });
        session.once('error', (error)=>{
            this.trace('connection closed with error ' + error.message);
            this.handleDisconnect();
        });
        session.socket.once('close', ()=>{
            this.trace('connection closed');
            this.handleDisconnect();
        });
        if (logging.isTracerEnabled(TRACER_NAME)) {
            session.on('remoteSettings', (settings)=>{
                this.trace('new settings received' + (this.session !== session ? ' on the old connection' : '') + ': ' + JSON.stringify(settings));
            });
            session.on('localSettings', (settings)=>{
                this.trace('local settings acknowledged by remote' + (this.session !== session ? ' on the old connection' : '') + ': ' + JSON.stringify(settings));
            });
        }
        /* Start the keepalive timer last, because this can trigger trace logs,
         * which should only happen after everything else is set up. */ if (this.keepaliveWithoutCalls) {
            this.maybeStartKeepalivePingTimer();
        }
    }
    getChannelzInfo() {
        var _a, _b, _c;
        const sessionSocket = this.session.socket;
        const remoteAddress = sessionSocket.remoteAddress ? (0, subchannel_address_1.stringToSubchannelAddress)(sessionSocket.remoteAddress, sessionSocket.remotePort) : null;
        const localAddress = sessionSocket.localAddress ? (0, subchannel_address_1.stringToSubchannelAddress)(sessionSocket.localAddress, sessionSocket.localPort) : null;
        let tlsInfo;
        if (this.session.encrypted) {
            const tlsSocket = sessionSocket;
            const cipherInfo = tlsSocket.getCipher();
            const certificate = tlsSocket.getCertificate();
            const peerCertificate = tlsSocket.getPeerCertificate();
            tlsInfo = {
                cipherSuiteStandardName: (_a = cipherInfo.standardName) !== null && _a !== void 0 ? _a : null,
                cipherSuiteOtherName: cipherInfo.standardName ? null : cipherInfo.name,
                localCertificate: certificate && 'raw' in certificate ? certificate.raw : null,
                remoteCertificate: peerCertificate && 'raw' in peerCertificate ? peerCertificate.raw : null
            };
        } else {
            tlsInfo = null;
        }
        const socketInfo = {
            remoteAddress: remoteAddress,
            localAddress: localAddress,
            security: tlsInfo,
            remoteName: this.remoteName,
            streamsStarted: this.streamTracker.callsStarted,
            streamsSucceeded: this.streamTracker.callsSucceeded,
            streamsFailed: this.streamTracker.callsFailed,
            messagesSent: this.messagesSent,
            messagesReceived: this.messagesReceived,
            keepAlivesSent: this.keepalivesSent,
            lastLocalStreamCreatedTimestamp: this.streamTracker.lastCallStartedTimestamp,
            lastRemoteStreamCreatedTimestamp: null,
            lastMessageSentTimestamp: this.lastMessageSentTimestamp,
            lastMessageReceivedTimestamp: this.lastMessageReceivedTimestamp,
            localFlowControlWindow: (_b = this.session.state.localWindowSize) !== null && _b !== void 0 ? _b : null,
            remoteFlowControlWindow: (_c = this.session.state.remoteWindowSize) !== null && _c !== void 0 ? _c : null
        };
        return socketInfo;
    }
    trace(text) {
        logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, '(' + this.channelzRef.id + ') ' + this.subchannelAddressString + ' ' + text);
    }
    keepaliveTrace(text) {
        logging.trace(constants_1.LogVerbosity.DEBUG, 'keepalive', '(' + this.channelzRef.id + ') ' + this.subchannelAddressString + ' ' + text);
    }
    flowControlTrace(text) {
        logging.trace(constants_1.LogVerbosity.DEBUG, FLOW_CONTROL_TRACER_NAME, '(' + this.channelzRef.id + ') ' + this.subchannelAddressString + ' ' + text);
    }
    internalsTrace(text) {
        logging.trace(constants_1.LogVerbosity.DEBUG, 'transport_internals', '(' + this.channelzRef.id + ') ' + this.subchannelAddressString + ' ' + text);
    }
    /**
     * Indicate to the owner of this object that this transport should no longer
     * be used. That happens if the connection drops, or if the server sends a
     * GOAWAY.
     * @param tooManyPings If true, this was triggered by a GOAWAY with data
     * indicating that the session was closed becaues the client sent too many
     * pings.
     * @returns
     */ reportDisconnectToOwner(tooManyPings) {
        if (this.disconnectHandled) {
            return;
        }
        this.disconnectHandled = true;
        this.disconnectListeners.forEach((listener)=>listener(tooManyPings));
    }
    /**
     * Handle connection drops, but not GOAWAYs.
     */ handleDisconnect() {
        this.clearKeepaliveTimeout();
        this.reportDisconnectToOwner(false);
        for (const call of this.activeCalls){
            call.onDisconnect();
        }
        // Wait an event loop cycle before destroying the connection
        setImmediate(()=>{
            this.session.destroy();
        });
    }
    addDisconnectListener(listener) {
        this.disconnectListeners.push(listener);
    }
    canSendPing() {
        return !this.session.destroyed && this.keepaliveTimeMs > 0 && (this.keepaliveWithoutCalls || this.activeCalls.size > 0);
    }
    maybeSendPing() {
        var _a, _b;
        if (!this.canSendPing()) {
            this.pendingSendKeepalivePing = true;
            return;
        }
        if (this.keepaliveTimer) {
            console.error('keepaliveTimeout is not null');
            return;
        }
        if (this.channelzEnabled) {
            this.keepalivesSent += 1;
        }
        this.keepaliveTrace('Sending ping with timeout ' + this.keepaliveTimeoutMs + 'ms');
        this.keepaliveTimer = setTimeout(()=>{
            this.keepaliveTimer = null;
            this.keepaliveTrace('Ping timeout passed without response');
            this.handleDisconnect();
        }, this.keepaliveTimeoutMs);
        (_b = (_a = this.keepaliveTimer).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
        let pingSendError = '';
        try {
            const pingSentSuccessfully = this.session.ping((err, duration, payload)=>{
                this.clearKeepaliveTimeout();
                if (err) {
                    this.keepaliveTrace('Ping failed with error ' + err.message);
                    this.handleDisconnect();
                } else {
                    this.keepaliveTrace('Received ping response');
                    this.maybeStartKeepalivePingTimer();
                }
            });
            if (!pingSentSuccessfully) {
                pingSendError = 'Ping returned false';
            }
        } catch (e) {
            // grpc/grpc-node#2139
            pingSendError = (e instanceof Error ? e.message : '') || 'Unknown error';
        }
        if (pingSendError) {
            this.keepaliveTrace('Ping send failed: ' + pingSendError);
            this.handleDisconnect();
        }
    }
    /**
     * Starts the keepalive ping timer if appropriate. If the timer already ran
     * out while there were no active requests, instead send a ping immediately.
     * If the ping timer is already running or a ping is currently in flight,
     * instead do nothing and wait for them to resolve.
     */ maybeStartKeepalivePingTimer() {
        var _a, _b;
        if (!this.canSendPing()) {
            return;
        }
        if (this.pendingSendKeepalivePing) {
            this.pendingSendKeepalivePing = false;
            this.maybeSendPing();
        } else if (!this.keepaliveTimer) {
            this.keepaliveTrace('Starting keepalive timer for ' + this.keepaliveTimeMs + 'ms');
            this.keepaliveTimer = setTimeout(()=>{
                this.keepaliveTimer = null;
                this.maybeSendPing();
            }, this.keepaliveTimeMs);
            (_b = (_a = this.keepaliveTimer).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
    /* Otherwise, there is already either a keepalive timer or a ping pending,
         * wait for those to resolve. */ }
    /**
     * Clears whichever keepalive timeout is currently active, if any.
     */ clearKeepaliveTimeout() {
        if (this.keepaliveTimer) {
            clearTimeout(this.keepaliveTimer);
            this.keepaliveTimer = null;
        }
    }
    removeActiveCall(call) {
        this.activeCalls.delete(call);
        if (this.activeCalls.size === 0) {
            this.session.unref();
        }
    }
    addActiveCall(call) {
        this.activeCalls.add(call);
        if (this.activeCalls.size === 1) {
            this.session.ref();
            if (!this.keepaliveWithoutCalls) {
                this.maybeStartKeepalivePingTimer();
            }
        }
    }
    createCall(metadata, host, method, listener, subchannelCallStatsTracker) {
        const headers = metadata.toHttp2Headers();
        headers[HTTP2_HEADER_AUTHORITY] = host;
        headers[HTTP2_HEADER_USER_AGENT] = this.userAgent;
        headers[HTTP2_HEADER_CONTENT_TYPE] = 'application/grpc';
        headers[HTTP2_HEADER_METHOD] = 'POST';
        headers[HTTP2_HEADER_PATH] = method;
        headers[HTTP2_HEADER_TE] = 'trailers';
        let http2Stream;
        /* In theory, if an error is thrown by session.request because session has
         * become unusable (e.g. because it has received a goaway), this subchannel
         * should soon see the corresponding close or goaway event anyway and leave
         * READY. But we have seen reports that this does not happen
         * (https://github.com/googleapis/nodejs-firestore/issues/1023#issuecomment-653204096)
         * so for defense in depth, we just discard the session when we see an
         * error here.
         */ try {
            http2Stream = this.session.request(headers);
        } catch (e) {
            this.handleDisconnect();
            throw e;
        }
        this.flowControlTrace('local window size: ' + this.session.state.localWindowSize + ' remote window size: ' + this.session.state.remoteWindowSize);
        this.internalsTrace('session.closed=' + this.session.closed + ' session.destroyed=' + this.session.destroyed + ' session.socket.destroyed=' + this.session.socket.destroyed);
        let eventTracker;
        // eslint-disable-next-line prefer-const
        let call;
        if (this.channelzEnabled) {
            this.streamTracker.addCallStarted();
            eventTracker = {
                addMessageSent: ()=>{
                    var _a;
                    this.messagesSent += 1;
                    this.lastMessageSentTimestamp = new Date();
                    (_a = subchannelCallStatsTracker.addMessageSent) === null || _a === void 0 ? void 0 : _a.call(subchannelCallStatsTracker);
                },
                addMessageReceived: ()=>{
                    var _a;
                    this.messagesReceived += 1;
                    this.lastMessageReceivedTimestamp = new Date();
                    (_a = subchannelCallStatsTracker.addMessageReceived) === null || _a === void 0 ? void 0 : _a.call(subchannelCallStatsTracker);
                },
                onCallEnd: (status)=>{
                    var _a;
                    (_a = subchannelCallStatsTracker.onCallEnd) === null || _a === void 0 ? void 0 : _a.call(subchannelCallStatsTracker, status);
                    this.removeActiveCall(call);
                },
                onStreamEnd: (success)=>{
                    var _a;
                    if (success) {
                        this.streamTracker.addCallSucceeded();
                    } else {
                        this.streamTracker.addCallFailed();
                    }
                    (_a = subchannelCallStatsTracker.onStreamEnd) === null || _a === void 0 ? void 0 : _a.call(subchannelCallStatsTracker, success);
                }
            };
        } else {
            eventTracker = {
                addMessageSent: ()=>{
                    var _a;
                    (_a = subchannelCallStatsTracker.addMessageSent) === null || _a === void 0 ? void 0 : _a.call(subchannelCallStatsTracker);
                },
                addMessageReceived: ()=>{
                    var _a;
                    (_a = subchannelCallStatsTracker.addMessageReceived) === null || _a === void 0 ? void 0 : _a.call(subchannelCallStatsTracker);
                },
                onCallEnd: (status)=>{
                    var _a;
                    (_a = subchannelCallStatsTracker.onCallEnd) === null || _a === void 0 ? void 0 : _a.call(subchannelCallStatsTracker, status);
                    this.removeActiveCall(call);
                },
                onStreamEnd: (success)=>{
                    var _a;
                    (_a = subchannelCallStatsTracker.onStreamEnd) === null || _a === void 0 ? void 0 : _a.call(subchannelCallStatsTracker, success);
                }
            };
        }
        call = new subchannel_call_1.Http2SubchannelCall(http2Stream, eventTracker, listener, this, (0, call_number_1.getNextCallNumber)());
        this.addActiveCall(call);
        return call;
    }
    getChannelzRef() {
        return this.channelzRef;
    }
    getPeerName() {
        return this.subchannelAddressString;
    }
    getOptions() {
        return this.options;
    }
    shutdown() {
        this.session.close();
        (0, channelz_1.unregisterChannelzRef)(this.channelzRef);
    }
}
class Http2SubchannelConnector {
    constructor(channelTarget){
        this.channelTarget = channelTarget;
        this.session = null;
        this.isShutdown = false;
    }
    trace(text) {
        logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, (0, uri_parser_1.uriToString)(this.channelTarget) + ' ' + text);
    }
    createSession(address, credentials, options, proxyConnectionResult) {
        if (this.isShutdown) {
            return Promise.reject();
        }
        return new Promise((resolve, reject)=>{
            var _a, _b, _c, _d;
            let remoteName;
            if (proxyConnectionResult.realTarget) {
                remoteName = (0, uri_parser_1.uriToString)(proxyConnectionResult.realTarget);
                this.trace('creating HTTP/2 session through proxy to ' + (0, uri_parser_1.uriToString)(proxyConnectionResult.realTarget));
            } else {
                remoteName = null;
                this.trace('creating HTTP/2 session to ' + (0, subchannel_address_1.subchannelAddressToString)(address));
            }
            const targetAuthority = (0, resolver_1.getDefaultAuthority)((_a = proxyConnectionResult.realTarget) !== null && _a !== void 0 ? _a : this.channelTarget);
            let connectionOptions = credentials._getConnectionOptions();
            if (!connectionOptions) {
                reject('Credentials not loaded');
                return;
            }
            connectionOptions.maxSendHeaderBlockLength = Number.MAX_SAFE_INTEGER;
            if ('grpc-node.max_session_memory' in options) {
                connectionOptions.maxSessionMemory = options['grpc-node.max_session_memory'];
            } else {
                /* By default, set a very large max session memory limit, to effectively
                 * disable enforcement of the limit. Some testing indicates that Node's
                 * behavior degrades badly when this limit is reached, so we solve that
                 * by disabling the check entirely. */ connectionOptions.maxSessionMemory = Number.MAX_SAFE_INTEGER;
            }
            let addressScheme = 'http://';
            if ('secureContext' in connectionOptions) {
                addressScheme = 'https://';
                // If provided, the value of grpc.ssl_target_name_override should be used
                // to override the target hostname when checking server identity.
                // This option is used for testing only.
                if (options['grpc.ssl_target_name_override']) {
                    const sslTargetNameOverride = options['grpc.ssl_target_name_override'];
                    const originalCheckServerIdentity = (_b = connectionOptions.checkServerIdentity) !== null && _b !== void 0 ? _b : tls_1.checkServerIdentity;
                    connectionOptions.checkServerIdentity = (host, cert)=>{
                        return originalCheckServerIdentity(sslTargetNameOverride, cert);
                    };
                    connectionOptions.servername = sslTargetNameOverride;
                } else {
                    const authorityHostname = (_d = (_c = (0, uri_parser_1.splitHostPort)(targetAuthority)) === null || _c === void 0 ? void 0 : _c.host) !== null && _d !== void 0 ? _d : 'localhost';
                    // We want to always set servername to support SNI
                    connectionOptions.servername = authorityHostname;
                }
                if (proxyConnectionResult.socket) {
                    /* This is part of the workaround for
                     * https://github.com/nodejs/node/issues/32922. Without that bug,
                     * proxyConnectionResult.socket would always be a plaintext socket and
                     * this would say
                     * connectionOptions.socket = proxyConnectionResult.socket; */ connectionOptions.createConnection = (authority, option)=>{
                        return proxyConnectionResult.socket;
                    };
                }
            } else {
                /* In all but the most recent versions of Node, http2.connect does not use
                 * the options when establishing plaintext connections, so we need to
                 * establish that connection explicitly. */ connectionOptions.createConnection = (authority, option)=>{
                    if (proxyConnectionResult.socket) {
                        return proxyConnectionResult.socket;
                    } else {
                        /* net.NetConnectOpts is declared in a way that is more restrictive
                         * than what net.connect will actually accept, so we use the type
                         * assertion to work around that. */ return net.connect(address);
                    }
                };
            }
            connectionOptions = Object.assign(Object.assign(Object.assign({}, connectionOptions), address), {
                enableTrace: options['grpc-node.tls_enable_trace'] === 1
            });
            /* http2.connect uses the options here:
             * https://github.com/nodejs/node/blob/70c32a6d190e2b5d7b9ff9d5b6a459d14e8b7d59/lib/internal/http2/core.js#L3028-L3036
             * The spread operator overides earlier values with later ones, so any port
             * or host values in the options will be used rather than any values extracted
             * from the first argument. In addition, the path overrides the host and port,
             * as documented for plaintext connections here:
             * https://nodejs.org/api/net.html#net_socket_connect_options_connectlistener
             * and for TLS connections here:
             * https://nodejs.org/api/tls.html#tls_tls_connect_options_callback. In
             * earlier versions of Node, http2.connect passes these options to
             * tls.connect but not net.connect, so in the insecure case we still need
             * to set the createConnection option above to create the connection
             * explicitly. We cannot do that in the TLS case because http2.connect
             * passes necessary additional options to tls.connect.
             * The first argument just needs to be parseable as a URL and the scheme
             * determines whether the connection will be established over TLS or not.
             */ const session = http2.connect(addressScheme + targetAuthority, connectionOptions);
            this.session = session;
            let errorMessage = 'Failed to connect';
            let reportedError = false;
            session.unref();
            session.once('connect', ()=>{
                session.removeAllListeners();
                resolve(new Http2Transport(session, address, options, remoteName));
                this.session = null;
            });
            session.once('close', ()=>{
                this.session = null;
                // Leave time for error event to happen before rejecting
                setImmediate(()=>{
                    if (!reportedError) {
                        reportedError = true;
                        reject(`${errorMessage} (${new Date().toISOString()})`);
                    }
                });
            });
            session.once('error', (error)=>{
                errorMessage = error.message;
                this.trace('connection failed with error ' + errorMessage);
                if (!reportedError) {
                    reportedError = true;
                    reject(`${errorMessage} (${new Date().toISOString()})`);
                }
            });
        });
    }
    connect(address, credentials, options) {
        var _a, _b, _c;
        if (this.isShutdown) {
            return Promise.reject();
        }
        /* Pass connection options through to the proxy so that it's able to
         * upgrade it's connection to support tls if needed.
         * This is a workaround for https://github.com/nodejs/node/issues/32922
         * See https://github.com/grpc/grpc-node/pull/1369 for more info. */ const connectionOptions = credentials._getConnectionOptions();
        if (!connectionOptions) {
            return Promise.reject('Credentials not loaded');
        }
        if ('secureContext' in connectionOptions) {
            connectionOptions.ALPNProtocols = [
                'h2'
            ];
            // If provided, the value of grpc.ssl_target_name_override should be used
            // to override the target hostname when checking server identity.
            // This option is used for testing only.
            if (options['grpc.ssl_target_name_override']) {
                const sslTargetNameOverride = options['grpc.ssl_target_name_override'];
                const originalCheckServerIdentity = (_a = connectionOptions.checkServerIdentity) !== null && _a !== void 0 ? _a : tls_1.checkServerIdentity;
                connectionOptions.checkServerIdentity = (host, cert)=>{
                    return originalCheckServerIdentity(sslTargetNameOverride, cert);
                };
                connectionOptions.servername = sslTargetNameOverride;
            } else {
                if ('grpc.http_connect_target' in options) {
                    /* This is more or less how servername will be set in createSession
                     * if a connection is successfully established through the proxy.
                     * If the proxy is not used, these connectionOptions are discarded
                     * anyway */ const targetPath = (0, resolver_1.getDefaultAuthority)((_b = (0, uri_parser_1.parseUri)(options['grpc.http_connect_target'])) !== null && _b !== void 0 ? _b : {
                        path: 'localhost'
                    });
                    const hostPort = (0, uri_parser_1.splitHostPort)(targetPath);
                    connectionOptions.servername = (_c = hostPort === null || hostPort === void 0 ? void 0 : hostPort.host) !== null && _c !== void 0 ? _c : targetPath;
                }
            }
            if (options['grpc-node.tls_enable_trace']) {
                connectionOptions.enableTrace = true;
            }
        }
        return (0, http_proxy_1.getProxiedConnection)(address, options, connectionOptions).then((result)=>this.createSession(address, credentials, options, result));
    }
    shutdown() {
        var _a;
        this.isShutdown = true;
        (_a = this.session) === null || _a === void 0 ? void 0 : _a.close();
        this.session = null;
    }
}
exports.Http2SubchannelConnector = Http2SubchannelConnector; //# sourceMappingURL=transport.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-pool.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getSubchannelPool = exports.SubchannelPool = void 0;
const channel_options_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channel-options.js [app-rsc] (ecmascript)");
const subchannel_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel.js [app-rsc] (ecmascript)");
const subchannel_address_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const transport_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/transport.js [app-rsc] (ecmascript)");
// 10 seconds in milliseconds. This value is arbitrary.
/**
 * The amount of time in between checks for dropping subchannels that have no
 * other references
 */ const REF_CHECK_INTERVAL = 10000;
class SubchannelPool {
    /**
     * A pool of subchannels use for making connections. Subchannels with the
     * exact same parameters will be reused.
     */ constructor(){
        this.pool = Object.create(null);
        /**
         * A timer of a task performing a periodic subchannel cleanup.
         */ this.cleanupTimer = null;
    }
    /**
     * Unrefs all unused subchannels and cancels the cleanup task if all
     * subchannels have been unrefed.
     */ unrefUnusedSubchannels() {
        let allSubchannelsUnrefed = true;
        /* These objects are created with Object.create(null), so they do not
         * have a prototype, which means that for (... in ...) loops over them
         * do not need to be filtered */ // eslint-disable-disable-next-line:forin
        for(const channelTarget in this.pool){
            const subchannelObjArray = this.pool[channelTarget];
            const refedSubchannels = subchannelObjArray.filter((value)=>!value.subchannel.unrefIfOneRef());
            if (refedSubchannels.length > 0) {
                allSubchannelsUnrefed = false;
            }
            /* For each subchannel in the pool, try to unref it if it has
             * exactly one ref (which is the ref from the pool itself). If that
             * does happen, remove the subchannel from the pool */ this.pool[channelTarget] = refedSubchannels;
        }
        /* Currently we do not delete keys with empty values. If that results
         * in significant memory usage we should change it. */ // Cancel the cleanup task if all subchannels have been unrefed.
        if (allSubchannelsUnrefed && this.cleanupTimer !== null) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
    /**
     * Ensures that the cleanup task is spawned.
     */ ensureCleanupTask() {
        var _a, _b;
        if (this.cleanupTimer === null) {
            this.cleanupTimer = setInterval(()=>{
                this.unrefUnusedSubchannels();
            }, REF_CHECK_INTERVAL);
            // Unref because this timer should not keep the event loop running.
            // Call unref only if it exists to address electron/electron#21162
            (_b = (_a = this.cleanupTimer).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
    }
    /**
     * Get a subchannel if one already exists with exactly matching parameters.
     * Otherwise, create and save a subchannel with those parameters.
     * @param channelTarget
     * @param subchannelTarget
     * @param channelArguments
     * @param channelCredentials
     */ getOrCreateSubchannel(channelTargetUri, subchannelTarget, channelArguments, channelCredentials) {
        this.ensureCleanupTask();
        const channelTarget = (0, uri_parser_1.uriToString)(channelTargetUri);
        if (channelTarget in this.pool) {
            const subchannelObjArray = this.pool[channelTarget];
            for (const subchannelObj of subchannelObjArray){
                if ((0, subchannel_address_1.subchannelAddressEqual)(subchannelTarget, subchannelObj.subchannelAddress) && (0, channel_options_1.channelOptionsEqual)(channelArguments, subchannelObj.channelArguments) && channelCredentials._equals(subchannelObj.channelCredentials)) {
                    return subchannelObj.subchannel;
                }
            }
        }
        // If we get here, no matching subchannel was found
        const subchannel = new subchannel_1.Subchannel(channelTargetUri, subchannelTarget, channelArguments, channelCredentials, new transport_1.Http2SubchannelConnector(channelTargetUri));
        if (!(channelTarget in this.pool)) {
            this.pool[channelTarget] = [];
        }
        this.pool[channelTarget].push({
            subchannelAddress: subchannelTarget,
            channelArguments,
            channelCredentials,
            subchannel
        });
        subchannel.ref();
        return subchannel;
    }
}
exports.SubchannelPool = SubchannelPool;
const globalSubchannelPool = new SubchannelPool();
/**
 * Get either the global subchannel pool, or a new subchannel pool.
 * @param global
 */ function getSubchannelPool(global) {
    if (global) {
        return globalSubchannelPool;
    } else {
        return new SubchannelPool();
    }
}
exports.getSubchannelPool = getSubchannelPool; //# sourceMappingURL=subchannel-pool.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/filter-stack.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.FilterStackFactory = exports.FilterStack = void 0;
class FilterStack {
    constructor(filters){
        this.filters = filters;
    }
    sendMetadata(metadata) {
        let result = metadata;
        for(let i = 0; i < this.filters.length; i++){
            result = this.filters[i].sendMetadata(result);
        }
        return result;
    }
    receiveMetadata(metadata) {
        let result = metadata;
        for(let i = this.filters.length - 1; i >= 0; i--){
            result = this.filters[i].receiveMetadata(result);
        }
        return result;
    }
    sendMessage(message) {
        let result = message;
        for(let i = 0; i < this.filters.length; i++){
            result = this.filters[i].sendMessage(result);
        }
        return result;
    }
    receiveMessage(message) {
        let result = message;
        for(let i = this.filters.length - 1; i >= 0; i--){
            result = this.filters[i].receiveMessage(result);
        }
        return result;
    }
    receiveTrailers(status) {
        let result = status;
        for(let i = this.filters.length - 1; i >= 0; i--){
            result = this.filters[i].receiveTrailers(result);
        }
        return result;
    }
    push(filters) {
        this.filters.unshift(...filters);
    }
    getFilters() {
        return this.filters;
    }
}
exports.FilterStack = FilterStack;
class FilterStackFactory {
    constructor(factories){
        this.factories = factories;
    }
    push(filterFactories) {
        this.factories.unshift(...filterFactories);
    }
    clone() {
        return new FilterStackFactory([
            ...this.factories
        ]);
    }
    createFilter() {
        return new FilterStack(this.factories.map((factory)=>factory.createFilter()));
    }
}
exports.FilterStackFactory = FilterStackFactory; //# sourceMappingURL=filter-stack.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/compression-algorithms.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2021 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.CompressionAlgorithms = void 0;
var CompressionAlgorithms;
(function(CompressionAlgorithms) {
    CompressionAlgorithms[CompressionAlgorithms["identity"] = 0] = "identity";
    CompressionAlgorithms[CompressionAlgorithms["deflate"] = 1] = "deflate";
    CompressionAlgorithms[CompressionAlgorithms["gzip"] = 2] = "gzip";
})(CompressionAlgorithms || (exports.CompressionAlgorithms = CompressionAlgorithms = {})); //# sourceMappingURL=compression-algorithms.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/filter.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.BaseFilter = void 0;
class BaseFilter {
    async sendMetadata(metadata) {
        return metadata;
    }
    receiveMetadata(metadata) {
        return metadata;
    }
    async sendMessage(message) {
        return message;
    }
    async receiveMessage(message) {
        return message;
    }
    receiveTrailers(status) {
        return status;
    }
}
exports.BaseFilter = BaseFilter; //# sourceMappingURL=filter.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/compression-filter.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.CompressionFilterFactory = exports.CompressionFilter = void 0;
const zlib = __turbopack_require__("[externals]/ [external] (zlib, cjs)");
const compression_algorithms_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/compression-algorithms.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const filter_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/filter.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const isCompressionAlgorithmKey = (key)=>{
    return typeof key === 'number' && typeof compression_algorithms_1.CompressionAlgorithms[key] === 'string';
};
class CompressionHandler {
    /**
     * @param message Raw uncompressed message bytes
     * @param compress Indicates whether the message should be compressed
     * @return Framed message, compressed if applicable
     */ async writeMessage(message, compress) {
        let messageBuffer = message;
        if (compress) {
            messageBuffer = await this.compressMessage(messageBuffer);
        }
        const output = Buffer.allocUnsafe(messageBuffer.length + 5);
        output.writeUInt8(compress ? 1 : 0, 0);
        output.writeUInt32BE(messageBuffer.length, 1);
        messageBuffer.copy(output, 5);
        return output;
    }
    /**
     * @param data Framed message, possibly compressed
     * @return Uncompressed message
     */ async readMessage(data) {
        const compressed = data.readUInt8(0) === 1;
        let messageBuffer = data.slice(5);
        if (compressed) {
            messageBuffer = await this.decompressMessage(messageBuffer);
        }
        return messageBuffer;
    }
}
class IdentityHandler extends CompressionHandler {
    async compressMessage(message) {
        return message;
    }
    async writeMessage(message, compress) {
        const output = Buffer.allocUnsafe(message.length + 5);
        /* With "identity" compression, messages should always be marked as
         * uncompressed */ output.writeUInt8(0, 0);
        output.writeUInt32BE(message.length, 1);
        message.copy(output, 5);
        return output;
    }
    decompressMessage(message) {
        return Promise.reject(new Error('Received compressed message but "grpc-encoding" header was identity'));
    }
}
class DeflateHandler extends CompressionHandler {
    constructor(maxRecvMessageLength){
        super();
        this.maxRecvMessageLength = maxRecvMessageLength;
    }
    compressMessage(message) {
        return new Promise((resolve, reject)=>{
            zlib.deflate(message, (err, output)=>{
                if (err) {
                    reject(err);
                } else {
                    resolve(output);
                }
            });
        });
    }
    decompressMessage(message) {
        return new Promise((resolve, reject)=>{
            let totalLength = 0;
            const messageParts = [];
            const decompresser = zlib.createInflate();
            decompresser.on('data', (chunk)=>{
                messageParts.push(chunk);
                totalLength += chunk.byteLength;
                if (this.maxRecvMessageLength !== -1 && totalLength > this.maxRecvMessageLength) {
                    decompresser.destroy();
                    reject({
                        code: constants_1.Status.RESOURCE_EXHAUSTED,
                        details: `Received message that decompresses to a size larger than ${this.maxRecvMessageLength}`
                    });
                }
            });
            decompresser.on('end', ()=>{
                resolve(Buffer.concat(messageParts));
            });
            decompresser.write(message);
            decompresser.end();
        });
    }
}
class GzipHandler extends CompressionHandler {
    constructor(maxRecvMessageLength){
        super();
        this.maxRecvMessageLength = maxRecvMessageLength;
    }
    compressMessage(message) {
        return new Promise((resolve, reject)=>{
            zlib.gzip(message, (err, output)=>{
                if (err) {
                    reject(err);
                } else {
                    resolve(output);
                }
            });
        });
    }
    decompressMessage(message) {
        return new Promise((resolve, reject)=>{
            let totalLength = 0;
            const messageParts = [];
            const decompresser = zlib.createGunzip();
            decompresser.on('data', (chunk)=>{
                messageParts.push(chunk);
                totalLength += chunk.byteLength;
                if (this.maxRecvMessageLength !== -1 && totalLength > this.maxRecvMessageLength) {
                    decompresser.destroy();
                    reject({
                        code: constants_1.Status.RESOURCE_EXHAUSTED,
                        details: `Received message that decompresses to a size larger than ${this.maxRecvMessageLength}`
                    });
                }
            });
            decompresser.on('end', ()=>{
                resolve(Buffer.concat(messageParts));
            });
            decompresser.write(message);
            decompresser.end();
        });
    }
}
class UnknownHandler extends CompressionHandler {
    constructor(compressionName){
        super();
        this.compressionName = compressionName;
    }
    compressMessage(message) {
        return Promise.reject(new Error(`Received message compressed with unsupported compression method ${this.compressionName}`));
    }
    decompressMessage(message) {
        // This should be unreachable
        return Promise.reject(new Error(`Compression method not supported: ${this.compressionName}`));
    }
}
function getCompressionHandler(compressionName, maxReceiveMessageSize) {
    switch(compressionName){
        case 'identity':
            return new IdentityHandler();
        case 'deflate':
            return new DeflateHandler(maxReceiveMessageSize);
        case 'gzip':
            return new GzipHandler(maxReceiveMessageSize);
        default:
            return new UnknownHandler(compressionName);
    }
}
class CompressionFilter extends filter_1.BaseFilter {
    constructor(channelOptions, sharedFilterConfig){
        var _a, _b, _c;
        super();
        this.sharedFilterConfig = sharedFilterConfig;
        this.sendCompression = new IdentityHandler();
        this.receiveCompression = new IdentityHandler();
        this.currentCompressionAlgorithm = 'identity';
        const compressionAlgorithmKey = channelOptions['grpc.default_compression_algorithm'];
        this.maxReceiveMessageLength = (_a = channelOptions['grpc.max_receive_message_length']) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_MAX_RECEIVE_MESSAGE_LENGTH;
        this.maxSendMessageLength = (_b = channelOptions['grpc.max_send_message_length']) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_MAX_SEND_MESSAGE_LENGTH;
        if (compressionAlgorithmKey !== undefined) {
            if (isCompressionAlgorithmKey(compressionAlgorithmKey)) {
                const clientSelectedEncoding = compression_algorithms_1.CompressionAlgorithms[compressionAlgorithmKey];
                const serverSupportedEncodings = (_c = sharedFilterConfig.serverSupportedEncodingHeader) === null || _c === void 0 ? void 0 : _c.split(',');
                /**
                 * There are two possible situations here:
                 * 1) We don't have any info yet from the server about what compression it supports
                 *    In that case we should just use what the client tells us to use
                 * 2) We've previously received a response from the server including a grpc-accept-encoding header
                 *    In that case we only want to use the encoding chosen by the client if the server supports it
                 */ if (!serverSupportedEncodings || serverSupportedEncodings.includes(clientSelectedEncoding)) {
                    this.currentCompressionAlgorithm = clientSelectedEncoding;
                    this.sendCompression = getCompressionHandler(this.currentCompressionAlgorithm, -1);
                }
            } else {
                logging.log(constants_1.LogVerbosity.ERROR, `Invalid value provided for grpc.default_compression_algorithm option: ${compressionAlgorithmKey}`);
            }
        }
    }
    async sendMetadata(metadata) {
        const headers = await metadata;
        headers.set('grpc-accept-encoding', 'identity,deflate,gzip');
        headers.set('accept-encoding', 'identity');
        // No need to send the header if it's "identity" -  behavior is identical; save the bandwidth
        if (this.currentCompressionAlgorithm === 'identity') {
            headers.remove('grpc-encoding');
        } else {
            headers.set('grpc-encoding', this.currentCompressionAlgorithm);
        }
        return headers;
    }
    receiveMetadata(metadata) {
        const receiveEncoding = metadata.get('grpc-encoding');
        if (receiveEncoding.length > 0) {
            const encoding = receiveEncoding[0];
            if (typeof encoding === 'string') {
                this.receiveCompression = getCompressionHandler(encoding, this.maxReceiveMessageLength);
            }
        }
        metadata.remove('grpc-encoding');
        /* Check to see if the compression we're using to send messages is supported by the server
         * If not, reset the sendCompression filter and have it use the default IdentityHandler */ const serverSupportedEncodingsHeader = metadata.get('grpc-accept-encoding')[0];
        if (serverSupportedEncodingsHeader) {
            this.sharedFilterConfig.serverSupportedEncodingHeader = serverSupportedEncodingsHeader;
            const serverSupportedEncodings = serverSupportedEncodingsHeader.split(',');
            if (!serverSupportedEncodings.includes(this.currentCompressionAlgorithm)) {
                this.sendCompression = new IdentityHandler();
                this.currentCompressionAlgorithm = 'identity';
            }
        }
        metadata.remove('grpc-accept-encoding');
        return metadata;
    }
    async sendMessage(message) {
        var _a;
        /* This filter is special. The input message is the bare message bytes,
         * and the output is a framed and possibly compressed message. For this
         * reason, this filter should be at the bottom of the filter stack */ const resolvedMessage = await message;
        if (this.maxSendMessageLength !== -1 && resolvedMessage.message.length > this.maxSendMessageLength) {
            throw {
                code: constants_1.Status.RESOURCE_EXHAUSTED,
                details: `Attempted to send message with a size larger than ${this.maxSendMessageLength}`
            };
        }
        let compress;
        if (this.sendCompression instanceof IdentityHandler) {
            compress = false;
        } else {
            compress = (((_a = resolvedMessage.flags) !== null && _a !== void 0 ? _a : 0) & 2 /* WriteFlags.NoCompress */ ) === 0;
        }
        return {
            message: await this.sendCompression.writeMessage(resolvedMessage.message, compress),
            flags: resolvedMessage.flags
        };
    }
    async receiveMessage(message) {
        /* This filter is also special. The input message is framed and possibly
         * compressed, and the output message is deframed and uncompressed. So
         * this is another reason that this filter should be at the bottom of the
         * filter stack. */ return this.receiveCompression.readMessage(await message);
    }
}
exports.CompressionFilter = CompressionFilter;
class CompressionFilterFactory {
    constructor(channel, options){
        this.options = options;
        this.sharedFilterConfig = {};
    }
    createFilter() {
        return new CompressionFilter(this.options, this.sharedFilterConfig);
    }
}
exports.CompressionFilterFactory = CompressionFilterFactory; //# sourceMappingURL=compression-filter.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/deadline.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.formatDateDifference = exports.deadlineToString = exports.getRelativeTimeout = exports.getDeadlineTimeoutString = exports.minDeadline = void 0;
function minDeadline(...deadlineList) {
    let minValue = Infinity;
    for (const deadline of deadlineList){
        const deadlineMsecs = deadline instanceof Date ? deadline.getTime() : deadline;
        if (deadlineMsecs < minValue) {
            minValue = deadlineMsecs;
        }
    }
    return minValue;
}
exports.minDeadline = minDeadline;
const units = [
    [
        'm',
        1
    ],
    [
        'S',
        1000
    ],
    [
        'M',
        60 * 1000
    ],
    [
        'H',
        60 * 60 * 1000
    ]
];
function getDeadlineTimeoutString(deadline) {
    const now = new Date().getTime();
    if (deadline instanceof Date) {
        deadline = deadline.getTime();
    }
    const timeoutMs = Math.max(deadline - now, 0);
    for (const [unit, factor] of units){
        const amount = timeoutMs / factor;
        if (amount < 1e8) {
            return String(Math.ceil(amount)) + unit;
        }
    }
    throw new Error('Deadline is too far in the future');
}
exports.getDeadlineTimeoutString = getDeadlineTimeoutString;
/**
 * See https://nodejs.org/api/timers.html#settimeoutcallback-delay-args
 * In particular, "When delay is larger than 2147483647 or less than 1, the
 * delay will be set to 1. Non-integer delays are truncated to an integer."
 * This number of milliseconds is almost 25 days.
 */ const MAX_TIMEOUT_TIME = 2147483647;
/**
 * Get the timeout value that should be passed to setTimeout now for the timer
 * to end at the deadline. For any deadline before now, the timer should end
 * immediately, represented by a value of 0. For any deadline more than
 * MAX_TIMEOUT_TIME milliseconds in the future, a timer cannot be set that will
 * end at that time, so it is treated as infinitely far in the future.
 * @param deadline
 * @returns
 */ function getRelativeTimeout(deadline) {
    const deadlineMs = deadline instanceof Date ? deadline.getTime() : deadline;
    const now = new Date().getTime();
    const timeout = deadlineMs - now;
    if (timeout < 0) {
        return 0;
    } else if (timeout > MAX_TIMEOUT_TIME) {
        return Infinity;
    } else {
        return timeout;
    }
}
exports.getRelativeTimeout = getRelativeTimeout;
function deadlineToString(deadline) {
    if (deadline instanceof Date) {
        return deadline.toISOString();
    } else {
        const dateDeadline = new Date(deadline);
        if (Number.isNaN(dateDeadline.getTime())) {
            return '' + deadline;
        } else {
            return dateDeadline.toISOString();
        }
    }
}
exports.deadlineToString = deadlineToString;
/**
 * Calculate the difference between two dates as a number of seconds and format
 * it as a string.
 * @param startDate
 * @param endDate
 * @returns
 */ function formatDateDifference(startDate, endDate) {
    return ((endDate.getTime() - startDate.getTime()) / 1000).toFixed(3) + 's';
}
exports.formatDateDifference = formatDateDifference; //# sourceMappingURL=deadline.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/control-plane-status.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.restrictControlPlaneStatusCode = void 0;
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const INAPPROPRIATE_CONTROL_PLANE_CODES = [
    constants_1.Status.OK,
    constants_1.Status.INVALID_ARGUMENT,
    constants_1.Status.NOT_FOUND,
    constants_1.Status.ALREADY_EXISTS,
    constants_1.Status.FAILED_PRECONDITION,
    constants_1.Status.ABORTED,
    constants_1.Status.OUT_OF_RANGE,
    constants_1.Status.DATA_LOSS
];
function restrictControlPlaneStatusCode(code, details) {
    if (INAPPROPRIATE_CONTROL_PLANE_CODES.includes(code)) {
        return {
            code: constants_1.Status.INTERNAL,
            details: `Invalid status from control plane: ${code} ${constants_1.Status[code]} ${details}`
        };
    } else {
        return {
            code,
            details
        };
    }
}
exports.restrictControlPlaneStatusCode = restrictControlPlaneStatusCode; //# sourceMappingURL=control-plane-status.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancing-call.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.LoadBalancingCall = void 0;
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const deadline_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/deadline.js [app-rsc] (ecmascript)");
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const picker_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/picker.js [app-rsc] (ecmascript)");
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const control_plane_status_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/control-plane-status.js [app-rsc] (ecmascript)");
const http2 = __turbopack_require__("[externals]/ [external] (http2, cjs)");
const TRACER_NAME = 'load_balancing_call';
class LoadBalancingCall {
    constructor(channel, callConfig, methodName, host, credentials, deadline, callNumber){
        var _a, _b;
        this.channel = channel;
        this.callConfig = callConfig;
        this.methodName = methodName;
        this.host = host;
        this.credentials = credentials;
        this.deadline = deadline;
        this.callNumber = callNumber;
        this.child = null;
        this.readPending = false;
        this.pendingMessage = null;
        this.pendingHalfClose = false;
        this.ended = false;
        this.metadata = null;
        this.listener = null;
        this.onCallEnded = null;
        this.childStartTime = null;
        const splitPath = this.methodName.split('/');
        let serviceName = '';
        /* The standard path format is "/{serviceName}/{methodName}", so if we split
         * by '/', the first item should be empty and the second should be the
         * service name */ if (splitPath.length >= 2) {
            serviceName = splitPath[1];
        }
        const hostname = (_b = (_a = (0, uri_parser_1.splitHostPort)(this.host)) === null || _a === void 0 ? void 0 : _a.host) !== null && _b !== void 0 ? _b : 'localhost';
        /* Currently, call credentials are only allowed on HTTPS connections, so we
         * can assume that the scheme is "https" */ this.serviceUrl = `https://${hostname}/${serviceName}`;
        this.startTime = new Date();
    }
    getDeadlineInfo() {
        var _a, _b;
        const deadlineInfo = [];
        if (this.childStartTime) {
            if (this.childStartTime > this.startTime) {
                if ((_a = this.metadata) === null || _a === void 0 ? void 0 : _a.getOptions().waitForReady) {
                    deadlineInfo.push('wait_for_ready');
                }
                deadlineInfo.push(`LB pick: ${(0, deadline_1.formatDateDifference)(this.startTime, this.childStartTime)}`);
            }
            deadlineInfo.push(...this.child.getDeadlineInfo());
            return deadlineInfo;
        } else {
            if ((_b = this.metadata) === null || _b === void 0 ? void 0 : _b.getOptions().waitForReady) {
                deadlineInfo.push('wait_for_ready');
            }
            deadlineInfo.push('Waiting for LB pick');
        }
        return deadlineInfo;
    }
    trace(text) {
        logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, '[' + this.callNumber + '] ' + text);
    }
    outputStatus(status, progress) {
        var _a, _b;
        if (!this.ended) {
            this.ended = true;
            this.trace('ended with status: code=' + status.code + ' details="' + status.details + '" start time=' + this.startTime.toISOString());
            const finalStatus = Object.assign(Object.assign({}, status), {
                progress
            });
            (_a = this.listener) === null || _a === void 0 ? void 0 : _a.onReceiveStatus(finalStatus);
            (_b = this.onCallEnded) === null || _b === void 0 ? void 0 : _b.call(this, finalStatus.code);
        }
    }
    doPick() {
        var _a, _b;
        if (this.ended) {
            return;
        }
        if (!this.metadata) {
            throw new Error('doPick called before start');
        }
        this.trace('Pick called');
        const finalMetadata = this.metadata.clone();
        const pickResult = this.channel.doPick(finalMetadata, this.callConfig.pickInformation);
        const subchannelString = pickResult.subchannel ? '(' + pickResult.subchannel.getChannelzRef().id + ') ' + pickResult.subchannel.getAddress() : '' + pickResult.subchannel;
        this.trace('Pick result: ' + picker_1.PickResultType[pickResult.pickResultType] + ' subchannel: ' + subchannelString + ' status: ' + ((_a = pickResult.status) === null || _a === void 0 ? void 0 : _a.code) + ' ' + ((_b = pickResult.status) === null || _b === void 0 ? void 0 : _b.details));
        switch(pickResult.pickResultType){
            case picker_1.PickResultType.COMPLETE:
                this.credentials.generateMetadata({
                    method_name: this.methodName,
                    service_url: this.serviceUrl
                }).then((credsMetadata)=>{
                    var _a, _b, _c;
                    /* If this call was cancelled (e.g. by the deadline) before
                     * metadata generation finished, we shouldn't do anything with
                     * it. */ if (this.ended) {
                        this.trace('Credentials metadata generation finished after call ended');
                        return;
                    }
                    finalMetadata.merge(credsMetadata);
                    if (finalMetadata.get('authorization').length > 1) {
                        this.outputStatus({
                            code: constants_1.Status.INTERNAL,
                            details: '"authorization" metadata cannot have multiple values',
                            metadata: new metadata_1.Metadata()
                        }, 'PROCESSED');
                    }
                    if (pickResult.subchannel.getConnectivityState() !== connectivity_state_1.ConnectivityState.READY) {
                        this.trace('Picked subchannel ' + subchannelString + ' has state ' + connectivity_state_1.ConnectivityState[pickResult.subchannel.getConnectivityState()] + ' after getting credentials metadata. Retrying pick');
                        this.doPick();
                        return;
                    }
                    if (this.deadline !== Infinity) {
                        finalMetadata.set('grpc-timeout', (0, deadline_1.getDeadlineTimeoutString)(this.deadline));
                    }
                    try {
                        this.child = pickResult.subchannel.getRealSubchannel().createCall(finalMetadata, this.host, this.methodName, {
                            onReceiveMetadata: (metadata)=>{
                                this.trace('Received metadata');
                                this.listener.onReceiveMetadata(metadata);
                            },
                            onReceiveMessage: (message)=>{
                                this.trace('Received message');
                                this.listener.onReceiveMessage(message);
                            },
                            onReceiveStatus: (status)=>{
                                this.trace('Received status');
                                if (status.rstCode === http2.constants.NGHTTP2_REFUSED_STREAM) {
                                    this.outputStatus(status, 'REFUSED');
                                } else {
                                    this.outputStatus(status, 'PROCESSED');
                                }
                            }
                        });
                        this.childStartTime = new Date();
                    } catch (error) {
                        this.trace('Failed to start call on picked subchannel ' + subchannelString + ' with error ' + error.message);
                        this.outputStatus({
                            code: constants_1.Status.INTERNAL,
                            details: 'Failed to start HTTP/2 stream with error ' + error.message,
                            metadata: new metadata_1.Metadata()
                        }, 'NOT_STARTED');
                        return;
                    }
                    (_b = (_a = this.callConfig).onCommitted) === null || _b === void 0 ? void 0 : _b.call(_a);
                    (_c = pickResult.onCallStarted) === null || _c === void 0 ? void 0 : _c.call(pickResult);
                    this.onCallEnded = pickResult.onCallEnded;
                    this.trace('Created child call [' + this.child.getCallNumber() + ']');
                    if (this.readPending) {
                        this.child.startRead();
                    }
                    if (this.pendingMessage) {
                        this.child.sendMessageWithContext(this.pendingMessage.context, this.pendingMessage.message);
                    }
                    if (this.pendingHalfClose) {
                        this.child.halfClose();
                    }
                }, (error)=>{
                    // We assume the error code isn't 0 (Status.OK)
                    const { code, details } = (0, control_plane_status_1.restrictControlPlaneStatusCode)(typeof error.code === 'number' ? error.code : constants_1.Status.UNKNOWN, `Getting metadata from plugin failed with error: ${error.message}`);
                    this.outputStatus({
                        code: code,
                        details: details,
                        metadata: new metadata_1.Metadata()
                    }, 'PROCESSED');
                });
                break;
            case picker_1.PickResultType.DROP:
                const { code, details } = (0, control_plane_status_1.restrictControlPlaneStatusCode)(pickResult.status.code, pickResult.status.details);
                setImmediate(()=>{
                    this.outputStatus({
                        code,
                        details,
                        metadata: pickResult.status.metadata
                    }, 'DROP');
                });
                break;
            case picker_1.PickResultType.TRANSIENT_FAILURE:
                if (this.metadata.getOptions().waitForReady) {
                    this.channel.queueCallForPick(this);
                } else {
                    const { code, details } = (0, control_plane_status_1.restrictControlPlaneStatusCode)(pickResult.status.code, pickResult.status.details);
                    setImmediate(()=>{
                        this.outputStatus({
                            code,
                            details,
                            metadata: pickResult.status.metadata
                        }, 'PROCESSED');
                    });
                }
                break;
            case picker_1.PickResultType.QUEUE:
                this.channel.queueCallForPick(this);
        }
    }
    cancelWithStatus(status, details) {
        var _a;
        this.trace('cancelWithStatus code: ' + status + ' details: "' + details + '"');
        (_a = this.child) === null || _a === void 0 ? void 0 : _a.cancelWithStatus(status, details);
        this.outputStatus({
            code: status,
            details: details,
            metadata: new metadata_1.Metadata()
        }, 'PROCESSED');
    }
    getPeer() {
        var _a, _b;
        return (_b = (_a = this.child) === null || _a === void 0 ? void 0 : _a.getPeer()) !== null && _b !== void 0 ? _b : this.channel.getTarget();
    }
    start(metadata, listener) {
        this.trace('start called');
        this.listener = listener;
        this.metadata = metadata;
        this.doPick();
    }
    sendMessageWithContext(context, message) {
        this.trace('write() called with message of length ' + message.length);
        if (this.child) {
            this.child.sendMessageWithContext(context, message);
        } else {
            this.pendingMessage = {
                context,
                message
            };
        }
    }
    startRead() {
        this.trace('startRead called');
        if (this.child) {
            this.child.startRead();
        } else {
            this.readPending = true;
        }
    }
    halfClose() {
        this.trace('halfClose called');
        if (this.child) {
            this.child.halfClose();
        } else {
            this.pendingHalfClose = true;
        }
    }
    setCredentials(credentials) {
        throw new Error('Method not implemented.');
    }
    getCallNumber() {
        return this.callNumber;
    }
}
exports.LoadBalancingCall = LoadBalancingCall; //# sourceMappingURL=load-balancing-call.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolving-call.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ResolvingCall = void 0;
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const deadline_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/deadline.js [app-rsc] (ecmascript)");
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const control_plane_status_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/control-plane-status.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'resolving_call';
class ResolvingCall {
    constructor(channel, method, options, filterStackFactory, credentials, callNumber){
        this.channel = channel;
        this.method = method;
        this.filterStackFactory = filterStackFactory;
        this.credentials = credentials;
        this.callNumber = callNumber;
        this.child = null;
        this.readPending = false;
        this.pendingMessage = null;
        this.pendingHalfClose = false;
        this.ended = false;
        this.readFilterPending = false;
        this.writeFilterPending = false;
        this.pendingChildStatus = null;
        this.metadata = null;
        this.listener = null;
        this.statusWatchers = [];
        this.deadlineTimer = setTimeout(()=>{}, 0);
        this.filterStack = null;
        this.deadlineStartTime = null;
        this.configReceivedTime = null;
        this.childStartTime = null;
        this.deadline = options.deadline;
        this.host = options.host;
        if (options.parentCall) {
            if (options.flags & constants_1.Propagate.CANCELLATION) {
                options.parentCall.on('cancelled', ()=>{
                    this.cancelWithStatus(constants_1.Status.CANCELLED, 'Cancelled by parent call');
                });
            }
            if (options.flags & constants_1.Propagate.DEADLINE) {
                this.trace('Propagating deadline from parent: ' + options.parentCall.getDeadline());
                this.deadline = (0, deadline_1.minDeadline)(this.deadline, options.parentCall.getDeadline());
            }
        }
        this.trace('Created');
        this.runDeadlineTimer();
    }
    trace(text) {
        logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, '[' + this.callNumber + '] ' + text);
    }
    runDeadlineTimer() {
        clearTimeout(this.deadlineTimer);
        this.deadlineStartTime = new Date();
        this.trace('Deadline: ' + (0, deadline_1.deadlineToString)(this.deadline));
        const timeout = (0, deadline_1.getRelativeTimeout)(this.deadline);
        if (timeout !== Infinity) {
            this.trace('Deadline will be reached in ' + timeout + 'ms');
            const handleDeadline = ()=>{
                if (!this.deadlineStartTime) {
                    this.cancelWithStatus(constants_1.Status.DEADLINE_EXCEEDED, 'Deadline exceeded');
                    return;
                }
                const deadlineInfo = [];
                const deadlineEndTime = new Date();
                deadlineInfo.push(`Deadline exceeded after ${(0, deadline_1.formatDateDifference)(this.deadlineStartTime, deadlineEndTime)}`);
                if (this.configReceivedTime) {
                    if (this.configReceivedTime > this.deadlineStartTime) {
                        deadlineInfo.push(`name resolution: ${(0, deadline_1.formatDateDifference)(this.deadlineStartTime, this.configReceivedTime)}`);
                    }
                    if (this.childStartTime) {
                        if (this.childStartTime > this.configReceivedTime) {
                            deadlineInfo.push(`metadata filters: ${(0, deadline_1.formatDateDifference)(this.configReceivedTime, this.childStartTime)}`);
                        }
                    } else {
                        deadlineInfo.push('waiting for metadata filters');
                    }
                } else {
                    deadlineInfo.push('waiting for name resolution');
                }
                if (this.child) {
                    deadlineInfo.push(...this.child.getDeadlineInfo());
                }
                this.cancelWithStatus(constants_1.Status.DEADLINE_EXCEEDED, deadlineInfo.join(','));
            };
            if (timeout <= 0) {
                process.nextTick(handleDeadline);
            } else {
                this.deadlineTimer = setTimeout(handleDeadline, timeout);
            }
        }
    }
    outputStatus(status) {
        if (!this.ended) {
            this.ended = true;
            if (!this.filterStack) {
                this.filterStack = this.filterStackFactory.createFilter();
            }
            clearTimeout(this.deadlineTimer);
            const filteredStatus = this.filterStack.receiveTrailers(status);
            this.trace('ended with status: code=' + filteredStatus.code + ' details="' + filteredStatus.details + '"');
            this.statusWatchers.forEach((watcher)=>watcher(filteredStatus));
            process.nextTick(()=>{
                var _a;
                (_a = this.listener) === null || _a === void 0 ? void 0 : _a.onReceiveStatus(filteredStatus);
            });
        }
    }
    sendMessageOnChild(context, message) {
        if (!this.child) {
            throw new Error('sendMessageonChild called with child not populated');
        }
        const child = this.child;
        this.writeFilterPending = true;
        this.filterStack.sendMessage(Promise.resolve({
            message: message,
            flags: context.flags
        })).then((filteredMessage)=>{
            this.writeFilterPending = false;
            child.sendMessageWithContext(context, filteredMessage.message);
            if (this.pendingHalfClose) {
                child.halfClose();
            }
        }, (status)=>{
            this.cancelWithStatus(status.code, status.details);
        });
    }
    getConfig() {
        if (this.ended) {
            return;
        }
        if (!this.metadata || !this.listener) {
            throw new Error('getConfig called before start');
        }
        const configResult = this.channel.getConfig(this.method, this.metadata);
        if (configResult.type === 'NONE') {
            this.channel.queueCallForConfig(this);
            return;
        } else if (configResult.type === 'ERROR') {
            if (this.metadata.getOptions().waitForReady) {
                this.channel.queueCallForConfig(this);
            } else {
                this.outputStatus(configResult.error);
            }
            return;
        }
        // configResult.type === 'SUCCESS'
        this.configReceivedTime = new Date();
        const config = configResult.config;
        if (config.status !== constants_1.Status.OK) {
            const { code, details } = (0, control_plane_status_1.restrictControlPlaneStatusCode)(config.status, 'Failed to route call to method ' + this.method);
            this.outputStatus({
                code: code,
                details: details,
                metadata: new metadata_1.Metadata()
            });
            return;
        }
        if (config.methodConfig.timeout) {
            const configDeadline = new Date();
            configDeadline.setSeconds(configDeadline.getSeconds() + config.methodConfig.timeout.seconds);
            configDeadline.setMilliseconds(configDeadline.getMilliseconds() + config.methodConfig.timeout.nanos / 1000000);
            this.deadline = (0, deadline_1.minDeadline)(this.deadline, configDeadline);
            this.runDeadlineTimer();
        }
        this.filterStackFactory.push(config.dynamicFilterFactories);
        this.filterStack = this.filterStackFactory.createFilter();
        this.filterStack.sendMetadata(Promise.resolve(this.metadata)).then((filteredMetadata)=>{
            this.child = this.channel.createInnerCall(config, this.method, this.host, this.credentials, this.deadline);
            this.trace('Created child [' + this.child.getCallNumber() + ']');
            this.childStartTime = new Date();
            this.child.start(filteredMetadata, {
                onReceiveMetadata: (metadata)=>{
                    this.trace('Received metadata');
                    this.listener.onReceiveMetadata(this.filterStack.receiveMetadata(metadata));
                },
                onReceiveMessage: (message)=>{
                    this.trace('Received message');
                    this.readFilterPending = true;
                    this.filterStack.receiveMessage(message).then((filteredMesssage)=>{
                        this.trace('Finished filtering received message');
                        this.readFilterPending = false;
                        this.listener.onReceiveMessage(filteredMesssage);
                        if (this.pendingChildStatus) {
                            this.outputStatus(this.pendingChildStatus);
                        }
                    }, (status)=>{
                        this.cancelWithStatus(status.code, status.details);
                    });
                },
                onReceiveStatus: (status)=>{
                    this.trace('Received status');
                    if (this.readFilterPending) {
                        this.pendingChildStatus = status;
                    } else {
                        this.outputStatus(status);
                    }
                }
            });
            if (this.readPending) {
                this.child.startRead();
            }
            if (this.pendingMessage) {
                this.sendMessageOnChild(this.pendingMessage.context, this.pendingMessage.message);
            } else if (this.pendingHalfClose) {
                this.child.halfClose();
            }
        }, (status)=>{
            this.outputStatus(status);
        });
    }
    reportResolverError(status) {
        var _a;
        if ((_a = this.metadata) === null || _a === void 0 ? void 0 : _a.getOptions().waitForReady) {
            this.channel.queueCallForConfig(this);
        } else {
            this.outputStatus(status);
        }
    }
    cancelWithStatus(status, details) {
        var _a;
        this.trace('cancelWithStatus code: ' + status + ' details: "' + details + '"');
        (_a = this.child) === null || _a === void 0 ? void 0 : _a.cancelWithStatus(status, details);
        this.outputStatus({
            code: status,
            details: details,
            metadata: new metadata_1.Metadata()
        });
    }
    getPeer() {
        var _a, _b;
        return (_b = (_a = this.child) === null || _a === void 0 ? void 0 : _a.getPeer()) !== null && _b !== void 0 ? _b : this.channel.getTarget();
    }
    start(metadata, listener) {
        this.trace('start called');
        this.metadata = metadata.clone();
        this.listener = listener;
        this.getConfig();
    }
    sendMessageWithContext(context, message) {
        this.trace('write() called with message of length ' + message.length);
        if (this.child) {
            this.sendMessageOnChild(context, message);
        } else {
            this.pendingMessage = {
                context,
                message
            };
        }
    }
    startRead() {
        this.trace('startRead called');
        if (this.child) {
            this.child.startRead();
        } else {
            this.readPending = true;
        }
    }
    halfClose() {
        this.trace('halfClose called');
        if (this.child && !this.writeFilterPending) {
            this.child.halfClose();
        } else {
            this.pendingHalfClose = true;
        }
    }
    setCredentials(credentials) {
        this.credentials = this.credentials.compose(credentials);
    }
    addStatusWatcher(watcher) {
        this.statusWatchers.push(watcher);
    }
    getCallNumber() {
        return this.callNumber;
    }
}
exports.ResolvingCall = ResolvingCall; //# sourceMappingURL=resolving-call.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/retrying-call.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.RetryingCall = exports.MessageBufferTracker = exports.RetryThrottler = void 0;
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const deadline_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/deadline.js [app-rsc] (ecmascript)");
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'retrying_call';
class RetryThrottler {
    constructor(maxTokens, tokenRatio, previousRetryThrottler){
        this.maxTokens = maxTokens;
        this.tokenRatio = tokenRatio;
        if (previousRetryThrottler) {
            /* When carrying over tokens from a previous config, rescale them to the
             * new max value */ this.tokens = previousRetryThrottler.tokens * (maxTokens / previousRetryThrottler.maxTokens);
        } else {
            this.tokens = maxTokens;
        }
    }
    addCallSucceeded() {
        this.tokens = Math.max(this.tokens + this.tokenRatio, this.maxTokens);
    }
    addCallFailed() {
        this.tokens = Math.min(this.tokens - 1, 0);
    }
    canRetryCall() {
        return this.tokens > this.maxTokens / 2;
    }
}
exports.RetryThrottler = RetryThrottler;
class MessageBufferTracker {
    constructor(totalLimit, limitPerCall){
        this.totalLimit = totalLimit;
        this.limitPerCall = limitPerCall;
        this.totalAllocated = 0;
        this.allocatedPerCall = new Map();
    }
    allocate(size, callId) {
        var _a;
        const currentPerCall = (_a = this.allocatedPerCall.get(callId)) !== null && _a !== void 0 ? _a : 0;
        if (this.limitPerCall - currentPerCall < size || this.totalLimit - this.totalAllocated < size) {
            return false;
        }
        this.allocatedPerCall.set(callId, currentPerCall + size);
        this.totalAllocated += size;
        return true;
    }
    free(size, callId) {
        var _a;
        if (this.totalAllocated < size) {
            throw new Error(`Invalid buffer allocation state: call ${callId} freed ${size} > total allocated ${this.totalAllocated}`);
        }
        this.totalAllocated -= size;
        const currentPerCall = (_a = this.allocatedPerCall.get(callId)) !== null && _a !== void 0 ? _a : 0;
        if (currentPerCall < size) {
            throw new Error(`Invalid buffer allocation state: call ${callId} freed ${size} > allocated for call ${currentPerCall}`);
        }
        this.allocatedPerCall.set(callId, currentPerCall - size);
    }
    freeAll(callId) {
        var _a;
        const currentPerCall = (_a = this.allocatedPerCall.get(callId)) !== null && _a !== void 0 ? _a : 0;
        if (this.totalAllocated < currentPerCall) {
            throw new Error(`Invalid buffer allocation state: call ${callId} allocated ${currentPerCall} > total allocated ${this.totalAllocated}`);
        }
        this.totalAllocated -= currentPerCall;
        this.allocatedPerCall.delete(callId);
    }
}
exports.MessageBufferTracker = MessageBufferTracker;
const PREVIONS_RPC_ATTEMPTS_METADATA_KEY = 'grpc-previous-rpc-attempts';
const DEFAULT_MAX_ATTEMPTS_LIMIT = 5;
class RetryingCall {
    constructor(channel, callConfig, methodName, host, credentials, deadline, callNumber, bufferTracker, retryThrottler){
        var _a;
        this.channel = channel;
        this.callConfig = callConfig;
        this.methodName = methodName;
        this.host = host;
        this.credentials = credentials;
        this.deadline = deadline;
        this.callNumber = callNumber;
        this.bufferTracker = bufferTracker;
        this.retryThrottler = retryThrottler;
        this.listener = null;
        this.initialMetadata = null;
        this.underlyingCalls = [];
        this.writeBuffer = [];
        /**
         * The offset of message indices in the writeBuffer. For example, if
         * writeBufferOffset is 10, message 10 is in writeBuffer[0] and message 15
         * is in writeBuffer[5].
         */ this.writeBufferOffset = 0;
        /**
         * Tracks whether a read has been started, so that we know whether to start
         * reads on new child calls. This only matters for the first read, because
         * once a message comes in the child call becomes committed and there will
         * be no new child calls.
         */ this.readStarted = false;
        this.transparentRetryUsed = false;
        /**
         * Number of attempts so far
         */ this.attempts = 0;
        this.hedgingTimer = null;
        this.committedCallIndex = null;
        this.initialRetryBackoffSec = 0;
        this.nextRetryBackoffSec = 0;
        const maxAttemptsLimit = (_a = channel.getOptions()['grpc-node.retry_max_attempts_limit']) !== null && _a !== void 0 ? _a : DEFAULT_MAX_ATTEMPTS_LIMIT;
        if (callConfig.methodConfig.retryPolicy) {
            this.state = 'RETRY';
            const retryPolicy = callConfig.methodConfig.retryPolicy;
            this.nextRetryBackoffSec = this.initialRetryBackoffSec = Number(retryPolicy.initialBackoff.substring(0, retryPolicy.initialBackoff.length - 1));
            this.maxAttempts = Math.min(retryPolicy.maxAttempts, maxAttemptsLimit);
        } else if (callConfig.methodConfig.hedgingPolicy) {
            this.state = 'HEDGING';
            this.maxAttempts = Math.min(callConfig.methodConfig.hedgingPolicy.maxAttempts, maxAttemptsLimit);
        } else {
            this.state = 'TRANSPARENT_ONLY';
            this.maxAttempts = 1;
        }
        this.startTime = new Date();
    }
    getDeadlineInfo() {
        if (this.underlyingCalls.length === 0) {
            return [];
        }
        const deadlineInfo = [];
        const latestCall = this.underlyingCalls[this.underlyingCalls.length - 1];
        if (this.underlyingCalls.length > 1) {
            deadlineInfo.push(`previous attempts: ${this.underlyingCalls.length - 1}`);
        }
        if (latestCall.startTime > this.startTime) {
            deadlineInfo.push(`time to current attempt start: ${(0, deadline_1.formatDateDifference)(this.startTime, latestCall.startTime)}`);
        }
        deadlineInfo.push(...latestCall.call.getDeadlineInfo());
        return deadlineInfo;
    }
    getCallNumber() {
        return this.callNumber;
    }
    trace(text) {
        logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, '[' + this.callNumber + '] ' + text);
    }
    reportStatus(statusObject) {
        this.trace('ended with status: code=' + statusObject.code + ' details="' + statusObject.details + '" start time=' + this.startTime.toISOString());
        this.bufferTracker.freeAll(this.callNumber);
        this.writeBufferOffset = this.writeBufferOffset + this.writeBuffer.length;
        this.writeBuffer = [];
        process.nextTick(()=>{
            var _a;
            // Explicitly construct status object to remove progress field
            (_a = this.listener) === null || _a === void 0 ? void 0 : _a.onReceiveStatus({
                code: statusObject.code,
                details: statusObject.details,
                metadata: statusObject.metadata
            });
        });
    }
    cancelWithStatus(status, details) {
        this.trace('cancelWithStatus code: ' + status + ' details: "' + details + '"');
        this.reportStatus({
            code: status,
            details,
            metadata: new metadata_1.Metadata()
        });
        for (const { call } of this.underlyingCalls){
            call.cancelWithStatus(status, details);
        }
    }
    getPeer() {
        if (this.committedCallIndex !== null) {
            return this.underlyingCalls[this.committedCallIndex].call.getPeer();
        } else {
            return 'unknown';
        }
    }
    getBufferEntry(messageIndex) {
        var _a;
        return (_a = this.writeBuffer[messageIndex - this.writeBufferOffset]) !== null && _a !== void 0 ? _a : {
            entryType: 'FREED',
            allocated: false
        };
    }
    getNextBufferIndex() {
        return this.writeBufferOffset + this.writeBuffer.length;
    }
    clearSentMessages() {
        if (this.state !== 'COMMITTED') {
            return;
        }
        const earliestNeededMessageIndex = this.underlyingCalls[this.committedCallIndex].nextMessageToSend;
        for(let messageIndex = this.writeBufferOffset; messageIndex < earliestNeededMessageIndex; messageIndex++){
            const bufferEntry = this.getBufferEntry(messageIndex);
            if (bufferEntry.allocated) {
                this.bufferTracker.free(bufferEntry.message.message.length, this.callNumber);
            }
        }
        this.writeBuffer = this.writeBuffer.slice(earliestNeededMessageIndex - this.writeBufferOffset);
        this.writeBufferOffset = earliestNeededMessageIndex;
    }
    commitCall(index) {
        if (this.state === 'COMMITTED') {
            return;
        }
        if (this.underlyingCalls[index].state === 'COMPLETED') {
            return;
        }
        this.trace('Committing call [' + this.underlyingCalls[index].call.getCallNumber() + '] at index ' + index);
        this.state = 'COMMITTED';
        this.committedCallIndex = index;
        for(let i = 0; i < this.underlyingCalls.length; i++){
            if (i === index) {
                continue;
            }
            if (this.underlyingCalls[i].state === 'COMPLETED') {
                continue;
            }
            this.underlyingCalls[i].state = 'COMPLETED';
            this.underlyingCalls[i].call.cancelWithStatus(constants_1.Status.CANCELLED, 'Discarded in favor of other hedged attempt');
        }
        this.clearSentMessages();
    }
    commitCallWithMostMessages() {
        if (this.state === 'COMMITTED') {
            return;
        }
        let mostMessages = -1;
        let callWithMostMessages = -1;
        for (const [index, childCall] of this.underlyingCalls.entries()){
            if (childCall.state === 'ACTIVE' && childCall.nextMessageToSend > mostMessages) {
                mostMessages = childCall.nextMessageToSend;
                callWithMostMessages = index;
            }
        }
        if (callWithMostMessages === -1) {
            /* There are no active calls, disable retries to force the next call that
             * is started to be committed. */ this.state = 'TRANSPARENT_ONLY';
        } else {
            this.commitCall(callWithMostMessages);
        }
    }
    isStatusCodeInList(list, code) {
        return list.some((value)=>{
            var _a;
            return value === code || value.toString().toLowerCase() === ((_a = constants_1.Status[code]) === null || _a === void 0 ? void 0 : _a.toLowerCase());
        });
    }
    getNextRetryBackoffMs() {
        var _a;
        const retryPolicy = (_a = this.callConfig) === null || _a === void 0 ? void 0 : _a.methodConfig.retryPolicy;
        if (!retryPolicy) {
            return 0;
        }
        const nextBackoffMs = Math.random() * this.nextRetryBackoffSec * 1000;
        const maxBackoffSec = Number(retryPolicy.maxBackoff.substring(0, retryPolicy.maxBackoff.length - 1));
        this.nextRetryBackoffSec = Math.min(this.nextRetryBackoffSec * retryPolicy.backoffMultiplier, maxBackoffSec);
        return nextBackoffMs;
    }
    maybeRetryCall(pushback, callback) {
        if (this.state !== 'RETRY') {
            callback(false);
            return;
        }
        if (this.attempts >= this.maxAttempts) {
            callback(false);
            return;
        }
        let retryDelayMs;
        if (pushback === null) {
            retryDelayMs = this.getNextRetryBackoffMs();
        } else if (pushback < 0) {
            this.state = 'TRANSPARENT_ONLY';
            callback(false);
            return;
        } else {
            retryDelayMs = pushback;
            this.nextRetryBackoffSec = this.initialRetryBackoffSec;
        }
        setTimeout(()=>{
            var _a, _b;
            if (this.state !== 'RETRY') {
                callback(false);
                return;
            }
            if ((_b = (_a = this.retryThrottler) === null || _a === void 0 ? void 0 : _a.canRetryCall()) !== null && _b !== void 0 ? _b : true) {
                callback(true);
                this.attempts += 1;
                this.startNewAttempt();
            }
        }, retryDelayMs);
    }
    countActiveCalls() {
        let count = 0;
        for (const call of this.underlyingCalls){
            if ((call === null || call === void 0 ? void 0 : call.state) === 'ACTIVE') {
                count += 1;
            }
        }
        return count;
    }
    handleProcessedStatus(status, callIndex, pushback) {
        var _a, _b, _c;
        switch(this.state){
            case 'COMMITTED':
            case 'TRANSPARENT_ONLY':
                this.commitCall(callIndex);
                this.reportStatus(status);
                break;
            case 'HEDGING':
                if (this.isStatusCodeInList((_a = this.callConfig.methodConfig.hedgingPolicy.nonFatalStatusCodes) !== null && _a !== void 0 ? _a : [], status.code)) {
                    (_b = this.retryThrottler) === null || _b === void 0 ? void 0 : _b.addCallFailed();
                    let delayMs;
                    if (pushback === null) {
                        delayMs = 0;
                    } else if (pushback < 0) {
                        this.state = 'TRANSPARENT_ONLY';
                        this.commitCall(callIndex);
                        this.reportStatus(status);
                        return;
                    } else {
                        delayMs = pushback;
                    }
                    setTimeout(()=>{
                        this.maybeStartHedgingAttempt();
                        // If after trying to start a call there are no active calls, this was the last one
                        if (this.countActiveCalls() === 0) {
                            this.commitCall(callIndex);
                            this.reportStatus(status);
                        }
                    }, delayMs);
                } else {
                    this.commitCall(callIndex);
                    this.reportStatus(status);
                }
                break;
            case 'RETRY':
                if (this.isStatusCodeInList(this.callConfig.methodConfig.retryPolicy.retryableStatusCodes, status.code)) {
                    (_c = this.retryThrottler) === null || _c === void 0 ? void 0 : _c.addCallFailed();
                    this.maybeRetryCall(pushback, (retried)=>{
                        if (!retried) {
                            this.commitCall(callIndex);
                            this.reportStatus(status);
                        }
                    });
                } else {
                    this.commitCall(callIndex);
                    this.reportStatus(status);
                }
                break;
        }
    }
    getPushback(metadata) {
        const mdValue = metadata.get('grpc-retry-pushback-ms');
        if (mdValue.length === 0) {
            return null;
        }
        try {
            return parseInt(mdValue[0]);
        } catch (e) {
            return -1;
        }
    }
    handleChildStatus(status, callIndex) {
        var _a;
        if (this.underlyingCalls[callIndex].state === 'COMPLETED') {
            return;
        }
        this.trace('state=' + this.state + ' handling status with progress ' + status.progress + ' from child [' + this.underlyingCalls[callIndex].call.getCallNumber() + '] in state ' + this.underlyingCalls[callIndex].state);
        this.underlyingCalls[callIndex].state = 'COMPLETED';
        if (status.code === constants_1.Status.OK) {
            (_a = this.retryThrottler) === null || _a === void 0 ? void 0 : _a.addCallSucceeded();
            this.commitCall(callIndex);
            this.reportStatus(status);
            return;
        }
        if (this.state === 'COMMITTED') {
            this.reportStatus(status);
            return;
        }
        const pushback = this.getPushback(status.metadata);
        switch(status.progress){
            case 'NOT_STARTED':
                // RPC never leaves the client, always safe to retry
                this.startNewAttempt();
                break;
            case 'REFUSED':
                // RPC reaches the server library, but not the server application logic
                if (this.transparentRetryUsed) {
                    this.handleProcessedStatus(status, callIndex, pushback);
                } else {
                    this.transparentRetryUsed = true;
                    this.startNewAttempt();
                }
                break;
            case 'DROP':
                this.commitCall(callIndex);
                this.reportStatus(status);
                break;
            case 'PROCESSED':
                this.handleProcessedStatus(status, callIndex, pushback);
                break;
        }
    }
    maybeStartHedgingAttempt() {
        if (this.state !== 'HEDGING') {
            return;
        }
        if (!this.callConfig.methodConfig.hedgingPolicy) {
            return;
        }
        if (this.attempts >= this.maxAttempts) {
            return;
        }
        this.attempts += 1;
        this.startNewAttempt();
        this.maybeStartHedgingTimer();
    }
    maybeStartHedgingTimer() {
        var _a, _b, _c;
        if (this.hedgingTimer) {
            clearTimeout(this.hedgingTimer);
        }
        if (this.state !== 'HEDGING') {
            return;
        }
        if (!this.callConfig.methodConfig.hedgingPolicy) {
            return;
        }
        const hedgingPolicy = this.callConfig.methodConfig.hedgingPolicy;
        if (this.attempts >= this.maxAttempts) {
            return;
        }
        const hedgingDelayString = (_a = hedgingPolicy.hedgingDelay) !== null && _a !== void 0 ? _a : '0s';
        const hedgingDelaySec = Number(hedgingDelayString.substring(0, hedgingDelayString.length - 1));
        this.hedgingTimer = setTimeout(()=>{
            this.maybeStartHedgingAttempt();
        }, hedgingDelaySec * 1000);
        (_c = (_b = this.hedgingTimer).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
    }
    startNewAttempt() {
        const child = this.channel.createLoadBalancingCall(this.callConfig, this.methodName, this.host, this.credentials, this.deadline);
        this.trace('Created child call [' + child.getCallNumber() + '] for attempt ' + this.attempts);
        const index = this.underlyingCalls.length;
        this.underlyingCalls.push({
            state: 'ACTIVE',
            call: child,
            nextMessageToSend: 0,
            startTime: new Date()
        });
        const previousAttempts = this.attempts - 1;
        const initialMetadata = this.initialMetadata.clone();
        if (previousAttempts > 0) {
            initialMetadata.set(PREVIONS_RPC_ATTEMPTS_METADATA_KEY, `${previousAttempts}`);
        }
        let receivedMetadata = false;
        child.start(initialMetadata, {
            onReceiveMetadata: (metadata)=>{
                this.trace('Received metadata from child [' + child.getCallNumber() + ']');
                this.commitCall(index);
                receivedMetadata = true;
                if (previousAttempts > 0) {
                    metadata.set(PREVIONS_RPC_ATTEMPTS_METADATA_KEY, `${previousAttempts}`);
                }
                if (this.underlyingCalls[index].state === 'ACTIVE') {
                    this.listener.onReceiveMetadata(metadata);
                }
            },
            onReceiveMessage: (message)=>{
                this.trace('Received message from child [' + child.getCallNumber() + ']');
                this.commitCall(index);
                if (this.underlyingCalls[index].state === 'ACTIVE') {
                    this.listener.onReceiveMessage(message);
                }
            },
            onReceiveStatus: (status)=>{
                this.trace('Received status from child [' + child.getCallNumber() + ']');
                if (!receivedMetadata && previousAttempts > 0) {
                    status.metadata.set(PREVIONS_RPC_ATTEMPTS_METADATA_KEY, `${previousAttempts}`);
                }
                this.handleChildStatus(status, index);
            }
        });
        this.sendNextChildMessage(index);
        if (this.readStarted) {
            child.startRead();
        }
    }
    start(metadata, listener) {
        this.trace('start called');
        this.listener = listener;
        this.initialMetadata = metadata;
        this.attempts += 1;
        this.startNewAttempt();
        this.maybeStartHedgingTimer();
    }
    handleChildWriteCompleted(childIndex) {
        var _a, _b;
        const childCall = this.underlyingCalls[childIndex];
        const messageIndex = childCall.nextMessageToSend;
        (_b = (_a = this.getBufferEntry(messageIndex)).callback) === null || _b === void 0 ? void 0 : _b.call(_a);
        this.clearSentMessages();
        childCall.nextMessageToSend += 1;
        this.sendNextChildMessage(childIndex);
    }
    sendNextChildMessage(childIndex) {
        const childCall = this.underlyingCalls[childIndex];
        if (childCall.state === 'COMPLETED') {
            return;
        }
        if (this.getBufferEntry(childCall.nextMessageToSend)) {
            const bufferEntry = this.getBufferEntry(childCall.nextMessageToSend);
            switch(bufferEntry.entryType){
                case 'MESSAGE':
                    childCall.call.sendMessageWithContext({
                        callback: (error)=>{
                            // Ignore error
                            this.handleChildWriteCompleted(childIndex);
                        }
                    }, bufferEntry.message.message);
                    break;
                case 'HALF_CLOSE':
                    childCall.nextMessageToSend += 1;
                    childCall.call.halfClose();
                    break;
                case 'FREED':
                    break;
            }
        }
    }
    sendMessageWithContext(context, message) {
        var _a;
        this.trace('write() called with message of length ' + message.length);
        const writeObj = {
            message,
            flags: context.flags
        };
        const messageIndex = this.getNextBufferIndex();
        const bufferEntry = {
            entryType: 'MESSAGE',
            message: writeObj,
            allocated: this.bufferTracker.allocate(message.length, this.callNumber)
        };
        this.writeBuffer.push(bufferEntry);
        if (bufferEntry.allocated) {
            (_a = context.callback) === null || _a === void 0 ? void 0 : _a.call(context);
            for (const [callIndex, call] of this.underlyingCalls.entries()){
                if (call.state === 'ACTIVE' && call.nextMessageToSend === messageIndex) {
                    call.call.sendMessageWithContext({
                        callback: (error)=>{
                            // Ignore error
                            this.handleChildWriteCompleted(callIndex);
                        }
                    }, message);
                }
            }
        } else {
            this.commitCallWithMostMessages();
            // commitCallWithMostMessages can fail if we are between ping attempts
            if (this.committedCallIndex === null) {
                return;
            }
            const call = this.underlyingCalls[this.committedCallIndex];
            bufferEntry.callback = context.callback;
            if (call.state === 'ACTIVE' && call.nextMessageToSend === messageIndex) {
                call.call.sendMessageWithContext({
                    callback: (error)=>{
                        // Ignore error
                        this.handleChildWriteCompleted(this.committedCallIndex);
                    }
                }, message);
            }
        }
    }
    startRead() {
        this.trace('startRead called');
        this.readStarted = true;
        for (const underlyingCall of this.underlyingCalls){
            if ((underlyingCall === null || underlyingCall === void 0 ? void 0 : underlyingCall.state) === 'ACTIVE') {
                underlyingCall.call.startRead();
            }
        }
    }
    halfClose() {
        this.trace('halfClose called');
        const halfCloseIndex = this.getNextBufferIndex();
        this.writeBuffer.push({
            entryType: 'HALF_CLOSE',
            allocated: false
        });
        for (const call of this.underlyingCalls){
            if ((call === null || call === void 0 ? void 0 : call.state) === 'ACTIVE' && call.nextMessageToSend === halfCloseIndex) {
                call.nextMessageToSend += 1;
                call.call.halfClose();
            }
        }
    }
    setCredentials(newCredentials) {
        throw new Error('Method not implemented.');
    }
    getMethod() {
        return this.methodName;
    }
    getHost() {
        return this.host;
    }
}
exports.RetryingCall = RetryingCall; //# sourceMappingURL=retrying-call.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-interface.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.BaseSubchannelWrapper = void 0;
class BaseSubchannelWrapper {
    constructor(child){
        this.child = child;
        this.healthy = true;
        this.healthListeners = new Set();
        child.addHealthStateWatcher((childHealthy)=>{
            /* A change to the child health state only affects this wrapper's overall
             * health state if this wrapper is reporting healthy. */ if (this.healthy) {
                this.updateHealthListeners();
            }
        });
    }
    updateHealthListeners() {
        for (const listener of this.healthListeners){
            listener(this.isHealthy());
        }
    }
    getConnectivityState() {
        return this.child.getConnectivityState();
    }
    addConnectivityStateListener(listener) {
        this.child.addConnectivityStateListener(listener);
    }
    removeConnectivityStateListener(listener) {
        this.child.removeConnectivityStateListener(listener);
    }
    startConnecting() {
        this.child.startConnecting();
    }
    getAddress() {
        return this.child.getAddress();
    }
    throttleKeepalive(newKeepaliveTime) {
        this.child.throttleKeepalive(newKeepaliveTime);
    }
    ref() {
        this.child.ref();
    }
    unref() {
        this.child.unref();
    }
    getChannelzRef() {
        return this.child.getChannelzRef();
    }
    isHealthy() {
        return this.healthy && this.child.isHealthy();
    }
    addHealthStateWatcher(listener) {
        this.healthListeners.add(listener);
    }
    removeHealthStateWatcher(listener) {
        this.healthListeners.delete(listener);
    }
    setHealthy(healthy) {
        if (healthy !== this.healthy) {
            this.healthy = healthy;
            /* A change to this wrapper's health state only affects the overall
             * reported health state if the child is healthy. */ if (this.child.isHealthy()) {
                this.updateHealthListeners();
            }
        }
    }
    getRealSubchannel() {
        return this.child.getRealSubchannel();
    }
    realSubchannelEquals(other) {
        return this.getRealSubchannel() === other.getRealSubchannel();
    }
}
exports.BaseSubchannelWrapper = BaseSubchannelWrapper; //# sourceMappingURL=subchannel-interface.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/internal-channel.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InternalChannel = void 0;
const channel_credentials_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channel-credentials.js [app-rsc] (ecmascript)");
const resolving_load_balancer_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolving-load-balancer.js [app-rsc] (ecmascript)");
const subchannel_pool_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-pool.js [app-rsc] (ecmascript)");
const picker_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/picker.js [app-rsc] (ecmascript)");
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const filter_stack_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/filter-stack.js [app-rsc] (ecmascript)");
const compression_filter_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/compression-filter.js [app-rsc] (ecmascript)");
const resolver_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver.js [app-rsc] (ecmascript)");
const logging_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const http_proxy_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/http_proxy.js [app-rsc] (ecmascript)");
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
const channelz_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channelz.js [app-rsc] (ecmascript)");
const load_balancing_call_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancing-call.js [app-rsc] (ecmascript)");
const deadline_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/deadline.js [app-rsc] (ecmascript)");
const resolving_call_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolving-call.js [app-rsc] (ecmascript)");
const call_number_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/call-number.js [app-rsc] (ecmascript)");
const control_plane_status_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/control-plane-status.js [app-rsc] (ecmascript)");
const retrying_call_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/retrying-call.js [app-rsc] (ecmascript)");
const subchannel_interface_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-interface.js [app-rsc] (ecmascript)");
/**
 * See https://nodejs.org/api/timers.html#timers_setinterval_callback_delay_args
 */ const MAX_TIMEOUT_TIME = 2147483647;
const MIN_IDLE_TIMEOUT_MS = 1000;
// 30 minutes
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const RETRY_THROTTLER_MAP = new Map();
const DEFAULT_RETRY_BUFFER_SIZE_BYTES = 1 << 24; // 16 MB
const DEFAULT_PER_RPC_RETRY_BUFFER_SIZE_BYTES = 1 << 20; // 1 MB
class ChannelSubchannelWrapper extends subchannel_interface_1.BaseSubchannelWrapper {
    constructor(childSubchannel, channel){
        super(childSubchannel);
        this.channel = channel;
        this.refCount = 0;
        this.subchannelStateListener = (subchannel, previousState, newState, keepaliveTime)=>{
            channel.throttleKeepalive(keepaliveTime);
        };
        childSubchannel.addConnectivityStateListener(this.subchannelStateListener);
    }
    ref() {
        this.child.ref();
        this.refCount += 1;
    }
    unref() {
        this.child.unref();
        this.refCount -= 1;
        if (this.refCount <= 0) {
            this.child.removeConnectivityStateListener(this.subchannelStateListener);
            this.channel.removeWrappedSubchannel(this);
        }
    }
}
class ShutdownPicker {
    pick(pickArgs) {
        return {
            pickResultType: picker_1.PickResultType.DROP,
            status: {
                code: constants_1.Status.UNAVAILABLE,
                details: 'Channel closed before call started',
                metadata: new metadata_1.Metadata()
            },
            subchannel: null,
            onCallStarted: null,
            onCallEnded: null
        };
    }
}
class InternalChannel {
    constructor(target, credentials, options){
        var _a, _b, _c, _d, _e, _f, _g, _h;
        this.credentials = credentials;
        this.options = options;
        this.connectivityState = connectivity_state_1.ConnectivityState.IDLE;
        this.currentPicker = new picker_1.UnavailablePicker();
        /**
         * Calls queued up to get a call config. Should only be populated before the
         * first time the resolver returns a result, which includes the ConfigSelector.
         */ this.configSelectionQueue = [];
        this.pickQueue = [];
        this.connectivityStateWatchers = [];
        this.configSelector = null;
        /**
         * This is the error from the name resolver if it failed most recently. It
         * is only used to end calls that start while there is no config selector
         * and the name resolver is in backoff, so it should be nulled if
         * configSelector becomes set or the channel state becomes anything other
         * than TRANSIENT_FAILURE.
         */ this.currentResolutionError = null;
        this.wrappedSubchannels = new Set();
        this.callCount = 0;
        this.idleTimer = null;
        // Channelz info
        this.channelzEnabled = true;
        this.callTracker = new channelz_1.ChannelzCallTracker();
        this.childrenTracker = new channelz_1.ChannelzChildrenTracker();
        /**
         * Randomly generated ID to be passed to the config selector, for use by
         * ring_hash in xDS. An integer distributed approximately uniformly between
         * 0 and MAX_SAFE_INTEGER.
         */ this.randomChannelId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        if (typeof target !== 'string') {
            throw new TypeError('Channel target must be a string');
        }
        if (!(credentials instanceof channel_credentials_1.ChannelCredentials)) {
            throw new TypeError('Channel credentials must be a ChannelCredentials object');
        }
        if (options) {
            if (typeof options !== 'object') {
                throw new TypeError('Channel options must be an object');
            }
        }
        this.originalTarget = target;
        const originalTargetUri = (0, uri_parser_1.parseUri)(target);
        if (originalTargetUri === null) {
            throw new Error(`Could not parse target name "${target}"`);
        }
        /* This ensures that the target has a scheme that is registered with the
         * resolver */ const defaultSchemeMapResult = (0, resolver_1.mapUriDefaultScheme)(originalTargetUri);
        if (defaultSchemeMapResult === null) {
            throw new Error(`Could not find a default scheme for target name "${target}"`);
        }
        this.callRefTimer = setInterval(()=>{}, MAX_TIMEOUT_TIME);
        (_b = (_a = this.callRefTimer).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
        if (this.options['grpc.enable_channelz'] === 0) {
            this.channelzEnabled = false;
        }
        this.channelzTrace = new channelz_1.ChannelzTrace();
        this.channelzRef = (0, channelz_1.registerChannelzChannel)(target, ()=>this.getChannelzInfo(), this.channelzEnabled);
        if (this.channelzEnabled) {
            this.channelzTrace.addTrace('CT_INFO', 'Channel created');
        }
        if (this.options['grpc.default_authority']) {
            this.defaultAuthority = this.options['grpc.default_authority'];
        } else {
            this.defaultAuthority = (0, resolver_1.getDefaultAuthority)(defaultSchemeMapResult);
        }
        const proxyMapResult = (0, http_proxy_1.mapProxyName)(defaultSchemeMapResult, options);
        this.target = proxyMapResult.target;
        this.options = Object.assign({}, this.options, proxyMapResult.extraOptions);
        /* The global boolean parameter to getSubchannelPool has the inverse meaning to what
         * the grpc.use_local_subchannel_pool channel option means. */ this.subchannelPool = (0, subchannel_pool_1.getSubchannelPool)(((_c = options['grpc.use_local_subchannel_pool']) !== null && _c !== void 0 ? _c : 0) === 0);
        this.retryBufferTracker = new retrying_call_1.MessageBufferTracker((_d = options['grpc.retry_buffer_size']) !== null && _d !== void 0 ? _d : DEFAULT_RETRY_BUFFER_SIZE_BYTES, (_e = options['grpc.per_rpc_retry_buffer_size']) !== null && _e !== void 0 ? _e : DEFAULT_PER_RPC_RETRY_BUFFER_SIZE_BYTES);
        this.keepaliveTime = (_f = options['grpc.keepalive_time_ms']) !== null && _f !== void 0 ? _f : -1;
        this.idleTimeoutMs = Math.max((_g = options['grpc.client_idle_timeout_ms']) !== null && _g !== void 0 ? _g : DEFAULT_IDLE_TIMEOUT_MS, MIN_IDLE_TIMEOUT_MS);
        const channelControlHelper = {
            createSubchannel: (subchannelAddress, subchannelArgs, credentialsOverride)=>{
                const subchannel = this.subchannelPool.getOrCreateSubchannel(this.target, subchannelAddress, Object.assign({}, this.options, subchannelArgs), credentialsOverride !== null && credentialsOverride !== void 0 ? credentialsOverride : this.credentials);
                subchannel.throttleKeepalive(this.keepaliveTime);
                if (this.channelzEnabled) {
                    this.channelzTrace.addTrace('CT_INFO', 'Created subchannel or used existing subchannel', subchannel.getChannelzRef());
                }
                const wrappedSubchannel = new ChannelSubchannelWrapper(subchannel, this);
                this.wrappedSubchannels.add(wrappedSubchannel);
                return wrappedSubchannel;
            },
            updateState: (connectivityState, picker)=>{
                this.currentPicker = picker;
                const queueCopy = this.pickQueue.slice();
                this.pickQueue = [];
                if (queueCopy.length > 0) {
                    this.callRefTimerUnref();
                }
                for (const call of queueCopy){
                    call.doPick();
                }
                this.updateState(connectivityState);
            },
            requestReresolution: ()=>{
                // This should never be called.
                throw new Error('Resolving load balancer should never call requestReresolution');
            },
            addChannelzChild: (child)=>{
                if (this.channelzEnabled) {
                    this.childrenTracker.refChild(child);
                }
            },
            removeChannelzChild: (child)=>{
                if (this.channelzEnabled) {
                    this.childrenTracker.unrefChild(child);
                }
            }
        };
        this.resolvingLoadBalancer = new resolving_load_balancer_1.ResolvingLoadBalancer(this.target, channelControlHelper, credentials, options, (serviceConfig, configSelector)=>{
            if (serviceConfig.retryThrottling) {
                RETRY_THROTTLER_MAP.set(this.getTarget(), new retrying_call_1.RetryThrottler(serviceConfig.retryThrottling.maxTokens, serviceConfig.retryThrottling.tokenRatio, RETRY_THROTTLER_MAP.get(this.getTarget())));
            } else {
                RETRY_THROTTLER_MAP.delete(this.getTarget());
            }
            if (this.channelzEnabled) {
                this.channelzTrace.addTrace('CT_INFO', 'Address resolution succeeded');
            }
            this.configSelector = configSelector;
            this.currentResolutionError = null;
            /* We process the queue asynchronously to ensure that the corresponding
             * load balancer update has completed. */ process.nextTick(()=>{
                const localQueue = this.configSelectionQueue;
                this.configSelectionQueue = [];
                if (localQueue.length > 0) {
                    this.callRefTimerUnref();
                }
                for (const call of localQueue){
                    call.getConfig();
                }
            });
        }, (status)=>{
            if (this.channelzEnabled) {
                this.channelzTrace.addTrace('CT_WARNING', 'Address resolution failed with code ' + status.code + ' and details "' + status.details + '"');
            }
            if (this.configSelectionQueue.length > 0) {
                this.trace('Name resolution failed with calls queued for config selection');
            }
            if (this.configSelector === null) {
                this.currentResolutionError = Object.assign(Object.assign({}, (0, control_plane_status_1.restrictControlPlaneStatusCode)(status.code, status.details)), {
                    metadata: status.metadata
                });
            }
            const localQueue = this.configSelectionQueue;
            this.configSelectionQueue = [];
            if (localQueue.length > 0) {
                this.callRefTimerUnref();
            }
            for (const call of localQueue){
                call.reportResolverError(status);
            }
        });
        this.filterStackFactory = new filter_stack_1.FilterStackFactory([
            new compression_filter_1.CompressionFilterFactory(this, this.options)
        ]);
        this.trace('Channel constructed with options ' + JSON.stringify(options, undefined, 2));
        const error = new Error();
        if ((0, logging_1.isTracerEnabled)('channel_stacktrace')) {
            (0, logging_1.trace)(constants_1.LogVerbosity.DEBUG, 'channel_stacktrace', '(' + this.channelzRef.id + ') ' + 'Channel constructed \n' + ((_h = error.stack) === null || _h === void 0 ? void 0 : _h.substring(error.stack.indexOf('\n') + 1)));
        }
        this.lastActivityTimestamp = new Date();
    }
    getChannelzInfo() {
        return {
            target: this.originalTarget,
            state: this.connectivityState,
            trace: this.channelzTrace,
            callTracker: this.callTracker,
            children: this.childrenTracker.getChildLists()
        };
    }
    trace(text, verbosityOverride) {
        (0, logging_1.trace)(verbosityOverride !== null && verbosityOverride !== void 0 ? verbosityOverride : constants_1.LogVerbosity.DEBUG, 'channel', '(' + this.channelzRef.id + ') ' + (0, uri_parser_1.uriToString)(this.target) + ' ' + text);
    }
    callRefTimerRef() {
        var _a, _b, _c, _d;
        // If the hasRef function does not exist, always run the code
        if (!((_b = (_a = this.callRefTimer).hasRef) === null || _b === void 0 ? void 0 : _b.call(_a))) {
            this.trace('callRefTimer.ref | configSelectionQueue.length=' + this.configSelectionQueue.length + ' pickQueue.length=' + this.pickQueue.length);
            (_d = (_c = this.callRefTimer).ref) === null || _d === void 0 ? void 0 : _d.call(_c);
        }
    }
    callRefTimerUnref() {
        var _a, _b;
        // If the hasRef function does not exist, always run the code
        if (!this.callRefTimer.hasRef || this.callRefTimer.hasRef()) {
            this.trace('callRefTimer.unref | configSelectionQueue.length=' + this.configSelectionQueue.length + ' pickQueue.length=' + this.pickQueue.length);
            (_b = (_a = this.callRefTimer).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
    }
    removeConnectivityStateWatcher(watcherObject) {
        const watcherIndex = this.connectivityStateWatchers.findIndex((value)=>value === watcherObject);
        if (watcherIndex >= 0) {
            this.connectivityStateWatchers.splice(watcherIndex, 1);
        }
    }
    updateState(newState) {
        (0, logging_1.trace)(constants_1.LogVerbosity.DEBUG, 'connectivity_state', '(' + this.channelzRef.id + ') ' + (0, uri_parser_1.uriToString)(this.target) + ' ' + connectivity_state_1.ConnectivityState[this.connectivityState] + ' -> ' + connectivity_state_1.ConnectivityState[newState]);
        if (this.channelzEnabled) {
            this.channelzTrace.addTrace('CT_INFO', 'Connectivity state change to ' + connectivity_state_1.ConnectivityState[newState]);
        }
        this.connectivityState = newState;
        const watchersCopy = this.connectivityStateWatchers.slice();
        for (const watcherObject of watchersCopy){
            if (newState !== watcherObject.currentState) {
                if (watcherObject.timer) {
                    clearTimeout(watcherObject.timer);
                }
                this.removeConnectivityStateWatcher(watcherObject);
                watcherObject.callback();
            }
        }
        if (newState !== connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE) {
            this.currentResolutionError = null;
        }
    }
    throttleKeepalive(newKeepaliveTime) {
        if (newKeepaliveTime > this.keepaliveTime) {
            this.keepaliveTime = newKeepaliveTime;
            for (const wrappedSubchannel of this.wrappedSubchannels){
                wrappedSubchannel.throttleKeepalive(newKeepaliveTime);
            }
        }
    }
    removeWrappedSubchannel(wrappedSubchannel) {
        this.wrappedSubchannels.delete(wrappedSubchannel);
    }
    doPick(metadata, extraPickInfo) {
        return this.currentPicker.pick({
            metadata: metadata,
            extraPickInfo: extraPickInfo
        });
    }
    queueCallForPick(call) {
        this.pickQueue.push(call);
        this.callRefTimerRef();
    }
    getConfig(method, metadata) {
        if (this.connectivityState !== connectivity_state_1.ConnectivityState.SHUTDOWN) {
            this.resolvingLoadBalancer.exitIdle();
        }
        if (this.configSelector) {
            return {
                type: 'SUCCESS',
                config: this.configSelector(method, metadata, this.randomChannelId)
            };
        } else {
            if (this.currentResolutionError) {
                return {
                    type: 'ERROR',
                    error: this.currentResolutionError
                };
            } else {
                return {
                    type: 'NONE'
                };
            }
        }
    }
    queueCallForConfig(call) {
        this.configSelectionQueue.push(call);
        this.callRefTimerRef();
    }
    enterIdle() {
        this.resolvingLoadBalancer.destroy();
        this.updateState(connectivity_state_1.ConnectivityState.IDLE);
        this.currentPicker = new picker_1.QueuePicker(this.resolvingLoadBalancer);
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }
    startIdleTimeout(timeoutMs) {
        var _a, _b;
        this.idleTimer = setTimeout(()=>{
            if (this.callCount > 0) {
                /* If there is currently a call, the channel will not go idle for a
                 * period of at least idleTimeoutMs, so check again after that time.
                 */ this.startIdleTimeout(this.idleTimeoutMs);
                return;
            }
            const now = new Date();
            const timeSinceLastActivity = now.valueOf() - this.lastActivityTimestamp.valueOf();
            if (timeSinceLastActivity >= this.idleTimeoutMs) {
                this.trace('Idle timer triggered after ' + this.idleTimeoutMs + 'ms of inactivity');
                this.enterIdle();
            } else {
                /* Whenever the timer fires with the latest activity being too recent,
                 * set the timer again for the time when the time since the last
                 * activity is equal to the timeout. This should result in the timer
                 * firing no more than once every idleTimeoutMs/2 on average. */ this.startIdleTimeout(this.idleTimeoutMs - timeSinceLastActivity);
            }
        }, timeoutMs);
        (_b = (_a = this.idleTimer).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    maybeStartIdleTimer() {
        if (this.connectivityState !== connectivity_state_1.ConnectivityState.SHUTDOWN && !this.idleTimer) {
            this.startIdleTimeout(this.idleTimeoutMs);
        }
    }
    onCallStart() {
        if (this.channelzEnabled) {
            this.callTracker.addCallStarted();
        }
        this.callCount += 1;
    }
    onCallEnd(status) {
        if (this.channelzEnabled) {
            if (status.code === constants_1.Status.OK) {
                this.callTracker.addCallSucceeded();
            } else {
                this.callTracker.addCallFailed();
            }
        }
        this.callCount -= 1;
        this.lastActivityTimestamp = new Date();
        this.maybeStartIdleTimer();
    }
    createLoadBalancingCall(callConfig, method, host, credentials, deadline) {
        const callNumber = (0, call_number_1.getNextCallNumber)();
        this.trace('createLoadBalancingCall [' + callNumber + '] method="' + method + '"');
        return new load_balancing_call_1.LoadBalancingCall(this, callConfig, method, host, credentials, deadline, callNumber);
    }
    createRetryingCall(callConfig, method, host, credentials, deadline) {
        const callNumber = (0, call_number_1.getNextCallNumber)();
        this.trace('createRetryingCall [' + callNumber + '] method="' + method + '"');
        return new retrying_call_1.RetryingCall(this, callConfig, method, host, credentials, deadline, callNumber, this.retryBufferTracker, RETRY_THROTTLER_MAP.get(this.getTarget()));
    }
    createInnerCall(callConfig, method, host, credentials, deadline) {
        // Create a RetryingCall if retries are enabled
        if (this.options['grpc.enable_retries'] === 0) {
            return this.createLoadBalancingCall(callConfig, method, host, credentials, deadline);
        } else {
            return this.createRetryingCall(callConfig, method, host, credentials, deadline);
        }
    }
    createResolvingCall(method, deadline, host, parentCall, propagateFlags) {
        const callNumber = (0, call_number_1.getNextCallNumber)();
        this.trace('createResolvingCall [' + callNumber + '] method="' + method + '", deadline=' + (0, deadline_1.deadlineToString)(deadline));
        const finalOptions = {
            deadline: deadline,
            flags: propagateFlags !== null && propagateFlags !== void 0 ? propagateFlags : constants_1.Propagate.DEFAULTS,
            host: host !== null && host !== void 0 ? host : this.defaultAuthority,
            parentCall: parentCall
        };
        const call = new resolving_call_1.ResolvingCall(this, method, finalOptions, this.filterStackFactory.clone(), this.credentials._getCallCredentials(), callNumber);
        this.onCallStart();
        call.addStatusWatcher((status)=>{
            this.onCallEnd(status);
        });
        return call;
    }
    close() {
        this.resolvingLoadBalancer.destroy();
        this.updateState(connectivity_state_1.ConnectivityState.SHUTDOWN);
        this.currentPicker = new ShutdownPicker();
        for (const call of this.configSelectionQueue){
            call.cancelWithStatus(constants_1.Status.UNAVAILABLE, 'Channel closed before call started');
        }
        this.configSelectionQueue = [];
        for (const call of this.pickQueue){
            call.cancelWithStatus(constants_1.Status.UNAVAILABLE, 'Channel closed before call started');
        }
        this.pickQueue = [];
        clearInterval(this.callRefTimer);
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        if (this.channelzEnabled) {
            (0, channelz_1.unregisterChannelzRef)(this.channelzRef);
        }
        this.subchannelPool.unrefUnusedSubchannels();
    }
    getTarget() {
        return (0, uri_parser_1.uriToString)(this.target);
    }
    getConnectivityState(tryToConnect) {
        const connectivityState = this.connectivityState;
        if (tryToConnect) {
            this.resolvingLoadBalancer.exitIdle();
            this.lastActivityTimestamp = new Date();
            this.maybeStartIdleTimer();
        }
        return connectivityState;
    }
    watchConnectivityState(currentState, deadline, callback) {
        if (this.connectivityState === connectivity_state_1.ConnectivityState.SHUTDOWN) {
            throw new Error('Channel has been shut down');
        }
        let timer = null;
        if (deadline !== Infinity) {
            const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
            const now = new Date();
            if (deadline === -Infinity || deadlineDate <= now) {
                process.nextTick(callback, new Error('Deadline passed without connectivity state change'));
                return;
            }
            timer = setTimeout(()=>{
                this.removeConnectivityStateWatcher(watcherObject);
                callback(new Error('Deadline passed without connectivity state change'));
            }, deadlineDate.getTime() - now.getTime());
        }
        const watcherObject = {
            currentState,
            callback,
            timer
        };
        this.connectivityStateWatchers.push(watcherObject);
    }
    /**
     * Get the channelz reference object for this channel. The returned value is
     * garbage if channelz is disabled for this channel.
     * @returns
     */ getChannelzRef() {
        return this.channelzRef;
    }
    createCall(method, deadline, host, parentCall, propagateFlags) {
        if (typeof method !== 'string') {
            throw new TypeError('Channel#createCall: method must be a string');
        }
        if (!(typeof deadline === 'number' || deadline instanceof Date)) {
            throw new TypeError('Channel#createCall: deadline must be a number or Date');
        }
        if (this.connectivityState === connectivity_state_1.ConnectivityState.SHUTDOWN) {
            throw new Error('Channel has been shut down');
        }
        return this.createResolvingCall(method, deadline, host, parentCall, propagateFlags);
    }
    getOptions() {
        return this.options;
    }
}
exports.InternalChannel = InternalChannel; //# sourceMappingURL=internal-channel.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channel.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ChannelImplementation = void 0;
const channel_credentials_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channel-credentials.js [app-rsc] (ecmascript)");
const internal_channel_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/internal-channel.js [app-rsc] (ecmascript)");
class ChannelImplementation {
    constructor(target, credentials, options){
        if (typeof target !== 'string') {
            throw new TypeError('Channel target must be a string');
        }
        if (!(credentials instanceof channel_credentials_1.ChannelCredentials)) {
            throw new TypeError('Channel credentials must be a ChannelCredentials object');
        }
        if (options) {
            if (typeof options !== 'object') {
                throw new TypeError('Channel options must be an object');
            }
        }
        this.internalChannel = new internal_channel_1.InternalChannel(target, credentials, options);
    }
    close() {
        this.internalChannel.close();
    }
    getTarget() {
        return this.internalChannel.getTarget();
    }
    getConnectivityState(tryToConnect) {
        return this.internalChannel.getConnectivityState(tryToConnect);
    }
    watchConnectivityState(currentState, deadline, callback) {
        this.internalChannel.watchConnectivityState(currentState, deadline, callback);
    }
    /**
     * Get the channelz reference object for this channel. The returned value is
     * garbage if channelz is disabled for this channel.
     * @returns
     */ getChannelzRef() {
        return this.internalChannel.getChannelzRef();
    }
    createCall(method, deadline, host, parentCall, propagateFlags) {
        if (typeof method !== 'string') {
            throw new TypeError('Channel#createCall: method must be a string');
        }
        if (!(typeof deadline === 'number' || deadline instanceof Date)) {
            throw new TypeError('Channel#createCall: deadline must be a number or Date');
        }
        return this.internalChannel.createCall(method, deadline, host, parentCall, propagateFlags);
    }
}
exports.ChannelImplementation = ChannelImplementation; //# sourceMappingURL=channel.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server-call.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ServerDuplexStreamImpl = exports.ServerWritableStreamImpl = exports.ServerReadableStreamImpl = exports.ServerUnaryCallImpl = exports.serverErrorToStatus = void 0;
const events_1 = __turbopack_require__("[externals]/ [external] (events, cjs)");
const stream_1 = __turbopack_require__("[externals]/ [external] (stream, cjs)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
function serverErrorToStatus(error, overrideTrailers) {
    var _a;
    const status = {
        code: constants_1.Status.UNKNOWN,
        details: 'message' in error ? error.message : 'Unknown Error',
        metadata: (_a = overrideTrailers !== null && overrideTrailers !== void 0 ? overrideTrailers : error.metadata) !== null && _a !== void 0 ? _a : null
    };
    if ('code' in error && typeof error.code === 'number' && Number.isInteger(error.code)) {
        status.code = error.code;
        if ('details' in error && typeof error.details === 'string') {
            status.details = error.details;
        }
    }
    return status;
}
exports.serverErrorToStatus = serverErrorToStatus;
class ServerUnaryCallImpl extends events_1.EventEmitter {
    constructor(path, call, metadata, request){
        super();
        this.path = path;
        this.call = call;
        this.metadata = metadata;
        this.request = request;
        this.cancelled = false;
    }
    getPeer() {
        return this.call.getPeer();
    }
    sendMetadata(responseMetadata) {
        this.call.sendMetadata(responseMetadata);
    }
    getDeadline() {
        return this.call.getDeadline();
    }
    getPath() {
        return this.path;
    }
    getHost() {
        return this.call.getHost();
    }
}
exports.ServerUnaryCallImpl = ServerUnaryCallImpl;
class ServerReadableStreamImpl extends stream_1.Readable {
    constructor(path, call, metadata){
        super({
            objectMode: true
        });
        this.path = path;
        this.call = call;
        this.metadata = metadata;
        this.cancelled = false;
    }
    _read(size) {
        this.call.startRead();
    }
    getPeer() {
        return this.call.getPeer();
    }
    sendMetadata(responseMetadata) {
        this.call.sendMetadata(responseMetadata);
    }
    getDeadline() {
        return this.call.getDeadline();
    }
    getPath() {
        return this.path;
    }
    getHost() {
        return this.call.getHost();
    }
}
exports.ServerReadableStreamImpl = ServerReadableStreamImpl;
class ServerWritableStreamImpl extends stream_1.Writable {
    constructor(path, call, metadata, request){
        super({
            objectMode: true
        });
        this.path = path;
        this.call = call;
        this.metadata = metadata;
        this.request = request;
        this.pendingStatus = {
            code: constants_1.Status.OK,
            details: 'OK'
        };
        this.cancelled = false;
        this.trailingMetadata = new metadata_1.Metadata();
        this.on('error', (err)=>{
            this.pendingStatus = serverErrorToStatus(err);
            this.end();
        });
    }
    getPeer() {
        return this.call.getPeer();
    }
    sendMetadata(responseMetadata) {
        this.call.sendMetadata(responseMetadata);
    }
    getDeadline() {
        return this.call.getDeadline();
    }
    getPath() {
        return this.path;
    }
    getHost() {
        return this.call.getHost();
    }
    _write(chunk, encoding, // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback) {
        this.call.sendMessage(chunk, callback);
    }
    _final(callback) {
        var _a;
        callback(null);
        this.call.sendStatus(Object.assign(Object.assign({}, this.pendingStatus), {
            metadata: (_a = this.pendingStatus.metadata) !== null && _a !== void 0 ? _a : this.trailingMetadata
        }));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    end(metadata) {
        if (metadata) {
            this.trailingMetadata = metadata;
        }
        return super.end();
    }
}
exports.ServerWritableStreamImpl = ServerWritableStreamImpl;
class ServerDuplexStreamImpl extends stream_1.Duplex {
    constructor(path, call, metadata){
        super({
            objectMode: true
        });
        this.path = path;
        this.call = call;
        this.metadata = metadata;
        this.pendingStatus = {
            code: constants_1.Status.OK,
            details: 'OK'
        };
        this.cancelled = false;
        this.trailingMetadata = new metadata_1.Metadata();
        this.on('error', (err)=>{
            this.pendingStatus = serverErrorToStatus(err);
            this.end();
        });
    }
    getPeer() {
        return this.call.getPeer();
    }
    sendMetadata(responseMetadata) {
        this.call.sendMetadata(responseMetadata);
    }
    getDeadline() {
        return this.call.getDeadline();
    }
    getPath() {
        return this.path;
    }
    getHost() {
        return this.call.getHost();
    }
    _read(size) {
        this.call.startRead();
    }
    _write(chunk, encoding, // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback) {
        this.call.sendMessage(chunk, callback);
    }
    _final(callback) {
        var _a;
        callback(null);
        this.call.sendStatus(Object.assign(Object.assign({}, this.pendingStatus), {
            metadata: (_a = this.pendingStatus.metadata) !== null && _a !== void 0 ? _a : this.trailingMetadata
        }));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    end(metadata) {
        if (metadata) {
            this.trailingMetadata = metadata;
        }
        return super.end();
    }
}
exports.ServerDuplexStreamImpl = ServerDuplexStreamImpl; //# sourceMappingURL=server-call.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server-credentials.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.createServerCredentialsWithInterceptors = exports.createCertificateProviderServerCredentials = exports.ServerCredentials = void 0;
const tls_helpers_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/tls-helpers.js [app-rsc] (ecmascript)");
class ServerCredentials {
    constructor(){
        this.watchers = new Set();
        this.latestContextOptions = null;
    }
    _addWatcher(watcher) {
        this.watchers.add(watcher);
    }
    _removeWatcher(watcher) {
        this.watchers.delete(watcher);
    }
    getWatcherCount() {
        return this.watchers.size;
    }
    updateSecureContextOptions(options) {
        this.latestContextOptions = options;
        for (const watcher of this.watchers){
            watcher(this.latestContextOptions);
        }
    }
    _getSettings() {
        return this.latestContextOptions;
    }
    _getInterceptors() {
        return [];
    }
    static createInsecure() {
        return new InsecureServerCredentials();
    }
    static createSsl(rootCerts, keyCertPairs, checkClientCertificate = false) {
        var _a;
        if (rootCerts !== null && !Buffer.isBuffer(rootCerts)) {
            throw new TypeError('rootCerts must be null or a Buffer');
        }
        if (!Array.isArray(keyCertPairs)) {
            throw new TypeError('keyCertPairs must be an array');
        }
        if (typeof checkClientCertificate !== 'boolean') {
            throw new TypeError('checkClientCertificate must be a boolean');
        }
        const cert = [];
        const key = [];
        for(let i = 0; i < keyCertPairs.length; i++){
            const pair = keyCertPairs[i];
            if (pair === null || typeof pair !== 'object') {
                throw new TypeError(`keyCertPair[${i}] must be an object`);
            }
            if (!Buffer.isBuffer(pair.private_key)) {
                throw new TypeError(`keyCertPair[${i}].private_key must be a Buffer`);
            }
            if (!Buffer.isBuffer(pair.cert_chain)) {
                throw new TypeError(`keyCertPair[${i}].cert_chain must be a Buffer`);
            }
            cert.push(pair.cert_chain);
            key.push(pair.private_key);
        }
        return new SecureServerCredentials({
            ca: (_a = rootCerts !== null && rootCerts !== void 0 ? rootCerts : (0, tls_helpers_1.getDefaultRootsData)()) !== null && _a !== void 0 ? _a : undefined,
            cert,
            key,
            requestCert: checkClientCertificate,
            ciphers: tls_helpers_1.CIPHER_SUITES
        });
    }
}
exports.ServerCredentials = ServerCredentials;
class InsecureServerCredentials extends ServerCredentials {
    _isSecure() {
        return false;
    }
    _getSettings() {
        return null;
    }
    _equals(other) {
        return other instanceof InsecureServerCredentials;
    }
}
class SecureServerCredentials extends ServerCredentials {
    constructor(options){
        super();
        this.options = options;
    }
    _isSecure() {
        return true;
    }
    _getSettings() {
        return this.options;
    }
    /**
     * Checks equality by checking the options that are actually set by
     * createSsl.
     * @param other
     * @returns
     */ _equals(other) {
        if (this === other) {
            return true;
        }
        if (!(other instanceof SecureServerCredentials)) {
            return false;
        }
        // options.ca equality check
        if (Buffer.isBuffer(this.options.ca) && Buffer.isBuffer(other.options.ca)) {
            if (!this.options.ca.equals(other.options.ca)) {
                return false;
            }
        } else {
            if (this.options.ca !== other.options.ca) {
                return false;
            }
        }
        // options.cert equality check
        if (Array.isArray(this.options.cert) && Array.isArray(other.options.cert)) {
            if (this.options.cert.length !== other.options.cert.length) {
                return false;
            }
            for(let i = 0; i < this.options.cert.length; i++){
                const thisCert = this.options.cert[i];
                const otherCert = other.options.cert[i];
                if (Buffer.isBuffer(thisCert) && Buffer.isBuffer(otherCert)) {
                    if (!thisCert.equals(otherCert)) {
                        return false;
                    }
                } else {
                    if (thisCert !== otherCert) {
                        return false;
                    }
                }
            }
        } else {
            if (this.options.cert !== other.options.cert) {
                return false;
            }
        }
        // options.key equality check
        if (Array.isArray(this.options.key) && Array.isArray(other.options.key)) {
            if (this.options.key.length !== other.options.key.length) {
                return false;
            }
            for(let i = 0; i < this.options.key.length; i++){
                const thisKey = this.options.key[i];
                const otherKey = other.options.key[i];
                if (Buffer.isBuffer(thisKey) && Buffer.isBuffer(otherKey)) {
                    if (!thisKey.equals(otherKey)) {
                        return false;
                    }
                } else {
                    if (thisKey !== otherKey) {
                        return false;
                    }
                }
            }
        } else {
            if (this.options.key !== other.options.key) {
                return false;
            }
        }
        // options.requestCert equality check
        if (this.options.requestCert !== other.options.requestCert) {
            return false;
        }
        /* ciphers is derived from a value that is constant for the process, so no
         * equality check is needed. */ return true;
    }
}
class CertificateProviderServerCredentials extends ServerCredentials {
    constructor(identityCertificateProvider, caCertificateProvider, requireClientCertificate){
        super();
        this.identityCertificateProvider = identityCertificateProvider;
        this.caCertificateProvider = caCertificateProvider;
        this.requireClientCertificate = requireClientCertificate;
        this.latestCaUpdate = null;
        this.latestIdentityUpdate = null;
        this.caCertificateUpdateListener = this.handleCaCertificateUpdate.bind(this);
        this.identityCertificateUpdateListener = this.handleIdentityCertitificateUpdate.bind(this);
    }
    _addWatcher(watcher) {
        var _a;
        if (this.getWatcherCount() === 0) {
            (_a = this.caCertificateProvider) === null || _a === void 0 ? void 0 : _a.addCaCertificateListener(this.caCertificateUpdateListener);
            this.identityCertificateProvider.addIdentityCertificateListener(this.identityCertificateUpdateListener);
        }
        super._addWatcher(watcher);
    }
    _removeWatcher(watcher) {
        var _a;
        super._removeWatcher(watcher);
        if (this.getWatcherCount() === 0) {
            (_a = this.caCertificateProvider) === null || _a === void 0 ? void 0 : _a.removeCaCertificateListener(this.caCertificateUpdateListener);
            this.identityCertificateProvider.removeIdentityCertificateListener(this.identityCertificateUpdateListener);
        }
    }
    _isSecure() {
        return true;
    }
    _equals(other) {
        if (this === other) {
            return true;
        }
        if (!(other instanceof CertificateProviderServerCredentials)) {
            return false;
        }
        return this.caCertificateProvider === other.caCertificateProvider && this.identityCertificateProvider === other.identityCertificateProvider && this.requireClientCertificate === other.requireClientCertificate;
    }
    calculateSecureContextOptions() {
        var _a;
        if (this.latestIdentityUpdate === null) {
            return null;
        }
        if (this.caCertificateProvider !== null && this.latestCaUpdate === null) {
            return null;
        }
        return {
            ca: (_a = this.latestCaUpdate) === null || _a === void 0 ? void 0 : _a.caCertificate,
            cert: this.latestIdentityUpdate.certificate,
            key: this.latestIdentityUpdate.privateKey,
            requestCert: this.latestIdentityUpdate !== null,
            rejectUnauthorized: this.requireClientCertificate
        };
    }
    finalizeUpdate() {
        this.updateSecureContextOptions(this.calculateSecureContextOptions());
    }
    handleCaCertificateUpdate(update) {
        this.latestCaUpdate = update;
        this.finalizeUpdate();
    }
    handleIdentityCertitificateUpdate(update) {
        this.latestIdentityUpdate = update;
        this.finalizeUpdate();
    }
}
function createCertificateProviderServerCredentials(caCertificateProvider, identityCertificateProvider, requireClientCertificate) {
    return new CertificateProviderServerCredentials(caCertificateProvider, identityCertificateProvider, requireClientCertificate);
}
exports.createCertificateProviderServerCredentials = createCertificateProviderServerCredentials;
class InterceptorServerCredentials extends ServerCredentials {
    constructor(childCredentials, interceptors){
        super();
        this.childCredentials = childCredentials;
        this.interceptors = interceptors;
    }
    _isSecure() {
        return this.childCredentials._isSecure();
    }
    _equals(other) {
        if (!(other instanceof InterceptorServerCredentials)) {
            return false;
        }
        if (!this.childCredentials._equals(other.childCredentials)) {
            return false;
        }
        if (this.interceptors.length !== other.interceptors.length) {
            return false;
        }
        for(let i = 0; i < this.interceptors.length; i++){
            if (this.interceptors[i] !== other.interceptors[i]) {
                return false;
            }
        }
        return true;
    }
    _getInterceptors() {
        return this.interceptors;
    }
    _addWatcher(watcher) {
        this.childCredentials._addWatcher(watcher);
    }
    _removeWatcher(watcher) {
        this.childCredentials._removeWatcher(watcher);
    }
}
function createServerCredentialsWithInterceptors(credentials, interceptors) {
    return new InterceptorServerCredentials(credentials, interceptors);
}
exports.createServerCredentialsWithInterceptors = createServerCredentialsWithInterceptors; //# sourceMappingURL=server-credentials.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server-interceptors.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2024 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getServerInterceptingCall = exports.BaseServerInterceptingCall = exports.ServerInterceptingCall = exports.ResponderBuilder = exports.isInterceptingServerListener = exports.ServerListenerBuilder = void 0;
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const http2 = __turbopack_require__("[externals]/ [external] (http2, cjs)");
const error_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/error.js [app-rsc] (ecmascript)");
const zlib = __turbopack_require__("[externals]/ [external] (zlib, cjs)");
const stream_decoder_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/stream-decoder.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'server_call';
function trace(text) {
    logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, text);
}
class ServerListenerBuilder {
    constructor(){
        this.metadata = undefined;
        this.message = undefined;
        this.halfClose = undefined;
        this.cancel = undefined;
    }
    withOnReceiveMetadata(onReceiveMetadata) {
        this.metadata = onReceiveMetadata;
        return this;
    }
    withOnReceiveMessage(onReceiveMessage) {
        this.message = onReceiveMessage;
        return this;
    }
    withOnReceiveHalfClose(onReceiveHalfClose) {
        this.halfClose = onReceiveHalfClose;
        return this;
    }
    withOnCancel(onCancel) {
        this.cancel = onCancel;
        return this;
    }
    build() {
        return {
            onReceiveMetadata: this.metadata,
            onReceiveMessage: this.message,
            onReceiveHalfClose: this.halfClose,
            onCancel: this.cancel
        };
    }
}
exports.ServerListenerBuilder = ServerListenerBuilder;
function isInterceptingServerListener(listener) {
    return listener.onReceiveMetadata !== undefined && listener.onReceiveMetadata.length === 1;
}
exports.isInterceptingServerListener = isInterceptingServerListener;
class InterceptingServerListenerImpl {
    constructor(listener, nextListener){
        this.listener = listener;
        this.nextListener = nextListener;
        /**
         * Once the call is cancelled, ignore all other events.
         */ this.cancelled = false;
        this.processingMetadata = false;
        this.hasPendingMessage = false;
        this.pendingMessage = null;
        this.processingMessage = false;
        this.hasPendingHalfClose = false;
    }
    processPendingMessage() {
        if (this.hasPendingMessage) {
            this.nextListener.onReceiveMessage(this.pendingMessage);
            this.pendingMessage = null;
            this.hasPendingMessage = false;
        }
    }
    processPendingHalfClose() {
        if (this.hasPendingHalfClose) {
            this.nextListener.onReceiveHalfClose();
            this.hasPendingHalfClose = false;
        }
    }
    onReceiveMetadata(metadata) {
        if (this.cancelled) {
            return;
        }
        this.processingMetadata = true;
        this.listener.onReceiveMetadata(metadata, (interceptedMetadata)=>{
            this.processingMetadata = false;
            if (this.cancelled) {
                return;
            }
            this.nextListener.onReceiveMetadata(interceptedMetadata);
            this.processPendingMessage();
            this.processPendingHalfClose();
        });
    }
    onReceiveMessage(message) {
        if (this.cancelled) {
            return;
        }
        this.processingMessage = true;
        this.listener.onReceiveMessage(message, (msg)=>{
            this.processingMessage = false;
            if (this.cancelled) {
                return;
            }
            if (this.processingMetadata) {
                this.pendingMessage = msg;
                this.hasPendingMessage = true;
            } else {
                this.nextListener.onReceiveMessage(msg);
                this.processPendingHalfClose();
            }
        });
    }
    onReceiveHalfClose() {
        if (this.cancelled) {
            return;
        }
        this.listener.onReceiveHalfClose(()=>{
            if (this.cancelled) {
                return;
            }
            if (this.processingMetadata || this.processingMessage) {
                this.hasPendingHalfClose = true;
            } else {
                this.nextListener.onReceiveHalfClose();
            }
        });
    }
    onCancel() {
        this.cancelled = true;
        this.listener.onCancel();
        this.nextListener.onCancel();
    }
}
class ResponderBuilder {
    constructor(){
        this.start = undefined;
        this.metadata = undefined;
        this.message = undefined;
        this.status = undefined;
    }
    withStart(start) {
        this.start = start;
        return this;
    }
    withSendMetadata(sendMetadata) {
        this.metadata = sendMetadata;
        return this;
    }
    withSendMessage(sendMessage) {
        this.message = sendMessage;
        return this;
    }
    withSendStatus(sendStatus) {
        this.status = sendStatus;
        return this;
    }
    build() {
        return {
            start: this.start,
            sendMetadata: this.metadata,
            sendMessage: this.message,
            sendStatus: this.status
        };
    }
}
exports.ResponderBuilder = ResponderBuilder;
const defaultServerListener = {
    onReceiveMetadata: (metadata, next)=>{
        next(metadata);
    },
    onReceiveMessage: (message, next)=>{
        next(message);
    },
    onReceiveHalfClose: (next)=>{
        next();
    },
    onCancel: ()=>{}
};
const defaultResponder = {
    start: (next)=>{
        next();
    },
    sendMetadata: (metadata, next)=>{
        next(metadata);
    },
    sendMessage: (message, next)=>{
        next(message);
    },
    sendStatus: (status, next)=>{
        next(status);
    }
};
class ServerInterceptingCall {
    constructor(nextCall, responder){
        var _a, _b, _c, _d;
        this.nextCall = nextCall;
        this.processingMetadata = false;
        this.processingMessage = false;
        this.pendingMessage = null;
        this.pendingMessageCallback = null;
        this.pendingStatus = null;
        this.responder = {
            start: (_a = responder === null || responder === void 0 ? void 0 : responder.start) !== null && _a !== void 0 ? _a : defaultResponder.start,
            sendMetadata: (_b = responder === null || responder === void 0 ? void 0 : responder.sendMetadata) !== null && _b !== void 0 ? _b : defaultResponder.sendMetadata,
            sendMessage: (_c = responder === null || responder === void 0 ? void 0 : responder.sendMessage) !== null && _c !== void 0 ? _c : defaultResponder.sendMessage,
            sendStatus: (_d = responder === null || responder === void 0 ? void 0 : responder.sendStatus) !== null && _d !== void 0 ? _d : defaultResponder.sendStatus
        };
    }
    processPendingMessage() {
        if (this.pendingMessageCallback) {
            this.nextCall.sendMessage(this.pendingMessage, this.pendingMessageCallback);
            this.pendingMessage = null;
            this.pendingMessageCallback = null;
        }
    }
    processPendingStatus() {
        if (this.pendingStatus) {
            this.nextCall.sendStatus(this.pendingStatus);
            this.pendingStatus = null;
        }
    }
    start(listener) {
        this.responder.start((interceptedListener)=>{
            var _a, _b, _c, _d;
            const fullInterceptedListener = {
                onReceiveMetadata: (_a = interceptedListener === null || interceptedListener === void 0 ? void 0 : interceptedListener.onReceiveMetadata) !== null && _a !== void 0 ? _a : defaultServerListener.onReceiveMetadata,
                onReceiveMessage: (_b = interceptedListener === null || interceptedListener === void 0 ? void 0 : interceptedListener.onReceiveMessage) !== null && _b !== void 0 ? _b : defaultServerListener.onReceiveMessage,
                onReceiveHalfClose: (_c = interceptedListener === null || interceptedListener === void 0 ? void 0 : interceptedListener.onReceiveHalfClose) !== null && _c !== void 0 ? _c : defaultServerListener.onReceiveHalfClose,
                onCancel: (_d = interceptedListener === null || interceptedListener === void 0 ? void 0 : interceptedListener.onCancel) !== null && _d !== void 0 ? _d : defaultServerListener.onCancel
            };
            const finalInterceptingListener = new InterceptingServerListenerImpl(fullInterceptedListener, listener);
            this.nextCall.start(finalInterceptingListener);
        });
    }
    sendMetadata(metadata) {
        this.processingMetadata = true;
        this.responder.sendMetadata(metadata, (interceptedMetadata)=>{
            this.processingMetadata = false;
            this.nextCall.sendMetadata(interceptedMetadata);
            this.processPendingMessage();
            this.processPendingStatus();
        });
    }
    sendMessage(message, callback) {
        this.processingMessage = true;
        this.responder.sendMessage(message, (interceptedMessage)=>{
            this.processingMessage = false;
            if (this.processingMetadata) {
                this.pendingMessage = interceptedMessage;
                this.pendingMessageCallback = callback;
            } else {
                this.nextCall.sendMessage(interceptedMessage, callback);
            }
        });
    }
    sendStatus(status) {
        this.responder.sendStatus(status, (interceptedStatus)=>{
            if (this.processingMetadata || this.processingMessage) {
                this.pendingStatus = interceptedStatus;
            } else {
                this.nextCall.sendStatus(interceptedStatus);
            }
        });
    }
    startRead() {
        this.nextCall.startRead();
    }
    getPeer() {
        return this.nextCall.getPeer();
    }
    getDeadline() {
        return this.nextCall.getDeadline();
    }
    getHost() {
        return this.nextCall.getHost();
    }
}
exports.ServerInterceptingCall = ServerInterceptingCall;
const GRPC_ACCEPT_ENCODING_HEADER = 'grpc-accept-encoding';
const GRPC_ENCODING_HEADER = 'grpc-encoding';
const GRPC_MESSAGE_HEADER = 'grpc-message';
const GRPC_STATUS_HEADER = 'grpc-status';
const GRPC_TIMEOUT_HEADER = 'grpc-timeout';
const DEADLINE_REGEX = /(\d{1,8})\s*([HMSmun])/;
const deadlineUnitsToMs = {
    H: 3600000,
    M: 60000,
    S: 1000,
    m: 1,
    u: 0.001,
    n: 0.000001
};
const defaultCompressionHeaders = {
    // TODO(cjihrig): Remove these encoding headers from the default response
    // once compression is integrated.
    [GRPC_ACCEPT_ENCODING_HEADER]: 'identity,deflate,gzip',
    [GRPC_ENCODING_HEADER]: 'identity'
};
const defaultResponseHeaders = {
    [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_OK,
    [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'application/grpc+proto'
};
const defaultResponseOptions = {
    waitForTrailers: true
};
class BaseServerInterceptingCall {
    constructor(stream, headers, callEventTracker, handler, options){
        var _a;
        this.stream = stream;
        this.callEventTracker = callEventTracker;
        this.handler = handler;
        this.listener = null;
        this.deadlineTimer = null;
        this.deadline = Infinity;
        this.maxSendMessageSize = constants_1.DEFAULT_MAX_SEND_MESSAGE_LENGTH;
        this.maxReceiveMessageSize = constants_1.DEFAULT_MAX_RECEIVE_MESSAGE_LENGTH;
        this.cancelled = false;
        this.metadataSent = false;
        this.wantTrailers = false;
        this.cancelNotified = false;
        this.incomingEncoding = 'identity';
        this.readQueue = [];
        this.isReadPending = false;
        this.receivedHalfClose = false;
        this.streamEnded = false;
        this.stream.once('error', (err)=>{
        /* We need an error handler to avoid uncaught error event exceptions, but
             * there is nothing we can reasonably do here. Any error event should
             * have a corresponding close event, which handles emitting the cancelled
             * event. And the stream is now in a bad state, so we can't reasonably
             * expect to be able to send an error over it. */ });
        this.stream.once('close', ()=>{
            var _a;
            trace('Request to method ' + ((_a = this.handler) === null || _a === void 0 ? void 0 : _a.path) + ' stream closed with rstCode ' + this.stream.rstCode);
            if (this.callEventTracker && !this.streamEnded) {
                this.streamEnded = true;
                this.callEventTracker.onStreamEnd(false);
                this.callEventTracker.onCallEnd({
                    code: constants_1.Status.CANCELLED,
                    details: 'Stream closed before sending status',
                    metadata: null
                });
            }
            this.notifyOnCancel();
        });
        this.stream.on('data', (data)=>{
            this.handleDataFrame(data);
        });
        this.stream.pause();
        this.stream.on('end', ()=>{
            this.handleEndEvent();
        });
        if ('grpc.max_send_message_length' in options) {
            this.maxSendMessageSize = options['grpc.max_send_message_length'];
        }
        if ('grpc.max_receive_message_length' in options) {
            this.maxReceiveMessageSize = options['grpc.max_receive_message_length'];
        }
        this.host = (_a = headers[':authority']) !== null && _a !== void 0 ? _a : headers.host;
        this.decoder = new stream_decoder_1.StreamDecoder(this.maxReceiveMessageSize);
        const metadata = metadata_1.Metadata.fromHttp2Headers(headers);
        if (logging.isTracerEnabled(TRACER_NAME)) {
            trace('Request to ' + this.handler.path + ' received headers ' + JSON.stringify(metadata.toJSON()));
        }
        const timeoutHeader = metadata.get(GRPC_TIMEOUT_HEADER);
        if (timeoutHeader.length > 0) {
            this.handleTimeoutHeader(timeoutHeader[0]);
        }
        const encodingHeader = metadata.get(GRPC_ENCODING_HEADER);
        if (encodingHeader.length > 0) {
            this.incomingEncoding = encodingHeader[0];
        }
        // Remove several headers that should not be propagated to the application
        metadata.remove(GRPC_TIMEOUT_HEADER);
        metadata.remove(GRPC_ENCODING_HEADER);
        metadata.remove(GRPC_ACCEPT_ENCODING_HEADER);
        metadata.remove(http2.constants.HTTP2_HEADER_ACCEPT_ENCODING);
        metadata.remove(http2.constants.HTTP2_HEADER_TE);
        metadata.remove(http2.constants.HTTP2_HEADER_CONTENT_TYPE);
        this.metadata = metadata;
    }
    handleTimeoutHeader(timeoutHeader) {
        const match = timeoutHeader.toString().match(DEADLINE_REGEX);
        if (match === null) {
            const status = {
                code: constants_1.Status.INTERNAL,
                details: `Invalid ${GRPC_TIMEOUT_HEADER} value "${timeoutHeader}"`,
                metadata: null
            };
            // Wait for the constructor to complete before sending the error.
            process.nextTick(()=>{
                this.sendStatus(status);
            });
            return;
        }
        const timeout = +match[1] * deadlineUnitsToMs[match[2]] | 0;
        const now = new Date();
        this.deadline = now.setMilliseconds(now.getMilliseconds() + timeout);
        this.deadlineTimer = setTimeout(()=>{
            const status = {
                code: constants_1.Status.DEADLINE_EXCEEDED,
                details: 'Deadline exceeded',
                metadata: null
            };
            this.sendStatus(status);
        }, timeout);
    }
    checkCancelled() {
        /* In some cases the stream can become destroyed before the close event
         * fires. That creates a race condition that this check works around */ if (!this.cancelled && (this.stream.destroyed || this.stream.closed)) {
            this.notifyOnCancel();
            this.cancelled = true;
        }
        return this.cancelled;
    }
    notifyOnCancel() {
        if (this.cancelNotified) {
            return;
        }
        this.cancelNotified = true;
        this.cancelled = true;
        process.nextTick(()=>{
            var _a;
            (_a = this.listener) === null || _a === void 0 ? void 0 : _a.onCancel();
        });
        if (this.deadlineTimer) {
            clearTimeout(this.deadlineTimer);
        }
        // Flush incoming data frames
        this.stream.resume();
    }
    /**
     * A server handler can start sending messages without explicitly sending
     * metadata. In that case, we need to send headers before sending any
     * messages. This function does that if necessary.
     */ maybeSendMetadata() {
        if (!this.metadataSent) {
            this.sendMetadata(new metadata_1.Metadata());
        }
    }
    /**
     * Serialize a message to a length-delimited byte string.
     * @param value
     * @returns
     */ serializeMessage(value) {
        const messageBuffer = this.handler.serialize(value);
        const byteLength = messageBuffer.byteLength;
        const output = Buffer.allocUnsafe(byteLength + 5);
        /* Note: response compression is currently not supported, so this
         * compressed bit is always 0. */ output.writeUInt8(0, 0);
        output.writeUInt32BE(byteLength, 1);
        messageBuffer.copy(output, 5);
        return output;
    }
    decompressMessage(message, encoding) {
        const messageContents = message.subarray(5);
        if (encoding === 'identity') {
            return messageContents;
        } else if (encoding === 'deflate' || encoding === 'gzip') {
            let decompresser;
            if (encoding === 'deflate') {
                decompresser = zlib.createInflate();
            } else {
                decompresser = zlib.createGunzip();
            }
            return new Promise((resolve, reject)=>{
                let totalLength = 0;
                const messageParts = [];
                decompresser.on('data', (chunk)=>{
                    messageParts.push(chunk);
                    totalLength += chunk.byteLength;
                    if (this.maxReceiveMessageSize !== -1 && totalLength > this.maxReceiveMessageSize) {
                        decompresser.destroy();
                        reject({
                            code: constants_1.Status.RESOURCE_EXHAUSTED,
                            details: `Received message that decompresses to a size larger than ${this.maxReceiveMessageSize}`
                        });
                    }
                });
                decompresser.on('end', ()=>{
                    resolve(Buffer.concat(messageParts));
                });
                decompresser.write(messageContents);
                decompresser.end();
            });
        } else {
            return Promise.reject({
                code: constants_1.Status.UNIMPLEMENTED,
                details: `Received message compressed with unsupported encoding "${encoding}"`
            });
        }
    }
    async decompressAndMaybePush(queueEntry) {
        if (queueEntry.type !== 'COMPRESSED') {
            throw new Error(`Invalid queue entry type: ${queueEntry.type}`);
        }
        const compressed = queueEntry.compressedMessage.readUInt8(0) === 1;
        const compressedMessageEncoding = compressed ? this.incomingEncoding : 'identity';
        let decompressedMessage;
        try {
            decompressedMessage = await this.decompressMessage(queueEntry.compressedMessage, compressedMessageEncoding);
        } catch (err) {
            this.sendStatus(err);
            return;
        }
        try {
            queueEntry.parsedMessage = this.handler.deserialize(decompressedMessage);
        } catch (err) {
            this.sendStatus({
                code: constants_1.Status.INTERNAL,
                details: `Error deserializing request: ${err.message}`
            });
            return;
        }
        queueEntry.type = 'READABLE';
        this.maybePushNextMessage();
    }
    maybePushNextMessage() {
        if (this.listener && this.isReadPending && this.readQueue.length > 0 && this.readQueue[0].type !== 'COMPRESSED') {
            this.isReadPending = false;
            const nextQueueEntry = this.readQueue.shift();
            if (nextQueueEntry.type === 'READABLE') {
                this.listener.onReceiveMessage(nextQueueEntry.parsedMessage);
            } else {
                // nextQueueEntry.type === 'HALF_CLOSE'
                this.listener.onReceiveHalfClose();
            }
        }
    }
    handleDataFrame(data) {
        var _a;
        if (this.checkCancelled()) {
            return;
        }
        trace('Request to ' + this.handler.path + ' received data frame of size ' + data.length);
        let rawMessages;
        try {
            rawMessages = this.decoder.write(data);
        } catch (e) {
            this.sendStatus({
                code: constants_1.Status.RESOURCE_EXHAUSTED,
                details: e.message
            });
            return;
        }
        for (const messageBytes of rawMessages){
            this.stream.pause();
            const queueEntry = {
                type: 'COMPRESSED',
                compressedMessage: messageBytes,
                parsedMessage: null
            };
            this.readQueue.push(queueEntry);
            this.decompressAndMaybePush(queueEntry);
            (_a = this.callEventTracker) === null || _a === void 0 ? void 0 : _a.addMessageReceived();
        }
    }
    handleEndEvent() {
        this.readQueue.push({
            type: 'HALF_CLOSE',
            compressedMessage: null,
            parsedMessage: null
        });
        this.receivedHalfClose = true;
        this.maybePushNextMessage();
    }
    start(listener) {
        trace('Request to ' + this.handler.path + ' start called');
        if (this.checkCancelled()) {
            return;
        }
        this.listener = listener;
        listener.onReceiveMetadata(this.metadata);
    }
    sendMetadata(metadata) {
        if (this.checkCancelled()) {
            return;
        }
        if (this.metadataSent) {
            return;
        }
        this.metadataSent = true;
        const custom = metadata ? metadata.toHttp2Headers() : null;
        const headers = Object.assign(Object.assign(Object.assign({}, defaultResponseHeaders), defaultCompressionHeaders), custom);
        this.stream.respond(headers, defaultResponseOptions);
    }
    sendMessage(message, callback) {
        if (this.checkCancelled()) {
            return;
        }
        let response;
        try {
            response = this.serializeMessage(message);
        } catch (e) {
            this.sendStatus({
                code: constants_1.Status.INTERNAL,
                details: `Error serializing response: ${(0, error_1.getErrorMessage)(e)}`,
                metadata: null
            });
            return;
        }
        if (this.maxSendMessageSize !== -1 && response.length - 5 > this.maxSendMessageSize) {
            this.sendStatus({
                code: constants_1.Status.RESOURCE_EXHAUSTED,
                details: `Sent message larger than max (${response.length} vs. ${this.maxSendMessageSize})`,
                metadata: null
            });
            return;
        }
        this.maybeSendMetadata();
        trace('Request to ' + this.handler.path + ' sent data frame of size ' + response.length);
        this.stream.write(response, (error)=>{
            var _a;
            if (error) {
                this.sendStatus({
                    code: constants_1.Status.INTERNAL,
                    details: `Error writing message: ${(0, error_1.getErrorMessage)(error)}`,
                    metadata: null
                });
                return;
            }
            (_a = this.callEventTracker) === null || _a === void 0 ? void 0 : _a.addMessageSent();
            callback();
        });
    }
    sendStatus(status) {
        var _a, _b;
        if (this.checkCancelled()) {
            return;
        }
        trace('Request to method ' + ((_a = this.handler) === null || _a === void 0 ? void 0 : _a.path) + ' ended with status code: ' + constants_1.Status[status.code] + ' details: ' + status.details);
        if (this.metadataSent) {
            if (!this.wantTrailers) {
                this.wantTrailers = true;
                this.stream.once('wantTrailers', ()=>{
                    var _a;
                    if (this.callEventTracker && !this.streamEnded) {
                        this.streamEnded = true;
                        this.callEventTracker.onStreamEnd(true);
                        this.callEventTracker.onCallEnd(status);
                    }
                    const trailersToSend = Object.assign({
                        [GRPC_STATUS_HEADER]: status.code,
                        [GRPC_MESSAGE_HEADER]: encodeURI(status.details)
                    }, (_a = status.metadata) === null || _a === void 0 ? void 0 : _a.toHttp2Headers());
                    this.stream.sendTrailers(trailersToSend);
                    this.notifyOnCancel();
                });
                this.stream.end();
            } else {
                this.notifyOnCancel();
            }
        } else {
            if (this.callEventTracker && !this.streamEnded) {
                this.streamEnded = true;
                this.callEventTracker.onStreamEnd(true);
                this.callEventTracker.onCallEnd(status);
            }
            // Trailers-only response
            const trailersToSend = Object.assign(Object.assign({
                [GRPC_STATUS_HEADER]: status.code,
                [GRPC_MESSAGE_HEADER]: encodeURI(status.details)
            }, defaultResponseHeaders), (_b = status.metadata) === null || _b === void 0 ? void 0 : _b.toHttp2Headers());
            this.stream.respond(trailersToSend, {
                endStream: true
            });
            this.notifyOnCancel();
        }
    }
    startRead() {
        trace('Request to ' + this.handler.path + ' startRead called');
        if (this.checkCancelled()) {
            return;
        }
        this.isReadPending = true;
        if (this.readQueue.length === 0) {
            if (!this.receivedHalfClose) {
                this.stream.resume();
            }
        } else {
            this.maybePushNextMessage();
        }
    }
    getPeer() {
        var _a;
        const socket = (_a = this.stream.session) === null || _a === void 0 ? void 0 : _a.socket;
        if (socket === null || socket === void 0 ? void 0 : socket.remoteAddress) {
            if (socket.remotePort) {
                return `${socket.remoteAddress}:${socket.remotePort}`;
            } else {
                return socket.remoteAddress;
            }
        } else {
            return 'unknown';
        }
    }
    getDeadline() {
        return this.deadline;
    }
    getHost() {
        return this.host;
    }
}
exports.BaseServerInterceptingCall = BaseServerInterceptingCall;
function getServerInterceptingCall(interceptors, stream, headers, callEventTracker, handler, options) {
    const methodDefinition = {
        path: handler.path,
        requestStream: handler.type === 'clientStream' || handler.type === 'bidi',
        responseStream: handler.type === 'serverStream' || handler.type === 'bidi',
        requestDeserialize: handler.deserialize,
        responseSerialize: handler.serialize
    };
    const baseCall = new BaseServerInterceptingCall(stream, headers, callEventTracker, handler, options);
    return interceptors.reduce((call, interceptor)=>{
        return interceptor(methodDefinition, call);
    }, baseCall);
}
exports.getServerInterceptingCall = getServerInterceptingCall; //# sourceMappingURL=server-interceptors.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ var __runInitializers = this && this.__runInitializers || function(thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for(var i = 0; i < initializers.length; i++){
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = this && this.__esDecorate || function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) {
        if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
        return f;
    }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for(var i = decorators.length - 1; i >= 0; i--){
        var context = {};
        for(var p in contextIn)context[p] = p === "access" ? {} : contextIn[p];
        for(var p in contextIn.access)context.access[p] = contextIn.access[p];
        context.addInitializer = function(f) {
            if (done) throw new TypeError("Cannot add initializers after decoration has completed");
            extraInitializers.push(accept(f || null));
        };
        var result = (0, decorators[i])(kind === "accessor" ? {
            get: descriptor.get,
            set: descriptor.set
        } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        } else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Server = void 0;
const http2 = __turbopack_require__("[externals]/ [external] (http2, cjs)");
const util = __turbopack_require__("[externals]/ [external] (util, cjs)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const server_call_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server-call.js [app-rsc] (ecmascript)");
const server_credentials_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server-credentials.js [app-rsc] (ecmascript)");
const resolver_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const subchannel_address_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const channelz_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channelz.js [app-rsc] (ecmascript)");
const server_interceptors_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server-interceptors.js [app-rsc] (ecmascript)");
const UNLIMITED_CONNECTION_AGE_MS = ~(1 << 31);
const KEEPALIVE_MAX_TIME_MS = ~(1 << 31);
const KEEPALIVE_TIMEOUT_MS = 20000;
const MAX_CONNECTION_IDLE_MS = ~(1 << 31);
const { HTTP2_HEADER_PATH } = http2.constants;
const TRACER_NAME = 'server';
const kMaxAge = Buffer.from('max_age');
function noop() {}
/**
 * Decorator to wrap a class method with util.deprecate
 * @param message The message to output if the deprecated method is called
 * @returns
 */ function deprecate(message) {
    return function(target, context) {
        return util.deprecate(target, message);
    };
}
function getUnimplementedStatusResponse(methodName) {
    return {
        code: constants_1.Status.UNIMPLEMENTED,
        details: `The server does not implement the method ${methodName}`
    };
}
function getDefaultHandler(handlerType, methodName) {
    const unimplementedStatusResponse = getUnimplementedStatusResponse(methodName);
    switch(handlerType){
        case 'unary':
            return (call, callback)=>{
                callback(unimplementedStatusResponse, null);
            };
        case 'clientStream':
            return (call, callback)=>{
                callback(unimplementedStatusResponse, null);
            };
        case 'serverStream':
            return (call)=>{
                call.emit('error', unimplementedStatusResponse);
            };
        case 'bidi':
            return (call)=>{
                call.emit('error', unimplementedStatusResponse);
            };
        default:
            throw new Error(`Invalid handlerType ${handlerType}`);
    }
}
let Server = (()=>{
    var _a;
    let _instanceExtraInitializers = [];
    let _start_decorators;
    return _a = class Server {
        constructor(options){
            var _b, _c, _d, _e, _f, _g;
            this.boundPorts = (__runInitializers(this, _instanceExtraInitializers), new Map());
            this.http2Servers = new Map();
            this.sessionIdleTimeouts = new Map();
            this.handlers = new Map();
            this.sessions = new Map();
            /**
                 * This field only exists to ensure that the start method throws an error if
                 * it is called twice, as it did previously.
                 */ this.started = false;
            this.shutdown = false;
            this.serverAddressString = 'null';
            // Channelz Info
            this.channelzEnabled = true;
            this.options = options !== null && options !== void 0 ? options : {};
            if (this.options['grpc.enable_channelz'] === 0) {
                this.channelzEnabled = false;
                this.channelzTrace = new channelz_1.ChannelzTraceStub();
                this.callTracker = new channelz_1.ChannelzCallTrackerStub();
                this.listenerChildrenTracker = new channelz_1.ChannelzChildrenTrackerStub();
                this.sessionChildrenTracker = new channelz_1.ChannelzChildrenTrackerStub();
            } else {
                this.channelzTrace = new channelz_1.ChannelzTrace();
                this.callTracker = new channelz_1.ChannelzCallTracker();
                this.listenerChildrenTracker = new channelz_1.ChannelzChildrenTracker();
                this.sessionChildrenTracker = new channelz_1.ChannelzChildrenTracker();
            }
            this.channelzRef = (0, channelz_1.registerChannelzServer)('server', ()=>this.getChannelzInfo(), this.channelzEnabled);
            this.channelzTrace.addTrace('CT_INFO', 'Server created');
            this.maxConnectionAgeMs = (_b = this.options['grpc.max_connection_age_ms']) !== null && _b !== void 0 ? _b : UNLIMITED_CONNECTION_AGE_MS;
            this.maxConnectionAgeGraceMs = (_c = this.options['grpc.max_connection_age_grace_ms']) !== null && _c !== void 0 ? _c : UNLIMITED_CONNECTION_AGE_MS;
            this.keepaliveTimeMs = (_d = this.options['grpc.keepalive_time_ms']) !== null && _d !== void 0 ? _d : KEEPALIVE_MAX_TIME_MS;
            this.keepaliveTimeoutMs = (_e = this.options['grpc.keepalive_timeout_ms']) !== null && _e !== void 0 ? _e : KEEPALIVE_TIMEOUT_MS;
            this.sessionIdleTimeout = (_f = this.options['grpc.max_connection_idle_ms']) !== null && _f !== void 0 ? _f : MAX_CONNECTION_IDLE_MS;
            this.commonServerOptions = {
                maxSendHeaderBlockLength: Number.MAX_SAFE_INTEGER
            };
            if ('grpc-node.max_session_memory' in this.options) {
                this.commonServerOptions.maxSessionMemory = this.options['grpc-node.max_session_memory'];
            } else {
                /* By default, set a very large max session memory limit, to effectively
                     * disable enforcement of the limit. Some testing indicates that Node's
                     * behavior degrades badly when this limit is reached, so we solve that
                     * by disabling the check entirely. */ this.commonServerOptions.maxSessionMemory = Number.MAX_SAFE_INTEGER;
            }
            if ('grpc.max_concurrent_streams' in this.options) {
                this.commonServerOptions.settings = {
                    maxConcurrentStreams: this.options['grpc.max_concurrent_streams']
                };
            }
            this.interceptors = (_g = this.options.interceptors) !== null && _g !== void 0 ? _g : [];
            this.trace('Server constructed');
        }
        getChannelzInfo() {
            return {
                trace: this.channelzTrace,
                callTracker: this.callTracker,
                listenerChildren: this.listenerChildrenTracker.getChildLists(),
                sessionChildren: this.sessionChildrenTracker.getChildLists()
            };
        }
        getChannelzSessionInfo(session) {
            var _b, _c, _d;
            const sessionInfo = this.sessions.get(session);
            const sessionSocket = session.socket;
            const remoteAddress = sessionSocket.remoteAddress ? (0, subchannel_address_1.stringToSubchannelAddress)(sessionSocket.remoteAddress, sessionSocket.remotePort) : null;
            const localAddress = sessionSocket.localAddress ? (0, subchannel_address_1.stringToSubchannelAddress)(sessionSocket.localAddress, sessionSocket.localPort) : null;
            let tlsInfo;
            if (session.encrypted) {
                const tlsSocket = sessionSocket;
                const cipherInfo = tlsSocket.getCipher();
                const certificate = tlsSocket.getCertificate();
                const peerCertificate = tlsSocket.getPeerCertificate();
                tlsInfo = {
                    cipherSuiteStandardName: (_b = cipherInfo.standardName) !== null && _b !== void 0 ? _b : null,
                    cipherSuiteOtherName: cipherInfo.standardName ? null : cipherInfo.name,
                    localCertificate: certificate && 'raw' in certificate ? certificate.raw : null,
                    remoteCertificate: peerCertificate && 'raw' in peerCertificate ? peerCertificate.raw : null
                };
            } else {
                tlsInfo = null;
            }
            const socketInfo = {
                remoteAddress: remoteAddress,
                localAddress: localAddress,
                security: tlsInfo,
                remoteName: null,
                streamsStarted: sessionInfo.streamTracker.callsStarted,
                streamsSucceeded: sessionInfo.streamTracker.callsSucceeded,
                streamsFailed: sessionInfo.streamTracker.callsFailed,
                messagesSent: sessionInfo.messagesSent,
                messagesReceived: sessionInfo.messagesReceived,
                keepAlivesSent: sessionInfo.keepAlivesSent,
                lastLocalStreamCreatedTimestamp: null,
                lastRemoteStreamCreatedTimestamp: sessionInfo.streamTracker.lastCallStartedTimestamp,
                lastMessageSentTimestamp: sessionInfo.lastMessageSentTimestamp,
                lastMessageReceivedTimestamp: sessionInfo.lastMessageReceivedTimestamp,
                localFlowControlWindow: (_c = session.state.localWindowSize) !== null && _c !== void 0 ? _c : null,
                remoteFlowControlWindow: (_d = session.state.remoteWindowSize) !== null && _d !== void 0 ? _d : null
            };
            return socketInfo;
        }
        trace(text) {
            logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, '(' + this.channelzRef.id + ') ' + text);
        }
        keepaliveTrace(text) {
            logging.trace(constants_1.LogVerbosity.DEBUG, 'keepalive', '(' + this.channelzRef.id + ') ' + text);
        }
        addProtoService() {
            throw new Error('Not implemented. Use addService() instead');
        }
        addService(service, implementation) {
            if (service === null || typeof service !== 'object' || implementation === null || typeof implementation !== 'object') {
                throw new Error('addService() requires two objects as arguments');
            }
            const serviceKeys = Object.keys(service);
            if (serviceKeys.length === 0) {
                throw new Error('Cannot add an empty service to a server');
            }
            serviceKeys.forEach((name)=>{
                const attrs = service[name];
                let methodType;
                if (attrs.requestStream) {
                    if (attrs.responseStream) {
                        methodType = 'bidi';
                    } else {
                        methodType = 'clientStream';
                    }
                } else {
                    if (attrs.responseStream) {
                        methodType = 'serverStream';
                    } else {
                        methodType = 'unary';
                    }
                }
                let implFn = implementation[name];
                let impl;
                if (implFn === undefined && typeof attrs.originalName === 'string') {
                    implFn = implementation[attrs.originalName];
                }
                if (implFn !== undefined) {
                    impl = implFn.bind(implementation);
                } else {
                    impl = getDefaultHandler(methodType, name);
                }
                const success = this.register(attrs.path, impl, attrs.responseSerialize, attrs.requestDeserialize, methodType);
                if (success === false) {
                    throw new Error(`Method handler for ${attrs.path} already provided.`);
                }
            });
        }
        removeService(service) {
            if (service === null || typeof service !== 'object') {
                throw new Error('removeService() requires object as argument');
            }
            const serviceKeys = Object.keys(service);
            serviceKeys.forEach((name)=>{
                const attrs = service[name];
                this.unregister(attrs.path);
            });
        }
        bind(port, creds) {
            throw new Error('Not implemented. Use bindAsync() instead');
        }
        registerListenerToChannelz(boundAddress) {
            return (0, channelz_1.registerChannelzSocket)((0, subchannel_address_1.subchannelAddressToString)(boundAddress), ()=>{
                return {
                    localAddress: boundAddress,
                    remoteAddress: null,
                    security: null,
                    remoteName: null,
                    streamsStarted: 0,
                    streamsSucceeded: 0,
                    streamsFailed: 0,
                    messagesSent: 0,
                    messagesReceived: 0,
                    keepAlivesSent: 0,
                    lastLocalStreamCreatedTimestamp: null,
                    lastRemoteStreamCreatedTimestamp: null,
                    lastMessageSentTimestamp: null,
                    lastMessageReceivedTimestamp: null,
                    localFlowControlWindow: null,
                    remoteFlowControlWindow: null
                };
            }, this.channelzEnabled);
        }
        createHttp2Server(credentials) {
            let http2Server;
            if (credentials._isSecure()) {
                const credentialsSettings = credentials._getSettings();
                const secureServerOptions = Object.assign(Object.assign(Object.assign({}, this.commonServerOptions), credentialsSettings), {
                    enableTrace: this.options['grpc-node.tls_enable_trace'] === 1
                });
                let areCredentialsValid = credentialsSettings !== null;
                http2Server = http2.createSecureServer(secureServerOptions);
                http2Server.on('connection', (socket)=>{
                    if (!areCredentialsValid) {
                        socket.destroy();
                    }
                });
                http2Server.on('secureConnection', (socket)=>{
                    /* These errors need to be handled by the user of Http2SecureServer,
                         * according to https://github.com/nodejs/node/issues/35824 */ socket.on('error', (e)=>{
                        this.trace('An incoming TLS connection closed with error: ' + e.message);
                    });
                });
                const credsWatcher = (options)=>{
                    if (options) {
                        http2Server.setSecureContext(options);
                    }
                    areCredentialsValid = options !== null;
                };
                credentials._addWatcher(credsWatcher);
                http2Server.on('close', ()=>{
                    credentials._removeWatcher(credsWatcher);
                });
            } else {
                http2Server = http2.createServer(this.commonServerOptions);
            }
            http2Server.setTimeout(0, noop);
            this._setupHandlers(http2Server, credentials._getInterceptors());
            return http2Server;
        }
        bindOneAddress(address, boundPortObject) {
            this.trace('Attempting to bind ' + (0, subchannel_address_1.subchannelAddressToString)(address));
            const http2Server = this.createHttp2Server(boundPortObject.credentials);
            return new Promise((resolve, reject)=>{
                const onError = (err)=>{
                    this.trace('Failed to bind ' + (0, subchannel_address_1.subchannelAddressToString)(address) + ' with error ' + err.message);
                    resolve({
                        port: 'port' in address ? address.port : 1,
                        error: err.message
                    });
                };
                http2Server.once('error', onError);
                http2Server.listen(address, ()=>{
                    const boundAddress = http2Server.address();
                    let boundSubchannelAddress;
                    if (typeof boundAddress === 'string') {
                        boundSubchannelAddress = {
                            path: boundAddress
                        };
                    } else {
                        boundSubchannelAddress = {
                            host: boundAddress.address,
                            port: boundAddress.port
                        };
                    }
                    const channelzRef = this.registerListenerToChannelz(boundSubchannelAddress);
                    this.listenerChildrenTracker.refChild(channelzRef);
                    this.http2Servers.set(http2Server, {
                        channelzRef: channelzRef,
                        sessions: new Set()
                    });
                    boundPortObject.listeningServers.add(http2Server);
                    this.trace('Successfully bound ' + (0, subchannel_address_1.subchannelAddressToString)(boundSubchannelAddress));
                    resolve({
                        port: 'port' in boundSubchannelAddress ? boundSubchannelAddress.port : 1
                    });
                    http2Server.removeListener('error', onError);
                });
            });
        }
        async bindManyPorts(addressList, boundPortObject) {
            if (addressList.length === 0) {
                return {
                    count: 0,
                    port: 0,
                    errors: []
                };
            }
            if ((0, subchannel_address_1.isTcpSubchannelAddress)(addressList[0]) && addressList[0].port === 0) {
                /* If binding to port 0, first try to bind the first address, then bind
                     * the rest of the address list to the specific port that it binds. */ const firstAddressResult = await this.bindOneAddress(addressList[0], boundPortObject);
                if (firstAddressResult.error) {
                    /* If the first address fails to bind, try the same operation starting
                         * from the second item in the list. */ const restAddressResult = await this.bindManyPorts(addressList.slice(1), boundPortObject);
                    return Object.assign(Object.assign({}, restAddressResult), {
                        errors: [
                            firstAddressResult.error,
                            ...restAddressResult.errors
                        ]
                    });
                } else {
                    const restAddresses = addressList.slice(1).map((address)=>(0, subchannel_address_1.isTcpSubchannelAddress)(address) ? {
                            host: address.host,
                            port: firstAddressResult.port
                        } : address);
                    const restAddressResult = await Promise.all(restAddresses.map((address)=>this.bindOneAddress(address, boundPortObject)));
                    const allResults = [
                        firstAddressResult,
                        ...restAddressResult
                    ];
                    return {
                        count: allResults.filter((result)=>result.error === undefined).length,
                        port: firstAddressResult.port,
                        errors: allResults.filter((result)=>result.error).map((result)=>result.error)
                    };
                }
            } else {
                const allResults = await Promise.all(addressList.map((address)=>this.bindOneAddress(address, boundPortObject)));
                return {
                    count: allResults.filter((result)=>result.error === undefined).length,
                    port: allResults[0].port,
                    errors: allResults.filter((result)=>result.error).map((result)=>result.error)
                };
            }
        }
        async bindAddressList(addressList, boundPortObject) {
            const bindResult = await this.bindManyPorts(addressList, boundPortObject);
            if (bindResult.count > 0) {
                if (bindResult.count < addressList.length) {
                    logging.log(constants_1.LogVerbosity.INFO, `WARNING Only ${bindResult.count} addresses added out of total ${addressList.length} resolved`);
                }
                return bindResult.port;
            } else {
                const errorString = `No address added out of total ${addressList.length} resolved`;
                logging.log(constants_1.LogVerbosity.ERROR, errorString);
                throw new Error(`${errorString} errors: [${bindResult.errors.join(',')}]`);
            }
        }
        resolvePort(port) {
            return new Promise((resolve, reject)=>{
                const resolverListener = {
                    onSuccessfulResolution: (endpointList, serviceConfig, serviceConfigError)=>{
                        // We only want one resolution result. Discard all future results
                        resolverListener.onSuccessfulResolution = ()=>{};
                        const addressList = [].concat(...endpointList.map((endpoint)=>endpoint.addresses));
                        if (addressList.length === 0) {
                            reject(new Error(`No addresses resolved for port ${port}`));
                            return;
                        }
                        resolve(addressList);
                    },
                    onError: (error)=>{
                        reject(new Error(error.details));
                    }
                };
                const resolver = (0, resolver_1.createResolver)(port, resolverListener, this.options);
                resolver.updateResolution();
            });
        }
        async bindPort(port, boundPortObject) {
            const addressList = await this.resolvePort(port);
            if (boundPortObject.cancelled) {
                this.completeUnbind(boundPortObject);
                throw new Error('bindAsync operation cancelled by unbind call');
            }
            const portNumber = await this.bindAddressList(addressList, boundPortObject);
            if (boundPortObject.cancelled) {
                this.completeUnbind(boundPortObject);
                throw new Error('bindAsync operation cancelled by unbind call');
            }
            return portNumber;
        }
        normalizePort(port) {
            const initialPortUri = (0, uri_parser_1.parseUri)(port);
            if (initialPortUri === null) {
                throw new Error(`Could not parse port "${port}"`);
            }
            const portUri = (0, resolver_1.mapUriDefaultScheme)(initialPortUri);
            if (portUri === null) {
                throw new Error(`Could not get a default scheme for port "${port}"`);
            }
            return portUri;
        }
        bindAsync(port, creds, callback) {
            if (this.shutdown) {
                throw new Error('bindAsync called after shutdown');
            }
            if (typeof port !== 'string') {
                throw new TypeError('port must be a string');
            }
            if (creds === null || !(creds instanceof server_credentials_1.ServerCredentials)) {
                throw new TypeError('creds must be a ServerCredentials object');
            }
            if (typeof callback !== 'function') {
                throw new TypeError('callback must be a function');
            }
            this.trace('bindAsync port=' + port);
            const portUri = this.normalizePort(port);
            const deferredCallback = (error, port)=>{
                process.nextTick(()=>callback(error, port));
            };
            /* First, if this port is already bound or that bind operation is in
                 * progress, use that result. */ let boundPortObject = this.boundPorts.get((0, uri_parser_1.uriToString)(portUri));
            if (boundPortObject) {
                if (!creds._equals(boundPortObject.credentials)) {
                    deferredCallback(new Error(`${port} already bound with incompatible credentials`), 0);
                    return;
                }
                /* If that operation has previously been cancelled by an unbind call,
                     * uncancel it. */ boundPortObject.cancelled = false;
                if (boundPortObject.completionPromise) {
                    boundPortObject.completionPromise.then((portNum)=>callback(null, portNum), (error)=>callback(error, 0));
                } else {
                    deferredCallback(null, boundPortObject.portNumber);
                }
                return;
            }
            boundPortObject = {
                mapKey: (0, uri_parser_1.uriToString)(portUri),
                originalUri: portUri,
                completionPromise: null,
                cancelled: false,
                portNumber: 0,
                credentials: creds,
                listeningServers: new Set()
            };
            const splitPort = (0, uri_parser_1.splitHostPort)(portUri.path);
            const completionPromise = this.bindPort(portUri, boundPortObject);
            boundPortObject.completionPromise = completionPromise;
            /* If the port number is 0, defer populating the map entry until after the
                 * bind operation completes and we have a specific port number. Otherwise,
                 * populate it immediately. */ if ((splitPort === null || splitPort === void 0 ? void 0 : splitPort.port) === 0) {
                completionPromise.then((portNum)=>{
                    const finalUri = {
                        scheme: portUri.scheme,
                        authority: portUri.authority,
                        path: (0, uri_parser_1.combineHostPort)({
                            host: splitPort.host,
                            port: portNum
                        })
                    };
                    boundPortObject.mapKey = (0, uri_parser_1.uriToString)(finalUri);
                    boundPortObject.completionPromise = null;
                    boundPortObject.portNumber = portNum;
                    this.boundPorts.set(boundPortObject.mapKey, boundPortObject);
                    callback(null, portNum);
                }, (error)=>{
                    callback(error, 0);
                });
            } else {
                this.boundPorts.set(boundPortObject.mapKey, boundPortObject);
                completionPromise.then((portNum)=>{
                    boundPortObject.completionPromise = null;
                    boundPortObject.portNumber = portNum;
                    callback(null, portNum);
                }, (error)=>{
                    callback(error, 0);
                });
            }
        }
        registerInjectorToChannelz() {
            return (0, channelz_1.registerChannelzSocket)('injector', ()=>{
                return {
                    localAddress: null,
                    remoteAddress: null,
                    security: null,
                    remoteName: null,
                    streamsStarted: 0,
                    streamsSucceeded: 0,
                    streamsFailed: 0,
                    messagesSent: 0,
                    messagesReceived: 0,
                    keepAlivesSent: 0,
                    lastLocalStreamCreatedTimestamp: null,
                    lastRemoteStreamCreatedTimestamp: null,
                    lastMessageSentTimestamp: null,
                    lastMessageReceivedTimestamp: null,
                    localFlowControlWindow: null,
                    remoteFlowControlWindow: null
                };
            }, this.channelzEnabled);
        }
        createConnectionInjector(credentials) {
            if (credentials === null || !(credentials instanceof server_credentials_1.ServerCredentials)) {
                throw new TypeError('creds must be a ServerCredentials object');
            }
            const server = this.createHttp2Server(credentials);
            const channelzRef = this.registerInjectorToChannelz();
            if (this.channelzEnabled) {
                this.listenerChildrenTracker.refChild(channelzRef);
            }
            const sessionsSet = new Set();
            this.http2Servers.set(server, {
                channelzRef: channelzRef,
                sessions: sessionsSet
            });
            return {
                injectConnection: (connection)=>{
                    server.emit('connection', connection);
                },
                drain: (graceTimeMs)=>{
                    var _b, _c;
                    for (const session of sessionsSet){
                        this.closeSession(session);
                    }
                    (_c = (_b = setTimeout(()=>{
                        for (const session of sessionsSet){
                            session.destroy(http2.constants.NGHTTP2_CANCEL);
                        }
                    }, graceTimeMs)).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
                },
                destroy: ()=>{
                    this.closeServer(server);
                    for (const session of sessionsSet){
                        this.closeSession(session);
                    }
                }
            };
        }
        closeServer(server, callback) {
            this.trace('Closing server with address ' + JSON.stringify(server.address()));
            const serverInfo = this.http2Servers.get(server);
            server.close(()=>{
                if (serverInfo) {
                    this.listenerChildrenTracker.unrefChild(serverInfo.channelzRef);
                    (0, channelz_1.unregisterChannelzRef)(serverInfo.channelzRef);
                }
                this.http2Servers.delete(server);
                callback === null || callback === void 0 ? void 0 : callback();
            });
        }
        closeSession(session, callback) {
            var _b;
            this.trace('Closing session initiated by ' + ((_b = session.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress));
            const sessionInfo = this.sessions.get(session);
            const closeCallback = ()=>{
                if (sessionInfo) {
                    this.sessionChildrenTracker.unrefChild(sessionInfo.ref);
                    (0, channelz_1.unregisterChannelzRef)(sessionInfo.ref);
                }
                callback === null || callback === void 0 ? void 0 : callback();
            };
            if (session.closed) {
                queueMicrotask(closeCallback);
            } else {
                session.close(closeCallback);
            }
        }
        completeUnbind(boundPortObject) {
            for (const server of boundPortObject.listeningServers){
                const serverInfo = this.http2Servers.get(server);
                this.closeServer(server, ()=>{
                    boundPortObject.listeningServers.delete(server);
                });
                if (serverInfo) {
                    for (const session of serverInfo.sessions){
                        this.closeSession(session);
                    }
                }
            }
            this.boundPorts.delete(boundPortObject.mapKey);
        }
        /**
             * Unbind a previously bound port, or cancel an in-progress bindAsync
             * operation. If port 0 was bound, only the actual bound port can be
             * unbound. For example, if bindAsync was called with "localhost:0" and the
             * bound port result was 54321, it can be unbound as "localhost:54321".
             * @param port
             */ unbind(port) {
            this.trace('unbind port=' + port);
            const portUri = this.normalizePort(port);
            const splitPort = (0, uri_parser_1.splitHostPort)(portUri.path);
            if ((splitPort === null || splitPort === void 0 ? void 0 : splitPort.port) === 0) {
                throw new Error('Cannot unbind port 0');
            }
            const boundPortObject = this.boundPorts.get((0, uri_parser_1.uriToString)(portUri));
            if (boundPortObject) {
                this.trace('unbinding ' + boundPortObject.mapKey + ' originally bound as ' + (0, uri_parser_1.uriToString)(boundPortObject.originalUri));
                /* If the bind operation is pending, the cancelled flag will trigger
                     * the unbind operation later. */ if (boundPortObject.completionPromise) {
                    boundPortObject.cancelled = true;
                } else {
                    this.completeUnbind(boundPortObject);
                }
            }
        }
        /**
             * Gracefully close all connections associated with a previously bound port.
             * After the grace time, forcefully close all remaining open connections.
             *
             * If port 0 was bound, only the actual bound port can be
             * drained. For example, if bindAsync was called with "localhost:0" and the
             * bound port result was 54321, it can be drained as "localhost:54321".
             * @param port
             * @param graceTimeMs
             * @returns
             */ drain(port, graceTimeMs) {
            var _b, _c;
            this.trace('drain port=' + port + ' graceTimeMs=' + graceTimeMs);
            const portUri = this.normalizePort(port);
            const splitPort = (0, uri_parser_1.splitHostPort)(portUri.path);
            if ((splitPort === null || splitPort === void 0 ? void 0 : splitPort.port) === 0) {
                throw new Error('Cannot drain port 0');
            }
            const boundPortObject = this.boundPorts.get((0, uri_parser_1.uriToString)(portUri));
            if (!boundPortObject) {
                return;
            }
            const allSessions = new Set();
            for (const http2Server of boundPortObject.listeningServers){
                const serverEntry = this.http2Servers.get(http2Server);
                if (serverEntry) {
                    for (const session of serverEntry.sessions){
                        allSessions.add(session);
                        this.closeSession(session, ()=>{
                            allSessions.delete(session);
                        });
                    }
                }
            }
            /* After the grace time ends, send another goaway to all remaining sessions
                 * with the CANCEL code. */ (_c = (_b = setTimeout(()=>{
                for (const session of allSessions){
                    session.destroy(http2.constants.NGHTTP2_CANCEL);
                }
            }, graceTimeMs)).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
        }
        forceShutdown() {
            for (const boundPortObject of this.boundPorts.values()){
                boundPortObject.cancelled = true;
            }
            this.boundPorts.clear();
            // Close the server if it is still running.
            for (const server of this.http2Servers.keys()){
                this.closeServer(server);
            }
            // Always destroy any available sessions. It's possible that one or more
            // tryShutdown() calls are in progress. Don't wait on them to finish.
            this.sessions.forEach((channelzInfo, session)=>{
                this.closeSession(session);
                // Cast NGHTTP2_CANCEL to any because TypeScript doesn't seem to
                // recognize destroy(code) as a valid signature.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                session.destroy(http2.constants.NGHTTP2_CANCEL);
            });
            this.sessions.clear();
            (0, channelz_1.unregisterChannelzRef)(this.channelzRef);
            this.shutdown = true;
        }
        register(name, handler, serialize, deserialize, type) {
            if (this.handlers.has(name)) {
                return false;
            }
            this.handlers.set(name, {
                func: handler,
                serialize,
                deserialize,
                type,
                path: name
            });
            return true;
        }
        unregister(name) {
            return this.handlers.delete(name);
        }
        /**
             * @deprecated No longer needed as of version 1.10.x
             */ start() {
            if (this.http2Servers.size === 0 || [
                ...this.http2Servers.keys()
            ].every((server)=>!server.listening)) {
                throw new Error('server must be bound in order to start');
            }
            if (this.started === true) {
                throw new Error('server is already started');
            }
            this.started = true;
        }
        tryShutdown(callback) {
            var _b;
            const wrappedCallback = (error)=>{
                (0, channelz_1.unregisterChannelzRef)(this.channelzRef);
                callback(error);
            };
            let pendingChecks = 0;
            function maybeCallback() {
                pendingChecks--;
                if (pendingChecks === 0) {
                    wrappedCallback();
                }
            }
            this.shutdown = true;
            for (const [serverKey, server] of this.http2Servers.entries()){
                pendingChecks++;
                const serverString = server.channelzRef.name;
                this.trace('Waiting for server ' + serverString + ' to close');
                this.closeServer(serverKey, ()=>{
                    this.trace('Server ' + serverString + ' finished closing');
                    maybeCallback();
                });
                for (const session of server.sessions.keys()){
                    pendingChecks++;
                    const sessionString = (_b = session.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress;
                    this.trace('Waiting for session ' + sessionString + ' to close');
                    this.closeSession(session, ()=>{
                        this.trace('Session ' + sessionString + ' finished closing');
                        maybeCallback();
                    });
                }
            }
            if (pendingChecks === 0) {
                wrappedCallback();
            }
        }
        addHttp2Port() {
            throw new Error('Not yet implemented');
        }
        /**
             * Get the channelz reference object for this server. The returned value is
             * garbage if channelz is disabled for this server.
             * @returns
             */ getChannelzRef() {
            return this.channelzRef;
        }
        _verifyContentType(stream, headers) {
            const contentType = headers[http2.constants.HTTP2_HEADER_CONTENT_TYPE];
            if (typeof contentType !== 'string' || !contentType.startsWith('application/grpc')) {
                stream.respond({
                    [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE
                }, {
                    endStream: true
                });
                return false;
            }
            return true;
        }
        _retrieveHandler(path) {
            this.trace('Received call to method ' + path + ' at address ' + this.serverAddressString);
            const handler = this.handlers.get(path);
            if (handler === undefined) {
                this.trace('No handler registered for method ' + path + '. Sending UNIMPLEMENTED status.');
                return null;
            }
            return handler;
        }
        _respondWithError(err, stream, channelzSessionInfo = null) {
            var _b, _c;
            const trailersToSend = Object.assign({
                'grpc-status': (_b = err.code) !== null && _b !== void 0 ? _b : constants_1.Status.INTERNAL,
                'grpc-message': err.details,
                [http2.constants.HTTP2_HEADER_STATUS]: http2.constants.HTTP_STATUS_OK,
                [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'application/grpc+proto'
            }, (_c = err.metadata) === null || _c === void 0 ? void 0 : _c.toHttp2Headers());
            stream.respond(trailersToSend, {
                endStream: true
            });
            this.callTracker.addCallFailed();
            channelzSessionInfo === null || channelzSessionInfo === void 0 ? void 0 : channelzSessionInfo.streamTracker.addCallFailed();
        }
        _channelzHandler(extraInterceptors, stream, headers) {
            // for handling idle timeout
            this.onStreamOpened(stream);
            const channelzSessionInfo = this.sessions.get(stream.session);
            this.callTracker.addCallStarted();
            channelzSessionInfo === null || channelzSessionInfo === void 0 ? void 0 : channelzSessionInfo.streamTracker.addCallStarted();
            if (!this._verifyContentType(stream, headers)) {
                this.callTracker.addCallFailed();
                channelzSessionInfo === null || channelzSessionInfo === void 0 ? void 0 : channelzSessionInfo.streamTracker.addCallFailed();
                return;
            }
            const path = headers[HTTP2_HEADER_PATH];
            const handler = this._retrieveHandler(path);
            if (!handler) {
                this._respondWithError(getUnimplementedStatusResponse(path), stream, channelzSessionInfo);
                return;
            }
            const callEventTracker = {
                addMessageSent: ()=>{
                    if (channelzSessionInfo) {
                        channelzSessionInfo.messagesSent += 1;
                        channelzSessionInfo.lastMessageSentTimestamp = new Date();
                    }
                },
                addMessageReceived: ()=>{
                    if (channelzSessionInfo) {
                        channelzSessionInfo.messagesReceived += 1;
                        channelzSessionInfo.lastMessageReceivedTimestamp = new Date();
                    }
                },
                onCallEnd: (status)=>{
                    if (status.code === constants_1.Status.OK) {
                        this.callTracker.addCallSucceeded();
                    } else {
                        this.callTracker.addCallFailed();
                    }
                },
                onStreamEnd: (success)=>{
                    if (channelzSessionInfo) {
                        if (success) {
                            channelzSessionInfo.streamTracker.addCallSucceeded();
                        } else {
                            channelzSessionInfo.streamTracker.addCallFailed();
                        }
                    }
                }
            };
            const call = (0, server_interceptors_1.getServerInterceptingCall)([
                ...extraInterceptors,
                ...this.interceptors
            ], stream, headers, callEventTracker, handler, this.options);
            if (!this._runHandlerForCall(call, handler)) {
                this.callTracker.addCallFailed();
                channelzSessionInfo === null || channelzSessionInfo === void 0 ? void 0 : channelzSessionInfo.streamTracker.addCallFailed();
                call.sendStatus({
                    code: constants_1.Status.INTERNAL,
                    details: `Unknown handler type: ${handler.type}`
                });
            }
        }
        _streamHandler(extraInterceptors, stream, headers) {
            // for handling idle timeout
            this.onStreamOpened(stream);
            if (this._verifyContentType(stream, headers) !== true) {
                return;
            }
            const path = headers[HTTP2_HEADER_PATH];
            const handler = this._retrieveHandler(path);
            if (!handler) {
                this._respondWithError(getUnimplementedStatusResponse(path), stream, null);
                return;
            }
            const call = (0, server_interceptors_1.getServerInterceptingCall)([
                ...extraInterceptors,
                ...this.interceptors
            ], stream, headers, null, handler, this.options);
            if (!this._runHandlerForCall(call, handler)) {
                call.sendStatus({
                    code: constants_1.Status.INTERNAL,
                    details: `Unknown handler type: ${handler.type}`
                });
            }
        }
        _runHandlerForCall(call, handler) {
            const { type } = handler;
            if (type === 'unary') {
                handleUnary(call, handler);
            } else if (type === 'clientStream') {
                handleClientStreaming(call, handler);
            } else if (type === 'serverStream') {
                handleServerStreaming(call, handler);
            } else if (type === 'bidi') {
                handleBidiStreaming(call, handler);
            } else {
                return false;
            }
            return true;
        }
        _setupHandlers(http2Server, extraInterceptors) {
            if (http2Server === null) {
                return;
            }
            const serverAddress = http2Server.address();
            let serverAddressString = 'null';
            if (serverAddress) {
                if (typeof serverAddress === 'string') {
                    serverAddressString = serverAddress;
                } else {
                    serverAddressString = serverAddress.address + ':' + serverAddress.port;
                }
            }
            this.serverAddressString = serverAddressString;
            const handler = this.channelzEnabled ? this._channelzHandler : this._streamHandler;
            const sessionHandler = this.channelzEnabled ? this._channelzSessionHandler(http2Server) : this._sessionHandler(http2Server);
            http2Server.on('stream', handler.bind(this, extraInterceptors));
            http2Server.on('session', sessionHandler);
        }
        _sessionHandler(http2Server) {
            return (session)=>{
                var _b, _c;
                (_b = this.http2Servers.get(http2Server)) === null || _b === void 0 ? void 0 : _b.sessions.add(session);
                let connectionAgeTimer = null;
                let connectionAgeGraceTimer = null;
                let keepaliveTimer = null;
                let sessionClosedByServer = false;
                const idleTimeoutObj = this.enableIdleTimeout(session);
                if (this.maxConnectionAgeMs !== UNLIMITED_CONNECTION_AGE_MS) {
                    // Apply a random jitter within a +/-10% range
                    const jitterMagnitude = this.maxConnectionAgeMs / 10;
                    const jitter = Math.random() * jitterMagnitude * 2 - jitterMagnitude;
                    connectionAgeTimer = setTimeout(()=>{
                        var _b, _c;
                        sessionClosedByServer = true;
                        this.trace('Connection dropped by max connection age: ' + ((_b = session.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress));
                        try {
                            session.goaway(http2.constants.NGHTTP2_NO_ERROR, ~(1 << 31), kMaxAge);
                        } catch (e) {
                            // The goaway can't be sent because the session is already closed
                            session.destroy();
                            return;
                        }
                        session.close();
                        /* Allow a grace period after sending the GOAWAY before forcibly
                             * closing the connection. */ if (this.maxConnectionAgeGraceMs !== UNLIMITED_CONNECTION_AGE_MS) {
                            connectionAgeGraceTimer = setTimeout(()=>{
                                session.destroy();
                            }, this.maxConnectionAgeGraceMs);
                            (_c = connectionAgeGraceTimer.unref) === null || _c === void 0 ? void 0 : _c.call(connectionAgeGraceTimer);
                        }
                    }, this.maxConnectionAgeMs + jitter);
                    (_c = connectionAgeTimer.unref) === null || _c === void 0 ? void 0 : _c.call(connectionAgeTimer);
                }
                const clearKeepaliveTimeout = ()=>{
                    if (keepaliveTimer) {
                        clearTimeout(keepaliveTimer);
                        keepaliveTimer = null;
                    }
                };
                const canSendPing = ()=>{
                    return !session.destroyed && this.keepaliveTimeMs < KEEPALIVE_MAX_TIME_MS && this.keepaliveTimeMs > 0;
                };
                /* eslint-disable-next-line prefer-const */ let sendPing; // hoisted for use in maybeStartKeepalivePingTimer
                const maybeStartKeepalivePingTimer = ()=>{
                    var _b;
                    if (!canSendPing()) {
                        return;
                    }
                    this.keepaliveTrace('Starting keepalive timer for ' + this.keepaliveTimeMs + 'ms');
                    keepaliveTimer = setTimeout(()=>{
                        clearKeepaliveTimeout();
                        sendPing();
                    }, this.keepaliveTimeMs);
                    (_b = keepaliveTimer.unref) === null || _b === void 0 ? void 0 : _b.call(keepaliveTimer);
                };
                sendPing = ()=>{
                    var _b;
                    if (!canSendPing()) {
                        return;
                    }
                    this.keepaliveTrace('Sending ping with timeout ' + this.keepaliveTimeoutMs + 'ms');
                    let pingSendError = '';
                    try {
                        const pingSentSuccessfully = session.ping((err, duration, payload)=>{
                            clearKeepaliveTimeout();
                            if (err) {
                                this.keepaliveTrace('Ping failed with error: ' + err.message);
                                sessionClosedByServer = true;
                                session.close();
                            } else {
                                this.keepaliveTrace('Received ping response');
                                maybeStartKeepalivePingTimer();
                            }
                        });
                        if (!pingSentSuccessfully) {
                            pingSendError = 'Ping returned false';
                        }
                    } catch (e) {
                        // grpc/grpc-node#2139
                        pingSendError = (e instanceof Error ? e.message : '') || 'Unknown error';
                    }
                    if (pingSendError) {
                        this.keepaliveTrace('Ping send failed: ' + pingSendError);
                        this.trace('Connection dropped due to ping send error: ' + pingSendError);
                        sessionClosedByServer = true;
                        session.close();
                        return;
                    }
                    keepaliveTimer = setTimeout(()=>{
                        clearKeepaliveTimeout();
                        this.keepaliveTrace('Ping timeout passed without response');
                        this.trace('Connection dropped by keepalive timeout');
                        sessionClosedByServer = true;
                        session.close();
                    }, this.keepaliveTimeoutMs);
                    (_b = keepaliveTimer.unref) === null || _b === void 0 ? void 0 : _b.call(keepaliveTimer);
                };
                maybeStartKeepalivePingTimer();
                session.on('close', ()=>{
                    var _b, _c;
                    if (!sessionClosedByServer) {
                        this.trace(`Connection dropped by client ${(_b = session.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress}`);
                    }
                    if (connectionAgeTimer) {
                        clearTimeout(connectionAgeTimer);
                    }
                    if (connectionAgeGraceTimer) {
                        clearTimeout(connectionAgeGraceTimer);
                    }
                    clearKeepaliveTimeout();
                    if (idleTimeoutObj !== null) {
                        clearTimeout(idleTimeoutObj.timeout);
                        this.sessionIdleTimeouts.delete(session);
                    }
                    (_c = this.http2Servers.get(http2Server)) === null || _c === void 0 ? void 0 : _c.sessions.delete(session);
                });
            };
        }
        _channelzSessionHandler(http2Server) {
            return (session)=>{
                var _b, _c, _d, _e;
                const channelzRef = (0, channelz_1.registerChannelzSocket)((_c = (_b = session.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress) !== null && _c !== void 0 ? _c : 'unknown', this.getChannelzSessionInfo.bind(this, session), this.channelzEnabled);
                const channelzSessionInfo = {
                    ref: channelzRef,
                    streamTracker: new channelz_1.ChannelzCallTracker(),
                    messagesSent: 0,
                    messagesReceived: 0,
                    keepAlivesSent: 0,
                    lastMessageSentTimestamp: null,
                    lastMessageReceivedTimestamp: null
                };
                (_d = this.http2Servers.get(http2Server)) === null || _d === void 0 ? void 0 : _d.sessions.add(session);
                this.sessions.set(session, channelzSessionInfo);
                const clientAddress = `${session.socket.remoteAddress}:${session.socket.remotePort}`;
                this.channelzTrace.addTrace('CT_INFO', 'Connection established by client ' + clientAddress);
                this.trace('Connection established by client ' + clientAddress);
                this.sessionChildrenTracker.refChild(channelzRef);
                let connectionAgeTimer = null;
                let connectionAgeGraceTimer = null;
                let keepaliveTimeout = null;
                let sessionClosedByServer = false;
                const idleTimeoutObj = this.enableIdleTimeout(session);
                if (this.maxConnectionAgeMs !== UNLIMITED_CONNECTION_AGE_MS) {
                    // Apply a random jitter within a +/-10% range
                    const jitterMagnitude = this.maxConnectionAgeMs / 10;
                    const jitter = Math.random() * jitterMagnitude * 2 - jitterMagnitude;
                    connectionAgeTimer = setTimeout(()=>{
                        var _b;
                        sessionClosedByServer = true;
                        this.channelzTrace.addTrace('CT_INFO', 'Connection dropped by max connection age from ' + clientAddress);
                        try {
                            session.goaway(http2.constants.NGHTTP2_NO_ERROR, ~(1 << 31), kMaxAge);
                        } catch (e) {
                            // The goaway can't be sent because the session is already closed
                            session.destroy();
                            return;
                        }
                        session.close();
                        /* Allow a grace period after sending the GOAWAY before forcibly
                             * closing the connection. */ if (this.maxConnectionAgeGraceMs !== UNLIMITED_CONNECTION_AGE_MS) {
                            connectionAgeGraceTimer = setTimeout(()=>{
                                session.destroy();
                            }, this.maxConnectionAgeGraceMs);
                            (_b = connectionAgeGraceTimer.unref) === null || _b === void 0 ? void 0 : _b.call(connectionAgeGraceTimer);
                        }
                    }, this.maxConnectionAgeMs + jitter);
                    (_e = connectionAgeTimer.unref) === null || _e === void 0 ? void 0 : _e.call(connectionAgeTimer);
                }
                const clearKeepaliveTimeout = ()=>{
                    if (keepaliveTimeout) {
                        clearTimeout(keepaliveTimeout);
                        keepaliveTimeout = null;
                    }
                };
                const canSendPing = ()=>{
                    return !session.destroyed && this.keepaliveTimeMs < KEEPALIVE_MAX_TIME_MS && this.keepaliveTimeMs > 0;
                };
                /* eslint-disable-next-line prefer-const */ let sendPing; // hoisted for use in maybeStartKeepalivePingTimer
                const maybeStartKeepalivePingTimer = ()=>{
                    var _b;
                    if (!canSendPing()) {
                        return;
                    }
                    this.keepaliveTrace('Starting keepalive timer for ' + this.keepaliveTimeMs + 'ms');
                    keepaliveTimeout = setTimeout(()=>{
                        clearKeepaliveTimeout();
                        sendPing();
                    }, this.keepaliveTimeMs);
                    (_b = keepaliveTimeout.unref) === null || _b === void 0 ? void 0 : _b.call(keepaliveTimeout);
                };
                sendPing = ()=>{
                    var _b;
                    if (!canSendPing()) {
                        return;
                    }
                    this.keepaliveTrace('Sending ping with timeout ' + this.keepaliveTimeoutMs + 'ms');
                    let pingSendError = '';
                    try {
                        const pingSentSuccessfully = session.ping((err, duration, payload)=>{
                            clearKeepaliveTimeout();
                            if (err) {
                                this.keepaliveTrace('Ping failed with error: ' + err.message);
                                this.channelzTrace.addTrace('CT_INFO', 'Connection dropped due to error of a ping frame ' + err.message + ' return in ' + duration);
                                sessionClosedByServer = true;
                                session.close();
                            } else {
                                this.keepaliveTrace('Received ping response');
                                maybeStartKeepalivePingTimer();
                            }
                        });
                        if (!pingSentSuccessfully) {
                            pingSendError = 'Ping returned false';
                        }
                    } catch (e) {
                        // grpc/grpc-node#2139
                        pingSendError = (e instanceof Error ? e.message : '') || 'Unknown error';
                    }
                    if (pingSendError) {
                        this.keepaliveTrace('Ping send failed: ' + pingSendError);
                        this.channelzTrace.addTrace('CT_INFO', 'Connection dropped due to ping send error: ' + pingSendError);
                        sessionClosedByServer = true;
                        session.close();
                        return;
                    }
                    channelzSessionInfo.keepAlivesSent += 1;
                    keepaliveTimeout = setTimeout(()=>{
                        clearKeepaliveTimeout();
                        this.keepaliveTrace('Ping timeout passed without response');
                        this.channelzTrace.addTrace('CT_INFO', 'Connection dropped by keepalive timeout from ' + clientAddress);
                        sessionClosedByServer = true;
                        session.close();
                    }, this.keepaliveTimeoutMs);
                    (_b = keepaliveTimeout.unref) === null || _b === void 0 ? void 0 : _b.call(keepaliveTimeout);
                };
                maybeStartKeepalivePingTimer();
                session.on('close', ()=>{
                    var _b;
                    if (!sessionClosedByServer) {
                        this.channelzTrace.addTrace('CT_INFO', 'Connection dropped by client ' + clientAddress);
                    }
                    this.sessionChildrenTracker.unrefChild(channelzRef);
                    (0, channelz_1.unregisterChannelzRef)(channelzRef);
                    if (connectionAgeTimer) {
                        clearTimeout(connectionAgeTimer);
                    }
                    if (connectionAgeGraceTimer) {
                        clearTimeout(connectionAgeGraceTimer);
                    }
                    clearKeepaliveTimeout();
                    if (idleTimeoutObj !== null) {
                        clearTimeout(idleTimeoutObj.timeout);
                        this.sessionIdleTimeouts.delete(session);
                    }
                    (_b = this.http2Servers.get(http2Server)) === null || _b === void 0 ? void 0 : _b.sessions.delete(session);
                    this.sessions.delete(session);
                });
            };
        }
        enableIdleTimeout(session) {
            var _b, _c;
            if (this.sessionIdleTimeout >= MAX_CONNECTION_IDLE_MS) {
                return null;
            }
            const idleTimeoutObj = {
                activeStreams: 0,
                lastIdle: Date.now(),
                onClose: this.onStreamClose.bind(this, session),
                timeout: setTimeout(this.onIdleTimeout, this.sessionIdleTimeout, this, session)
            };
            (_c = (_b = idleTimeoutObj.timeout).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
            this.sessionIdleTimeouts.set(session, idleTimeoutObj);
            const { socket } = session;
            this.trace('Enable idle timeout for ' + socket.remoteAddress + ':' + socket.remotePort);
            return idleTimeoutObj;
        }
        onIdleTimeout(ctx, session) {
            const { socket } = session;
            const sessionInfo = ctx.sessionIdleTimeouts.get(session);
            // if it is called while we have activeStreams - timer will not be rescheduled
            // until last active stream is closed, then it will call .refresh() on the timer
            // important part is to not clearTimeout(timer) or it becomes unusable
            // for future refreshes
            if (sessionInfo !== undefined && sessionInfo.activeStreams === 0) {
                if (Date.now() - sessionInfo.lastIdle >= ctx.sessionIdleTimeout) {
                    ctx.trace('Session idle timeout triggered for ' + (socket === null || socket === void 0 ? void 0 : socket.remoteAddress) + ':' + (socket === null || socket === void 0 ? void 0 : socket.remotePort) + ' last idle at ' + sessionInfo.lastIdle);
                    ctx.closeSession(session);
                } else {
                    sessionInfo.timeout.refresh();
                }
            }
        }
        onStreamOpened(stream) {
            const session = stream.session;
            const idleTimeoutObj = this.sessionIdleTimeouts.get(session);
            if (idleTimeoutObj) {
                idleTimeoutObj.activeStreams += 1;
                stream.once('close', idleTimeoutObj.onClose);
            }
        }
        onStreamClose(session) {
            var _b, _c;
            const idleTimeoutObj = this.sessionIdleTimeouts.get(session);
            if (idleTimeoutObj) {
                idleTimeoutObj.activeStreams -= 1;
                if (idleTimeoutObj.activeStreams === 0) {
                    idleTimeoutObj.lastIdle = Date.now();
                    idleTimeoutObj.timeout.refresh();
                    this.trace('Session onStreamClose' + ((_b = session.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress) + ':' + ((_c = session.socket) === null || _c === void 0 ? void 0 : _c.remotePort) + ' at ' + idleTimeoutObj.lastIdle);
                }
            }
        }
    }, (()=>{
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _start_decorators = [
            deprecate('Calling start() is no longer necessary. It can be safely omitted.')
        ];
        __esDecorate(_a, null, _start_decorators, {
            kind: "method",
            name: "start",
            static: false,
            private: false,
            access: {
                has: (obj)=>"start" in obj,
                get: (obj)=>obj.start
            },
            metadata: _metadata
        }, null, _instanceExtraInitializers);
        if (_metadata) Object.defineProperty(_a, Symbol.metadata, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _metadata
        });
    })(), _a;
})();
exports.Server = Server;
async function handleUnary(call, handler) {
    let stream;
    function respond(err, value, trailer, flags) {
        if (err) {
            call.sendStatus((0, server_call_1.serverErrorToStatus)(err, trailer));
            return;
        }
        call.sendMessage(value, ()=>{
            call.sendStatus({
                code: constants_1.Status.OK,
                details: 'OK',
                metadata: trailer !== null && trailer !== void 0 ? trailer : null
            });
        });
    }
    let requestMetadata;
    let requestMessage = null;
    call.start({
        onReceiveMetadata (metadata) {
            requestMetadata = metadata;
            call.startRead();
        },
        onReceiveMessage (message) {
            if (requestMessage) {
                call.sendStatus({
                    code: constants_1.Status.UNIMPLEMENTED,
                    details: `Received a second request message for server streaming method ${handler.path}`,
                    metadata: null
                });
                return;
            }
            requestMessage = message;
            call.startRead();
        },
        onReceiveHalfClose () {
            if (!requestMessage) {
                call.sendStatus({
                    code: constants_1.Status.UNIMPLEMENTED,
                    details: `Received no request message for server streaming method ${handler.path}`,
                    metadata: null
                });
                return;
            }
            stream = new server_call_1.ServerWritableStreamImpl(handler.path, call, requestMetadata, requestMessage);
            try {
                handler.func(stream, respond);
            } catch (err) {
                call.sendStatus({
                    code: constants_1.Status.UNKNOWN,
                    details: `Server method handler threw error ${err.message}`,
                    metadata: null
                });
            }
        },
        onCancel () {
            if (stream) {
                stream.cancelled = true;
                stream.emit('cancelled', 'cancelled');
            }
        }
    });
}
function handleClientStreaming(call, handler) {
    let stream;
    function respond(err, value, trailer, flags) {
        if (err) {
            call.sendStatus((0, server_call_1.serverErrorToStatus)(err, trailer));
            return;
        }
        call.sendMessage(value, ()=>{
            call.sendStatus({
                code: constants_1.Status.OK,
                details: 'OK',
                metadata: trailer !== null && trailer !== void 0 ? trailer : null
            });
        });
    }
    call.start({
        onReceiveMetadata (metadata) {
            stream = new server_call_1.ServerDuplexStreamImpl(handler.path, call, metadata);
            try {
                handler.func(stream, respond);
            } catch (err) {
                call.sendStatus({
                    code: constants_1.Status.UNKNOWN,
                    details: `Server method handler threw error ${err.message}`,
                    metadata: null
                });
            }
        },
        onReceiveMessage (message) {
            stream.push(message);
        },
        onReceiveHalfClose () {
            stream.push(null);
        },
        onCancel () {
            if (stream) {
                stream.cancelled = true;
                stream.emit('cancelled', 'cancelled');
                stream.destroy();
            }
        }
    });
}
function handleServerStreaming(call, handler) {
    let stream;
    let requestMetadata;
    let requestMessage = null;
    call.start({
        onReceiveMetadata (metadata) {
            requestMetadata = metadata;
            call.startRead();
        },
        onReceiveMessage (message) {
            if (requestMessage) {
                call.sendStatus({
                    code: constants_1.Status.UNIMPLEMENTED,
                    details: `Received a second request message for server streaming method ${handler.path}`,
                    metadata: null
                });
                return;
            }
            requestMessage = message;
            call.startRead();
        },
        onReceiveHalfClose () {
            if (!requestMessage) {
                call.sendStatus({
                    code: constants_1.Status.UNIMPLEMENTED,
                    details: `Received no request message for server streaming method ${handler.path}`,
                    metadata: null
                });
                return;
            }
            stream = new server_call_1.ServerWritableStreamImpl(handler.path, call, requestMetadata, requestMessage);
            try {
                handler.func(stream);
            } catch (err) {
                call.sendStatus({
                    code: constants_1.Status.UNKNOWN,
                    details: `Server method handler threw error ${err.message}`,
                    metadata: null
                });
            }
        },
        onCancel () {
            if (stream) {
                stream.cancelled = true;
                stream.emit('cancelled', 'cancelled');
                stream.destroy();
            }
        }
    });
}
function handleBidiStreaming(call, handler) {
    let stream;
    call.start({
        onReceiveMetadata (metadata) {
            stream = new server_call_1.ServerDuplexStreamImpl(handler.path, call, metadata);
            try {
                handler.func(stream);
            } catch (err) {
                call.sendStatus({
                    code: constants_1.Status.UNKNOWN,
                    details: `Server method handler threw error ${err.message}`,
                    metadata: null
                });
            }
        },
        onReceiveMessage (message) {
            stream.push(message);
        },
        onReceiveHalfClose () {
            stream.push(null);
        },
        onCancel () {
            if (stream) {
                stream.cancelled = true;
                stream.emit('cancelled', 'cancelled');
                stream.destroy();
            }
        }
    });
} //# sourceMappingURL=server.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/status-builder.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.StatusBuilder = void 0;
/**
 * A builder for gRPC status objects.
 */ class StatusBuilder {
    constructor(){
        this.code = null;
        this.details = null;
        this.metadata = null;
    }
    /**
     * Adds a status code to the builder.
     */ withCode(code) {
        this.code = code;
        return this;
    }
    /**
     * Adds details to the builder.
     */ withDetails(details) {
        this.details = details;
        return this;
    }
    /**
     * Adds metadata to the builder.
     */ withMetadata(metadata) {
        this.metadata = metadata;
        return this;
    }
    /**
     * Builds the status object.
     */ build() {
        const status = {};
        if (this.code !== null) {
            status.code = this.code;
        }
        if (this.details !== null) {
            status.details = this.details;
        }
        if (this.metadata !== null) {
            status.metadata = this.metadata;
        }
        return status;
    }
}
exports.StatusBuilder = StatusBuilder; //# sourceMappingURL=status-builder.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/duration.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.parseDuration = exports.isDuration = exports.durationToMs = exports.msToDuration = void 0;
function msToDuration(millis) {
    return {
        seconds: millis / 1000 | 0,
        nanos: millis % 1000 * 1000000 | 0
    };
}
exports.msToDuration = msToDuration;
function durationToMs(duration) {
    return duration.seconds * 1000 + duration.nanos / 1000000 | 0;
}
exports.durationToMs = durationToMs;
function isDuration(value) {
    return typeof value.seconds === 'number' && typeof value.nanos === 'number';
}
exports.isDuration = isDuration;
const durationRegex = /^(\d+)(?:\.(\d+))?s$/;
function parseDuration(value) {
    const match = value.match(durationRegex);
    if (!match) {
        return null;
    }
    return {
        seconds: Number.parseInt(match[1], 10),
        nanos: match[2] ? Number.parseInt(match[2].padEnd(9, '0'), 10) : 0
    };
}
exports.parseDuration = parseDuration; //# sourceMappingURL=duration.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-pick-first.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.setup = exports.LeafLoadBalancer = exports.PickFirstLoadBalancer = exports.shuffled = exports.PickFirstLoadBalancingConfig = void 0;
const load_balancer_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer.js [app-rsc] (ecmascript)");
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
const picker_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/picker.js [app-rsc] (ecmascript)");
const subchannel_address_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const subchannel_address_2 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
const net_1 = __turbopack_require__("[externals]/ [external] (net, cjs)");
const TRACER_NAME = 'pick_first';
function trace(text) {
    logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, text);
}
const TYPE_NAME = 'pick_first';
/**
 * Delay after starting a connection on a subchannel before starting a
 * connection on the next subchannel in the list, for Happy Eyeballs algorithm.
 */ const CONNECTION_DELAY_INTERVAL_MS = 250;
class PickFirstLoadBalancingConfig {
    constructor(shuffleAddressList){
        this.shuffleAddressList = shuffleAddressList;
    }
    getLoadBalancerName() {
        return TYPE_NAME;
    }
    toJsonObject() {
        return {
            [TYPE_NAME]: {
                shuffleAddressList: this.shuffleAddressList
            }
        };
    }
    getShuffleAddressList() {
        return this.shuffleAddressList;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static createFromJson(obj) {
        if ('shuffleAddressList' in obj && !(typeof obj.shuffleAddressList === 'boolean')) {
            throw new Error('pick_first config field shuffleAddressList must be a boolean if provided');
        }
        return new PickFirstLoadBalancingConfig(obj.shuffleAddressList === true);
    }
}
exports.PickFirstLoadBalancingConfig = PickFirstLoadBalancingConfig;
/**
 * Picker for a `PickFirstLoadBalancer` in the READY state. Always returns the
 * picked subchannel.
 */ class PickFirstPicker {
    constructor(subchannel){
        this.subchannel = subchannel;
    }
    pick(pickArgs) {
        return {
            pickResultType: picker_1.PickResultType.COMPLETE,
            subchannel: this.subchannel,
            status: null,
            onCallStarted: null,
            onCallEnded: null
        };
    }
}
/**
 * Return a new array with the elements of the input array in a random order
 * @param list The input array
 * @returns A shuffled array of the elements of list
 */ function shuffled(list) {
    const result = list.slice();
    for(let i = result.length - 1; i > 1; i--){
        const j = Math.floor(Math.random() * (i + 1));
        const temp = result[i];
        result[i] = result[j];
        result[j] = temp;
    }
    return result;
}
exports.shuffled = shuffled;
/**
 * Interleave addresses in addressList by family in accordance with RFC-8304 section 4
 * @param addressList
 * @returns
 */ function interleaveAddressFamilies(addressList) {
    const result = [];
    const ipv6Addresses = [];
    const ipv4Addresses = [];
    const ipv6First = (0, subchannel_address_2.isTcpSubchannelAddress)(addressList[0]) && (0, net_1.isIPv6)(addressList[0].host);
    for (const address of addressList){
        if ((0, subchannel_address_2.isTcpSubchannelAddress)(address) && (0, net_1.isIPv6)(address.host)) {
            ipv6Addresses.push(address);
        } else {
            ipv4Addresses.push(address);
        }
    }
    const firstList = ipv6First ? ipv6Addresses : ipv4Addresses;
    const secondList = ipv6First ? ipv4Addresses : ipv6Addresses;
    for(let i = 0; i < Math.max(firstList.length, secondList.length); i++){
        if (i < firstList.length) {
            result.push(firstList[i]);
        }
        if (i < secondList.length) {
            result.push(secondList[i]);
        }
    }
    return result;
}
const REPORT_HEALTH_STATUS_OPTION_NAME = 'grpc-node.internal.pick-first.report_health_status';
class PickFirstLoadBalancer {
    /**
     * Load balancer that attempts to connect to each backend in the address list
     * in order, and picks the first one that connects, using it for every
     * request.
     * @param channelControlHelper `ChannelControlHelper` instance provided by
     *     this load balancer's owner.
     */ constructor(channelControlHelper, credentials, options){
        this.channelControlHelper = channelControlHelper;
        /**
         * The list of subchannels this load balancer is currently attempting to
         * connect to.
         */ this.children = [];
        /**
         * The current connectivity state of the load balancer.
         */ this.currentState = connectivity_state_1.ConnectivityState.IDLE;
        /**
         * The index within the `subchannels` array of the subchannel with the most
         * recently started connection attempt.
         */ this.currentSubchannelIndex = 0;
        /**
         * The currently picked subchannel used for making calls. Populated if
         * and only if the load balancer's current state is READY. In that case,
         * the subchannel's current state is also READY.
         */ this.currentPick = null;
        /**
         * Listener callback attached to each subchannel in the `subchannels` list
         * while establishing a connection.
         */ this.subchannelStateListener = (subchannel, previousState, newState, keepaliveTime, errorMessage)=>{
            this.onSubchannelStateUpdate(subchannel, previousState, newState, errorMessage);
        };
        this.pickedSubchannelHealthListener = ()=>this.calculateAndReportNewState();
        /**
         * The LB policy enters sticky TRANSIENT_FAILURE mode when all
         * subchannels have failed to connect at least once, and it stays in that
         * mode until a connection attempt is successful. While in sticky TF mode,
         * the LB policy continuously attempts to connect to all of its subchannels.
         */ this.stickyTransientFailureMode = false;
        /**
         * The most recent error reported by any subchannel as it transitioned to
         * TRANSIENT_FAILURE.
         */ this.lastError = null;
        this.latestAddressList = null;
        this.connectionDelayTimeout = setTimeout(()=>{}, 0);
        clearTimeout(this.connectionDelayTimeout);
        this.reportHealthStatus = options[REPORT_HEALTH_STATUS_OPTION_NAME];
    }
    allChildrenHaveReportedTF() {
        return this.children.every((child)=>child.hasReportedTransientFailure);
    }
    resetChildrenReportedTF() {
        this.children.every((child)=>child.hasReportedTransientFailure = false);
    }
    calculateAndReportNewState() {
        if (this.currentPick) {
            if (this.reportHealthStatus && !this.currentPick.isHealthy()) {
                this.updateState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE, new picker_1.UnavailablePicker({
                    details: `Picked subchannel ${this.currentPick.getAddress()} is unhealthy`
                }));
            } else {
                this.updateState(connectivity_state_1.ConnectivityState.READY, new PickFirstPicker(this.currentPick));
            }
        } else if (this.children.length === 0) {
            this.updateState(connectivity_state_1.ConnectivityState.IDLE, new picker_1.QueuePicker(this));
        } else {
            if (this.stickyTransientFailureMode) {
                this.updateState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE, new picker_1.UnavailablePicker({
                    details: `No connection established. Last error: ${this.lastError}`
                }));
            } else {
                this.updateState(connectivity_state_1.ConnectivityState.CONNECTING, new picker_1.QueuePicker(this));
            }
        }
    }
    requestReresolution() {
        this.channelControlHelper.requestReresolution();
    }
    maybeEnterStickyTransientFailureMode() {
        if (!this.allChildrenHaveReportedTF()) {
            return;
        }
        this.requestReresolution();
        this.resetChildrenReportedTF();
        if (this.stickyTransientFailureMode) {
            this.calculateAndReportNewState();
            return;
        }
        this.stickyTransientFailureMode = true;
        for (const { subchannel } of this.children){
            subchannel.startConnecting();
        }
        this.calculateAndReportNewState();
    }
    removeCurrentPick() {
        if (this.currentPick !== null) {
            this.currentPick.removeConnectivityStateListener(this.subchannelStateListener);
            this.channelControlHelper.removeChannelzChild(this.currentPick.getChannelzRef());
            this.currentPick.removeHealthStateWatcher(this.pickedSubchannelHealthListener);
            // Unref last, to avoid triggering listeners
            this.currentPick.unref();
            this.currentPick = null;
        }
    }
    onSubchannelStateUpdate(subchannel, previousState, newState, errorMessage) {
        var _a;
        if ((_a = this.currentPick) === null || _a === void 0 ? void 0 : _a.realSubchannelEquals(subchannel)) {
            if (newState !== connectivity_state_1.ConnectivityState.READY) {
                this.removeCurrentPick();
                this.calculateAndReportNewState();
            }
            return;
        }
        for (const [index, child] of this.children.entries()){
            if (subchannel.realSubchannelEquals(child.subchannel)) {
                if (newState === connectivity_state_1.ConnectivityState.READY) {
                    this.pickSubchannel(child.subchannel);
                }
                if (newState === connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE) {
                    child.hasReportedTransientFailure = true;
                    if (errorMessage) {
                        this.lastError = errorMessage;
                    }
                    this.maybeEnterStickyTransientFailureMode();
                    if (index === this.currentSubchannelIndex) {
                        this.startNextSubchannelConnecting(index + 1);
                    }
                }
                child.subchannel.startConnecting();
                return;
            }
        }
    }
    startNextSubchannelConnecting(startIndex) {
        clearTimeout(this.connectionDelayTimeout);
        for (const [index, child] of this.children.entries()){
            if (index >= startIndex) {
                const subchannelState = child.subchannel.getConnectivityState();
                if (subchannelState === connectivity_state_1.ConnectivityState.IDLE || subchannelState === connectivity_state_1.ConnectivityState.CONNECTING) {
                    this.startConnecting(index);
                    return;
                }
            }
        }
        this.maybeEnterStickyTransientFailureMode();
    }
    /**
     * Have a single subchannel in the `subchannels` list start connecting.
     * @param subchannelIndex The index into the `subchannels` list.
     */ startConnecting(subchannelIndex) {
        var _a, _b;
        clearTimeout(this.connectionDelayTimeout);
        this.currentSubchannelIndex = subchannelIndex;
        if (this.children[subchannelIndex].subchannel.getConnectivityState() === connectivity_state_1.ConnectivityState.IDLE) {
            trace('Start connecting to subchannel with address ' + this.children[subchannelIndex].subchannel.getAddress());
            process.nextTick(()=>{
                var _a;
                (_a = this.children[subchannelIndex]) === null || _a === void 0 ? void 0 : _a.subchannel.startConnecting();
            });
        }
        this.connectionDelayTimeout = setTimeout(()=>{
            this.startNextSubchannelConnecting(subchannelIndex + 1);
        }, CONNECTION_DELAY_INTERVAL_MS);
        (_b = (_a = this.connectionDelayTimeout).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    /**
     * Declare that the specified subchannel should be used to make requests.
     * This functions the same independent of whether subchannel is a member of
     * this.children and whether it is equal to this.currentPick.
     * Prerequisite: subchannel.getConnectivityState() === READY.
     * @param subchannel
     */ pickSubchannel(subchannel) {
        trace('Pick subchannel with address ' + subchannel.getAddress());
        this.stickyTransientFailureMode = false;
        /* Ref before removeCurrentPick and resetSubchannelList to avoid the
         * refcount dropping to 0 during this process. */ subchannel.ref();
        this.channelControlHelper.addChannelzChild(subchannel.getChannelzRef());
        this.removeCurrentPick();
        this.resetSubchannelList();
        subchannel.addConnectivityStateListener(this.subchannelStateListener);
        subchannel.addHealthStateWatcher(this.pickedSubchannelHealthListener);
        this.currentPick = subchannel;
        clearTimeout(this.connectionDelayTimeout);
        this.calculateAndReportNewState();
    }
    updateState(newState, picker) {
        trace(connectivity_state_1.ConnectivityState[this.currentState] + ' -> ' + connectivity_state_1.ConnectivityState[newState]);
        this.currentState = newState;
        this.channelControlHelper.updateState(newState, picker);
    }
    resetSubchannelList() {
        for (const child of this.children){
            /* Always remoev the connectivity state listener. If the subchannel is
               getting picked, it will be re-added then. */ child.subchannel.removeConnectivityStateListener(this.subchannelStateListener);
            /* Refs are counted independently for the children list and the
             * currentPick, so we call unref whether or not the child is the
             * currentPick. Channelz child references are also refcounted, so
             * removeChannelzChild can be handled the same way. */ child.subchannel.unref();
            this.channelControlHelper.removeChannelzChild(child.subchannel.getChannelzRef());
        }
        this.currentSubchannelIndex = 0;
        this.children = [];
    }
    connectToAddressList(addressList) {
        trace('connectToAddressList([' + addressList.map((address)=>(0, subchannel_address_1.subchannelAddressToString)(address)) + '])');
        const newChildrenList = addressList.map((address)=>({
                subchannel: this.channelControlHelper.createSubchannel(address, {}, null),
                hasReportedTransientFailure: false
            }));
        for (const { subchannel } of newChildrenList){
            if (subchannel.getConnectivityState() === connectivity_state_1.ConnectivityState.READY) {
                this.pickSubchannel(subchannel);
                return;
            }
        }
        /* Ref each subchannel before resetting the list, to ensure that
         * subchannels shared between the list don't drop to 0 refs during the
         * transition. */ for (const { subchannel } of newChildrenList){
            subchannel.ref();
            this.channelControlHelper.addChannelzChild(subchannel.getChannelzRef());
        }
        this.resetSubchannelList();
        this.children = newChildrenList;
        for (const { subchannel } of this.children){
            subchannel.addConnectivityStateListener(this.subchannelStateListener);
        }
        for (const child of this.children){
            if (child.subchannel.getConnectivityState() === connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE) {
                child.hasReportedTransientFailure = true;
            }
        }
        this.startNextSubchannelConnecting(0);
        this.calculateAndReportNewState();
    }
    updateAddressList(endpointList, lbConfig) {
        if (!(lbConfig instanceof PickFirstLoadBalancingConfig)) {
            return;
        }
        /* Previously, an update would be discarded if it was identical to the
         * previous update, to minimize churn. Now the DNS resolver is
         * rate-limited, so that is less of a concern. */ if (lbConfig.getShuffleAddressList()) {
            endpointList = shuffled(endpointList);
        }
        const rawAddressList = [].concat(...endpointList.map((endpoint)=>endpoint.addresses));
        trace('updateAddressList([' + rawAddressList.map((address)=>(0, subchannel_address_1.subchannelAddressToString)(address)) + '])');
        if (rawAddressList.length === 0) {
            throw new Error('No addresses in endpoint list passed to pick_first');
        }
        const addressList = interleaveAddressFamilies(rawAddressList);
        this.latestAddressList = addressList;
        this.connectToAddressList(addressList);
    }
    exitIdle() {
        if (this.currentState === connectivity_state_1.ConnectivityState.IDLE && this.latestAddressList) {
            this.connectToAddressList(this.latestAddressList);
        }
    }
    resetBackoff() {
    /* The pick first load balancer does not have a connection backoff, so this
         * does nothing */ }
    destroy() {
        this.resetSubchannelList();
        this.removeCurrentPick();
    }
    getTypeName() {
        return TYPE_NAME;
    }
}
exports.PickFirstLoadBalancer = PickFirstLoadBalancer;
const LEAF_CONFIG = new PickFirstLoadBalancingConfig(false);
/**
 * This class handles the leaf load balancing operations for a single endpoint.
 * It is a thin wrapper around a PickFirstLoadBalancer with a different API
 * that more closely reflects how it will be used as a leaf balancer.
 */ class LeafLoadBalancer {
    constructor(endpoint, channelControlHelper, credentials, options){
        this.endpoint = endpoint;
        this.latestState = connectivity_state_1.ConnectivityState.IDLE;
        const childChannelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(channelControlHelper, {
            updateState: (connectivityState, picker)=>{
                this.latestState = connectivityState;
                this.latestPicker = picker;
                channelControlHelper.updateState(connectivityState, picker);
            }
        });
        this.pickFirstBalancer = new PickFirstLoadBalancer(childChannelControlHelper, credentials, Object.assign(Object.assign({}, options), {
            [REPORT_HEALTH_STATUS_OPTION_NAME]: true
        }));
        this.latestPicker = new picker_1.QueuePicker(this.pickFirstBalancer);
    }
    startConnecting() {
        this.pickFirstBalancer.updateAddressList([
            this.endpoint
        ], LEAF_CONFIG);
    }
    /**
     * Update the endpoint associated with this LeafLoadBalancer to a new
     * endpoint. Does not trigger connection establishment if a connection
     * attempt is not already in progress.
     * @param newEndpoint
     */ updateEndpoint(newEndpoint) {
        this.endpoint = newEndpoint;
        if (this.latestState !== connectivity_state_1.ConnectivityState.IDLE) {
            this.startConnecting();
        }
    }
    getConnectivityState() {
        return this.latestState;
    }
    getPicker() {
        return this.latestPicker;
    }
    getEndpoint() {
        return this.endpoint;
    }
    exitIdle() {
        this.pickFirstBalancer.exitIdle();
    }
    destroy() {
        this.pickFirstBalancer.destroy();
    }
}
exports.LeafLoadBalancer = LeafLoadBalancer;
function setup() {
    (0, load_balancer_1.registerLoadBalancerType)(TYPE_NAME, PickFirstLoadBalancer, PickFirstLoadBalancingConfig);
    (0, load_balancer_1.registerDefaultLoadBalancerType)(TYPE_NAME);
}
exports.setup = setup; //# sourceMappingURL=load-balancer-pick-first.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/certificate-provider.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2024 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.FileWatcherCertificateProvider = void 0;
const fs = __turbopack_require__("[externals]/ [external] (fs, cjs)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const util_1 = __turbopack_require__("[externals]/ [external] (util, cjs)");
const TRACER_NAME = 'certificate_provider';
function trace(text) {
    logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, text);
}
const readFilePromise = (0, util_1.promisify)(fs.readFile);
class FileWatcherCertificateProvider {
    constructor(config){
        this.config = config;
        this.refreshTimer = null;
        this.fileResultPromise = null;
        this.latestCaUpdate = null;
        this.caListeners = new Set();
        this.latestIdentityUpdate = null;
        this.identityListeners = new Set();
        this.lastUpdateTime = null;
        if (config.certificateFile === undefined !== (config.privateKeyFile === undefined)) {
            throw new Error('certificateFile and privateKeyFile must be set or unset together');
        }
        if (config.certificateFile === undefined && config.caCertificateFile === undefined) {
            throw new Error('At least one of certificateFile and caCertificateFile must be set');
        }
        trace('File watcher constructed with config ' + JSON.stringify(config));
    }
    updateCertificates() {
        if (this.fileResultPromise) {
            return;
        }
        this.fileResultPromise = Promise.allSettled([
            this.config.certificateFile ? readFilePromise(this.config.certificateFile) : Promise.reject(),
            this.config.privateKeyFile ? readFilePromise(this.config.privateKeyFile) : Promise.reject(),
            this.config.caCertificateFile ? readFilePromise(this.config.caCertificateFile) : Promise.reject()
        ]);
        this.fileResultPromise.then(([certificateResult, privateKeyResult, caCertificateResult])=>{
            if (!this.refreshTimer) {
                return;
            }
            trace('File watcher read certificates certificate' + (certificateResult ? '!=' : '==') + 'null, privateKey' + (privateKeyResult ? '!=' : '==') + 'null, CA certificate' + (caCertificateResult ? '!=' : '==') + 'null');
            this.lastUpdateTime = new Date();
            this.fileResultPromise = null;
            if (certificateResult.status === 'fulfilled' && privateKeyResult.status === 'fulfilled') {
                this.latestIdentityUpdate = {
                    certificate: certificateResult.value,
                    privateKey: privateKeyResult.value
                };
            } else {
                this.latestIdentityUpdate = null;
            }
            if (caCertificateResult.status === 'fulfilled') {
                this.latestCaUpdate = {
                    caCertificate: caCertificateResult.value
                };
            }
            for (const listener of this.identityListeners){
                listener(this.latestIdentityUpdate);
            }
            for (const listener of this.caListeners){
                listener(this.latestCaUpdate);
            }
        });
        trace('File watcher initiated certificate update');
    }
    maybeStartWatchingFiles() {
        if (!this.refreshTimer) {
            /* Perform the first read immediately, but only if there was not already
             * a recent read, to avoid reading from the filesystem significantly more
             * frequently than configured if the provider quickly switches between
             * used and unused. */ const timeSinceLastUpdate = this.lastUpdateTime ? new Date().getTime() - this.lastUpdateTime.getTime() : Infinity;
            if (timeSinceLastUpdate > this.config.refreshIntervalMs) {
                this.updateCertificates();
            }
            if (timeSinceLastUpdate > this.config.refreshIntervalMs * 2) {
                // Clear out old updates if they are definitely stale
                this.latestCaUpdate = null;
                this.latestIdentityUpdate = null;
            }
            this.refreshTimer = setInterval(()=>this.updateCertificates(), this.config.refreshIntervalMs);
            trace('File watcher started watching');
        }
    }
    maybeStopWatchingFiles() {
        if (this.caListeners.size === 0 && this.identityListeners.size === 0) {
            this.fileResultPromise = null;
            if (this.refreshTimer) {
                clearInterval(this.refreshTimer);
                this.refreshTimer = null;
            }
        }
    }
    addCaCertificateListener(listener) {
        this.caListeners.add(listener);
        this.maybeStartWatchingFiles();
        process.nextTick(listener, this.latestCaUpdate);
    }
    removeCaCertificateListener(listener) {
        this.caListeners.delete(listener);
        this.maybeStopWatchingFiles();
    }
    addIdentityCertificateListener(listener) {
        this.identityListeners.add(listener);
        this.maybeStartWatchingFiles();
        process.nextTick(listener, this.latestIdentityUpdate);
    }
    removeIdentityCertificateListener(listener) {
        this.identityListeners.delete(listener);
        this.maybeStopWatchingFiles();
    }
}
exports.FileWatcherCertificateProvider = FileWatcherCertificateProvider; //# sourceMappingURL=certificate-provider.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/experimental.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.createCertificateProviderChannelCredentials = exports.FileWatcherCertificateProvider = exports.createCertificateProviderServerCredentials = exports.createServerCredentialsWithInterceptors = exports.BaseSubchannelWrapper = exports.registerAdminService = exports.FilterStackFactory = exports.BaseFilter = exports.PickResultType = exports.QueuePicker = exports.UnavailablePicker = exports.ChildLoadBalancerHandler = exports.EndpointMap = exports.endpointHasAddress = exports.endpointToString = exports.subchannelAddressToString = exports.LeafLoadBalancer = exports.isLoadBalancerNameRegistered = exports.parseLoadBalancingConfig = exports.selectLbConfigFromList = exports.registerLoadBalancerType = exports.createChildChannelControlHelper = exports.BackoffTimeout = exports.parseDuration = exports.durationToMs = exports.splitHostPort = exports.uriToString = exports.createResolver = exports.registerResolver = exports.log = exports.trace = void 0;
var logging_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "trace", {
    enumerable: true,
    get: function() {
        return logging_1.trace;
    }
});
Object.defineProperty(exports, "log", {
    enumerable: true,
    get: function() {
        return logging_1.log;
    }
});
var resolver_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "registerResolver", {
    enumerable: true,
    get: function() {
        return resolver_1.registerResolver;
    }
});
Object.defineProperty(exports, "createResolver", {
    enumerable: true,
    get: function() {
        return resolver_1.createResolver;
    }
});
var uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "uriToString", {
    enumerable: true,
    get: function() {
        return uri_parser_1.uriToString;
    }
});
Object.defineProperty(exports, "splitHostPort", {
    enumerable: true,
    get: function() {
        return uri_parser_1.splitHostPort;
    }
});
var duration_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/duration.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "durationToMs", {
    enumerable: true,
    get: function() {
        return duration_1.durationToMs;
    }
});
Object.defineProperty(exports, "parseDuration", {
    enumerable: true,
    get: function() {
        return duration_1.parseDuration;
    }
});
var backoff_timeout_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/backoff-timeout.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "BackoffTimeout", {
    enumerable: true,
    get: function() {
        return backoff_timeout_1.BackoffTimeout;
    }
});
var load_balancer_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "createChildChannelControlHelper", {
    enumerable: true,
    get: function() {
        return load_balancer_1.createChildChannelControlHelper;
    }
});
Object.defineProperty(exports, "registerLoadBalancerType", {
    enumerable: true,
    get: function() {
        return load_balancer_1.registerLoadBalancerType;
    }
});
Object.defineProperty(exports, "selectLbConfigFromList", {
    enumerable: true,
    get: function() {
        return load_balancer_1.selectLbConfigFromList;
    }
});
Object.defineProperty(exports, "parseLoadBalancingConfig", {
    enumerable: true,
    get: function() {
        return load_balancer_1.parseLoadBalancingConfig;
    }
});
Object.defineProperty(exports, "isLoadBalancerNameRegistered", {
    enumerable: true,
    get: function() {
        return load_balancer_1.isLoadBalancerNameRegistered;
    }
});
var load_balancer_pick_first_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-pick-first.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "LeafLoadBalancer", {
    enumerable: true,
    get: function() {
        return load_balancer_pick_first_1.LeafLoadBalancer;
    }
});
var subchannel_address_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "subchannelAddressToString", {
    enumerable: true,
    get: function() {
        return subchannel_address_1.subchannelAddressToString;
    }
});
Object.defineProperty(exports, "endpointToString", {
    enumerable: true,
    get: function() {
        return subchannel_address_1.endpointToString;
    }
});
Object.defineProperty(exports, "endpointHasAddress", {
    enumerable: true,
    get: function() {
        return subchannel_address_1.endpointHasAddress;
    }
});
Object.defineProperty(exports, "EndpointMap", {
    enumerable: true,
    get: function() {
        return subchannel_address_1.EndpointMap;
    }
});
var load_balancer_child_handler_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-child-handler.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ChildLoadBalancerHandler", {
    enumerable: true,
    get: function() {
        return load_balancer_child_handler_1.ChildLoadBalancerHandler;
    }
});
var picker_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/picker.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "UnavailablePicker", {
    enumerable: true,
    get: function() {
        return picker_1.UnavailablePicker;
    }
});
Object.defineProperty(exports, "QueuePicker", {
    enumerable: true,
    get: function() {
        return picker_1.QueuePicker;
    }
});
Object.defineProperty(exports, "PickResultType", {
    enumerable: true,
    get: function() {
        return picker_1.PickResultType;
    }
});
var filter_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/filter.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "BaseFilter", {
    enumerable: true,
    get: function() {
        return filter_1.BaseFilter;
    }
});
var filter_stack_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/filter-stack.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "FilterStackFactory", {
    enumerable: true,
    get: function() {
        return filter_stack_1.FilterStackFactory;
    }
});
var admin_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/admin.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "registerAdminService", {
    enumerable: true,
    get: function() {
        return admin_1.registerAdminService;
    }
});
var subchannel_interface_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-interface.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "BaseSubchannelWrapper", {
    enumerable: true,
    get: function() {
        return subchannel_interface_1.BaseSubchannelWrapper;
    }
});
var server_credentials_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server-credentials.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "createServerCredentialsWithInterceptors", {
    enumerable: true,
    get: function() {
        return server_credentials_1.createServerCredentialsWithInterceptors;
    }
});
Object.defineProperty(exports, "createCertificateProviderServerCredentials", {
    enumerable: true,
    get: function() {
        return server_credentials_1.createCertificateProviderServerCredentials;
    }
});
var certificate_provider_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/certificate-provider.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "FileWatcherCertificateProvider", {
    enumerable: true,
    get: function() {
        return certificate_provider_1.FileWatcherCertificateProvider;
    }
});
var channel_credentials_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channel-credentials.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "createCertificateProviderChannelCredentials", {
    enumerable: true,
    get: function() {
        return channel_credentials_1.createCertificateProviderChannelCredentials;
    }
}); //# sourceMappingURL=experimental.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver-uds.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.setup = void 0;
const resolver_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver.js [app-rsc] (ecmascript)");
class UdsResolver {
    constructor(target, listener, channelOptions){
        this.listener = listener;
        this.hasReturnedResult = false;
        this.endpoints = [];
        let path;
        if (target.authority === '') {
            path = '/' + target.path;
        } else {
            path = target.path;
        }
        this.endpoints = [
            {
                addresses: [
                    {
                        path
                    }
                ]
            }
        ];
    }
    updateResolution() {
        if (!this.hasReturnedResult) {
            this.hasReturnedResult = true;
            process.nextTick(this.listener.onSuccessfulResolution, this.endpoints, null, null, null, {});
        }
    }
    destroy() {
        this.hasReturnedResult = false;
    }
    static getDefaultAuthority(target) {
        return 'localhost';
    }
}
function setup() {
    (0, resolver_1.registerResolver)('unix', UdsResolver);
}
exports.setup = setup; //# sourceMappingURL=resolver-uds.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver-ip.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2021 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.setup = void 0;
const net_1 = __turbopack_require__("[externals]/ [external] (net, cjs)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
const resolver_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver.js [app-rsc] (ecmascript)");
const uri_parser_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/uri-parser.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'ip_resolver';
function trace(text) {
    logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, text);
}
const IPV4_SCHEME = 'ipv4';
const IPV6_SCHEME = 'ipv6';
/**
 * The default TCP port to connect to if not explicitly specified in the target.
 */ const DEFAULT_PORT = 443;
class IpResolver {
    constructor(target, listener, channelOptions){
        var _a;
        this.listener = listener;
        this.endpoints = [];
        this.error = null;
        this.hasReturnedResult = false;
        trace('Resolver constructed for target ' + (0, uri_parser_1.uriToString)(target));
        const addresses = [];
        if (!(target.scheme === IPV4_SCHEME || target.scheme === IPV6_SCHEME)) {
            this.error = {
                code: constants_1.Status.UNAVAILABLE,
                details: `Unrecognized scheme ${target.scheme} in IP resolver`,
                metadata: new metadata_1.Metadata()
            };
            return;
        }
        const pathList = target.path.split(',');
        for (const path of pathList){
            const hostPort = (0, uri_parser_1.splitHostPort)(path);
            if (hostPort === null) {
                this.error = {
                    code: constants_1.Status.UNAVAILABLE,
                    details: `Failed to parse ${target.scheme} address ${path}`,
                    metadata: new metadata_1.Metadata()
                };
                return;
            }
            if (target.scheme === IPV4_SCHEME && !(0, net_1.isIPv4)(hostPort.host) || target.scheme === IPV6_SCHEME && !(0, net_1.isIPv6)(hostPort.host)) {
                this.error = {
                    code: constants_1.Status.UNAVAILABLE,
                    details: `Failed to parse ${target.scheme} address ${path}`,
                    metadata: new metadata_1.Metadata()
                };
                return;
            }
            addresses.push({
                host: hostPort.host,
                port: (_a = hostPort.port) !== null && _a !== void 0 ? _a : DEFAULT_PORT
            });
        }
        this.endpoints = addresses.map((address)=>({
                addresses: [
                    address
                ]
            }));
        trace('Parsed ' + target.scheme + ' address list ' + addresses);
    }
    updateResolution() {
        if (!this.hasReturnedResult) {
            this.hasReturnedResult = true;
            process.nextTick(()=>{
                if (this.error) {
                    this.listener.onError(this.error);
                } else {
                    this.listener.onSuccessfulResolution(this.endpoints, null, null, null, {});
                }
            });
        }
    }
    destroy() {
        this.hasReturnedResult = false;
    }
    static getDefaultAuthority(target) {
        return target.path.split(',')[0];
    }
}
function setup() {
    (0, resolver_1.registerResolver)(IPV4_SCHEME, IpResolver);
    (0, resolver_1.registerResolver)(IPV6_SCHEME, IpResolver);
}
exports.setup = setup; //# sourceMappingURL=resolver-ip.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-round-robin.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.setup = exports.RoundRobinLoadBalancer = void 0;
const load_balancer_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer.js [app-rsc] (ecmascript)");
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
const picker_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/picker.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const subchannel_address_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
const load_balancer_pick_first_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-pick-first.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'round_robin';
function trace(text) {
    logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, text);
}
const TYPE_NAME = 'round_robin';
class RoundRobinLoadBalancingConfig {
    getLoadBalancerName() {
        return TYPE_NAME;
    }
    constructor(){}
    toJsonObject() {
        return {
            [TYPE_NAME]: {}
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static createFromJson(obj) {
        return new RoundRobinLoadBalancingConfig();
    }
}
class RoundRobinPicker {
    constructor(children, nextIndex = 0){
        this.children = children;
        this.nextIndex = nextIndex;
    }
    pick(pickArgs) {
        const childPicker = this.children[this.nextIndex].picker;
        this.nextIndex = (this.nextIndex + 1) % this.children.length;
        return childPicker.pick(pickArgs);
    }
    /**
     * Check what the next subchannel returned would be. Used by the load
     * balancer implementation to preserve this part of the picker state if
     * possible when a subchannel connects or disconnects.
     */ peekNextEndpoint() {
        return this.children[this.nextIndex].endpoint;
    }
}
class RoundRobinLoadBalancer {
    constructor(channelControlHelper, credentials, options){
        this.channelControlHelper = channelControlHelper;
        this.credentials = credentials;
        this.options = options;
        this.children = [];
        this.currentState = connectivity_state_1.ConnectivityState.IDLE;
        this.currentReadyPicker = null;
        this.updatesPaused = false;
        this.lastError = null;
        this.childChannelControlHelper = (0, load_balancer_1.createChildChannelControlHelper)(channelControlHelper, {
            updateState: (connectivityState, picker)=>{
                /* Ensure that name resolution is requested again after active
                 * connections are dropped. This is more aggressive than necessary to
                 * accomplish that, so we are counting on resolvers to have
                 * reasonable rate limits. */ if (this.currentState === connectivity_state_1.ConnectivityState.READY && connectivityState !== connectivity_state_1.ConnectivityState.READY) {
                    this.channelControlHelper.requestReresolution();
                }
                this.calculateAndUpdateState();
            }
        });
    }
    countChildrenWithState(state) {
        return this.children.filter((child)=>child.getConnectivityState() === state).length;
    }
    calculateAndUpdateState() {
        if (this.updatesPaused) {
            return;
        }
        if (this.countChildrenWithState(connectivity_state_1.ConnectivityState.READY) > 0) {
            const readyChildren = this.children.filter((child)=>child.getConnectivityState() === connectivity_state_1.ConnectivityState.READY);
            let index = 0;
            if (this.currentReadyPicker !== null) {
                const nextPickedEndpoint = this.currentReadyPicker.peekNextEndpoint();
                index = readyChildren.findIndex((child)=>(0, subchannel_address_1.endpointEqual)(child.getEndpoint(), nextPickedEndpoint));
                if (index < 0) {
                    index = 0;
                }
            }
            this.updateState(connectivity_state_1.ConnectivityState.READY, new RoundRobinPicker(readyChildren.map((child)=>({
                    endpoint: child.getEndpoint(),
                    picker: child.getPicker()
                })), index));
        } else if (this.countChildrenWithState(connectivity_state_1.ConnectivityState.CONNECTING) > 0) {
            this.updateState(connectivity_state_1.ConnectivityState.CONNECTING, new picker_1.QueuePicker(this));
        } else if (this.countChildrenWithState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE) > 0) {
            this.updateState(connectivity_state_1.ConnectivityState.TRANSIENT_FAILURE, new picker_1.UnavailablePicker({
                details: `No connection established. Last error: ${this.lastError}`
            }));
        } else {
            this.updateState(connectivity_state_1.ConnectivityState.IDLE, new picker_1.QueuePicker(this));
        }
        /* round_robin should keep all children connected, this is how we do that.
         * We can't do this more efficiently in the individual child's updateState
         * callback because that doesn't have a reference to which child the state
         * change is associated with. */ for (const child of this.children){
            if (child.getConnectivityState() === connectivity_state_1.ConnectivityState.IDLE) {
                child.exitIdle();
            }
        }
    }
    updateState(newState, picker) {
        trace(connectivity_state_1.ConnectivityState[this.currentState] + ' -> ' + connectivity_state_1.ConnectivityState[newState]);
        if (newState === connectivity_state_1.ConnectivityState.READY) {
            this.currentReadyPicker = picker;
        } else {
            this.currentReadyPicker = null;
        }
        this.currentState = newState;
        this.channelControlHelper.updateState(newState, picker);
    }
    resetSubchannelList() {
        for (const child of this.children){
            child.destroy();
        }
    }
    updateAddressList(endpointList, lbConfig) {
        this.resetSubchannelList();
        trace('Connect to endpoint list ' + endpointList.map(subchannel_address_1.endpointToString));
        this.updatesPaused = true;
        this.children = endpointList.map((endpoint)=>new load_balancer_pick_first_1.LeafLoadBalancer(endpoint, this.childChannelControlHelper, this.credentials, this.options));
        for (const child of this.children){
            child.startConnecting();
        }
        this.updatesPaused = false;
        this.calculateAndUpdateState();
    }
    exitIdle() {
    /* The round_robin LB policy is only in the IDLE state if it has no
         * addresses to try to connect to and it has no picked subchannel.
         * In that case, there is no meaningful action that can be taken here. */ }
    resetBackoff() {
    // This LB policy has no backoff to reset
    }
    destroy() {
        this.resetSubchannelList();
    }
    getTypeName() {
        return TYPE_NAME;
    }
}
exports.RoundRobinLoadBalancer = RoundRobinLoadBalancer;
function setup() {
    (0, load_balancer_1.registerLoadBalancerType)(TYPE_NAME, RoundRobinLoadBalancer, RoundRobinLoadBalancingConfig);
}
exports.setup = setup; //# sourceMappingURL=load-balancer-round-robin.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-outlier-detection.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2022 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ var _a;
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.setup = exports.OutlierDetectionLoadBalancer = exports.OutlierDetectionLoadBalancingConfig = void 0;
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
const duration_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/duration.js [app-rsc] (ecmascript)");
const experimental_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/experimental.js [app-rsc] (ecmascript)");
const load_balancer_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer.js [app-rsc] (ecmascript)");
const load_balancer_child_handler_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-child-handler.js [app-rsc] (ecmascript)");
const picker_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/picker.js [app-rsc] (ecmascript)");
const subchannel_address_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-address.js [app-rsc] (ecmascript)");
const subchannel_interface_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/subchannel-interface.js [app-rsc] (ecmascript)");
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const TRACER_NAME = 'outlier_detection';
function trace(text) {
    logging.trace(constants_1.LogVerbosity.DEBUG, TRACER_NAME, text);
}
const TYPE_NAME = 'outlier_detection';
const OUTLIER_DETECTION_ENABLED = ((_a = process.env.GRPC_EXPERIMENTAL_ENABLE_OUTLIER_DETECTION) !== null && _a !== void 0 ? _a : 'true') === 'true';
const defaultSuccessRateEjectionConfig = {
    stdev_factor: 1900,
    enforcement_percentage: 100,
    minimum_hosts: 5,
    request_volume: 100
};
const defaultFailurePercentageEjectionConfig = {
    threshold: 85,
    enforcement_percentage: 100,
    minimum_hosts: 5,
    request_volume: 50
};
function validateFieldType(obj, fieldName, expectedType, objectName) {
    if (fieldName in obj && obj[fieldName] !== undefined && typeof obj[fieldName] !== expectedType) {
        const fullFieldName = objectName ? `${objectName}.${fieldName}` : fieldName;
        throw new Error(`outlier detection config ${fullFieldName} parse error: expected ${expectedType}, got ${typeof obj[fieldName]}`);
    }
}
function validatePositiveDuration(obj, fieldName, objectName) {
    const fullFieldName = objectName ? `${objectName}.${fieldName}` : fieldName;
    if (fieldName in obj && obj[fieldName] !== undefined) {
        if (!(0, duration_1.isDuration)(obj[fieldName])) {
            throw new Error(`outlier detection config ${fullFieldName} parse error: expected Duration, got ${typeof obj[fieldName]}`);
        }
        if (!(obj[fieldName].seconds >= 0 && obj[fieldName].seconds <= 315576000000 && obj[fieldName].nanos >= 0 && obj[fieldName].nanos <= 999999999)) {
            throw new Error(`outlier detection config ${fullFieldName} parse error: values out of range for non-negative Duaration`);
        }
    }
}
function validatePercentage(obj, fieldName, objectName) {
    const fullFieldName = objectName ? `${objectName}.${fieldName}` : fieldName;
    validateFieldType(obj, fieldName, 'number', objectName);
    if (fieldName in obj && obj[fieldName] !== undefined && !(obj[fieldName] >= 0 && obj[fieldName] <= 100)) {
        throw new Error(`outlier detection config ${fullFieldName} parse error: value out of range for percentage (0-100)`);
    }
}
class OutlierDetectionLoadBalancingConfig {
    constructor(intervalMs, baseEjectionTimeMs, maxEjectionTimeMs, maxEjectionPercent, successRateEjection, failurePercentageEjection, childPolicy){
        this.childPolicy = childPolicy;
        if (childPolicy.getLoadBalancerName() === 'pick_first') {
            throw new Error('outlier_detection LB policy cannot have a pick_first child policy');
        }
        this.intervalMs = intervalMs !== null && intervalMs !== void 0 ? intervalMs : 10000;
        this.baseEjectionTimeMs = baseEjectionTimeMs !== null && baseEjectionTimeMs !== void 0 ? baseEjectionTimeMs : 30000;
        this.maxEjectionTimeMs = maxEjectionTimeMs !== null && maxEjectionTimeMs !== void 0 ? maxEjectionTimeMs : 300000;
        this.maxEjectionPercent = maxEjectionPercent !== null && maxEjectionPercent !== void 0 ? maxEjectionPercent : 10;
        this.successRateEjection = successRateEjection ? Object.assign(Object.assign({}, defaultSuccessRateEjectionConfig), successRateEjection) : null;
        this.failurePercentageEjection = failurePercentageEjection ? Object.assign(Object.assign({}, defaultFailurePercentageEjectionConfig), failurePercentageEjection) : null;
    }
    getLoadBalancerName() {
        return TYPE_NAME;
    }
    toJsonObject() {
        var _a, _b;
        return {
            outlier_detection: {
                interval: (0, duration_1.msToDuration)(this.intervalMs),
                base_ejection_time: (0, duration_1.msToDuration)(this.baseEjectionTimeMs),
                max_ejection_time: (0, duration_1.msToDuration)(this.maxEjectionTimeMs),
                max_ejection_percent: this.maxEjectionPercent,
                success_rate_ejection: (_a = this.successRateEjection) !== null && _a !== void 0 ? _a : undefined,
                failure_percentage_ejection: (_b = this.failurePercentageEjection) !== null && _b !== void 0 ? _b : undefined,
                child_policy: [
                    this.childPolicy.toJsonObject()
                ]
            }
        };
    }
    getIntervalMs() {
        return this.intervalMs;
    }
    getBaseEjectionTimeMs() {
        return this.baseEjectionTimeMs;
    }
    getMaxEjectionTimeMs() {
        return this.maxEjectionTimeMs;
    }
    getMaxEjectionPercent() {
        return this.maxEjectionPercent;
    }
    getSuccessRateEjectionConfig() {
        return this.successRateEjection;
    }
    getFailurePercentageEjectionConfig() {
        return this.failurePercentageEjection;
    }
    getChildPolicy() {
        return this.childPolicy;
    }
    static createFromJson(obj) {
        var _a;
        validatePositiveDuration(obj, 'interval');
        validatePositiveDuration(obj, 'base_ejection_time');
        validatePositiveDuration(obj, 'max_ejection_time');
        validatePercentage(obj, 'max_ejection_percent');
        if ('success_rate_ejection' in obj && obj.success_rate_ejection !== undefined) {
            if (typeof obj.success_rate_ejection !== 'object') {
                throw new Error('outlier detection config success_rate_ejection must be an object');
            }
            validateFieldType(obj.success_rate_ejection, 'stdev_factor', 'number', 'success_rate_ejection');
            validatePercentage(obj.success_rate_ejection, 'enforcement_percentage', 'success_rate_ejection');
            validateFieldType(obj.success_rate_ejection, 'minimum_hosts', 'number', 'success_rate_ejection');
            validateFieldType(obj.success_rate_ejection, 'request_volume', 'number', 'success_rate_ejection');
        }
        if ('failure_percentage_ejection' in obj && obj.failure_percentage_ejection !== undefined) {
            if (typeof obj.failure_percentage_ejection !== 'object') {
                throw new Error('outlier detection config failure_percentage_ejection must be an object');
            }
            validatePercentage(obj.failure_percentage_ejection, 'threshold', 'failure_percentage_ejection');
            validatePercentage(obj.failure_percentage_ejection, 'enforcement_percentage', 'failure_percentage_ejection');
            validateFieldType(obj.failure_percentage_ejection, 'minimum_hosts', 'number', 'failure_percentage_ejection');
            validateFieldType(obj.failure_percentage_ejection, 'request_volume', 'number', 'failure_percentage_ejection');
        }
        if (!('child_policy' in obj) || !Array.isArray(obj.child_policy)) {
            throw new Error('outlier detection config child_policy must be an array');
        }
        const childPolicy = (0, load_balancer_1.selectLbConfigFromList)(obj.child_policy);
        if (!childPolicy) {
            throw new Error('outlier detection config child_policy: no valid recognized policy found');
        }
        return new OutlierDetectionLoadBalancingConfig(obj.interval ? (0, duration_1.durationToMs)(obj.interval) : null, obj.base_ejection_time ? (0, duration_1.durationToMs)(obj.base_ejection_time) : null, obj.max_ejection_time ? (0, duration_1.durationToMs)(obj.max_ejection_time) : null, (_a = obj.max_ejection_percent) !== null && _a !== void 0 ? _a : null, obj.success_rate_ejection, obj.failure_percentage_ejection, childPolicy);
    }
}
exports.OutlierDetectionLoadBalancingConfig = OutlierDetectionLoadBalancingConfig;
class OutlierDetectionSubchannelWrapper extends subchannel_interface_1.BaseSubchannelWrapper {
    constructor(childSubchannel, mapEntry){
        super(childSubchannel);
        this.mapEntry = mapEntry;
        this.refCount = 0;
    }
    ref() {
        this.child.ref();
        this.refCount += 1;
    }
    unref() {
        this.child.unref();
        this.refCount -= 1;
        if (this.refCount <= 0) {
            if (this.mapEntry) {
                const index = this.mapEntry.subchannelWrappers.indexOf(this);
                if (index >= 0) {
                    this.mapEntry.subchannelWrappers.splice(index, 1);
                }
            }
        }
    }
    eject() {
        this.setHealthy(false);
    }
    uneject() {
        this.setHealthy(true);
    }
    getMapEntry() {
        return this.mapEntry;
    }
    getWrappedSubchannel() {
        return this.child;
    }
}
function createEmptyBucket() {
    return {
        success: 0,
        failure: 0
    };
}
class CallCounter {
    constructor(){
        this.activeBucket = createEmptyBucket();
        this.inactiveBucket = createEmptyBucket();
    }
    addSuccess() {
        this.activeBucket.success += 1;
    }
    addFailure() {
        this.activeBucket.failure += 1;
    }
    switchBuckets() {
        this.inactiveBucket = this.activeBucket;
        this.activeBucket = createEmptyBucket();
    }
    getLastSuccesses() {
        return this.inactiveBucket.success;
    }
    getLastFailures() {
        return this.inactiveBucket.failure;
    }
}
class OutlierDetectionPicker {
    constructor(wrappedPicker, countCalls){
        this.wrappedPicker = wrappedPicker;
        this.countCalls = countCalls;
    }
    pick(pickArgs) {
        const wrappedPick = this.wrappedPicker.pick(pickArgs);
        if (wrappedPick.pickResultType === picker_1.PickResultType.COMPLETE) {
            const subchannelWrapper = wrappedPick.subchannel;
            const mapEntry = subchannelWrapper.getMapEntry();
            if (mapEntry) {
                let onCallEnded = wrappedPick.onCallEnded;
                if (this.countCalls) {
                    onCallEnded = (statusCode)=>{
                        var _a;
                        if (statusCode === constants_1.Status.OK) {
                            mapEntry.counter.addSuccess();
                        } else {
                            mapEntry.counter.addFailure();
                        }
                        (_a = wrappedPick.onCallEnded) === null || _a === void 0 ? void 0 : _a.call(wrappedPick, statusCode);
                    };
                }
                return Object.assign(Object.assign({}, wrappedPick), {
                    subchannel: subchannelWrapper.getWrappedSubchannel(),
                    onCallEnded: onCallEnded
                });
            } else {
                return Object.assign(Object.assign({}, wrappedPick), {
                    subchannel: subchannelWrapper.getWrappedSubchannel()
                });
            }
        } else {
            return wrappedPick;
        }
    }
}
class OutlierDetectionLoadBalancer {
    constructor(channelControlHelper, credentials, options){
        this.entryMap = new subchannel_address_1.EndpointMap();
        this.latestConfig = null;
        this.timerStartTime = null;
        this.childBalancer = new load_balancer_child_handler_1.ChildLoadBalancerHandler((0, experimental_1.createChildChannelControlHelper)(channelControlHelper, {
            createSubchannel: (subchannelAddress, subchannelArgs, credentialsOverride)=>{
                const originalSubchannel = channelControlHelper.createSubchannel(subchannelAddress, subchannelArgs, credentialsOverride);
                const mapEntry = this.entryMap.getForSubchannelAddress(subchannelAddress);
                const subchannelWrapper = new OutlierDetectionSubchannelWrapper(originalSubchannel, mapEntry);
                if ((mapEntry === null || mapEntry === void 0 ? void 0 : mapEntry.currentEjectionTimestamp) !== null) {
                    // If the address is ejected, propagate that to the new subchannel wrapper
                    subchannelWrapper.eject();
                }
                mapEntry === null || mapEntry === void 0 ? void 0 : mapEntry.subchannelWrappers.push(subchannelWrapper);
                return subchannelWrapper;
            },
            updateState: (connectivityState, picker)=>{
                if (connectivityState === connectivity_state_1.ConnectivityState.READY) {
                    channelControlHelper.updateState(connectivityState, new OutlierDetectionPicker(picker, this.isCountingEnabled()));
                } else {
                    channelControlHelper.updateState(connectivityState, picker);
                }
            }
        }), credentials, options);
        this.ejectionTimer = setInterval(()=>{}, 0);
        clearInterval(this.ejectionTimer);
    }
    isCountingEnabled() {
        return this.latestConfig !== null && (this.latestConfig.getSuccessRateEjectionConfig() !== null || this.latestConfig.getFailurePercentageEjectionConfig() !== null);
    }
    getCurrentEjectionPercent() {
        let ejectionCount = 0;
        for (const mapEntry of this.entryMap.values()){
            if (mapEntry.currentEjectionTimestamp !== null) {
                ejectionCount += 1;
            }
        }
        return ejectionCount * 100 / this.entryMap.size;
    }
    runSuccessRateCheck(ejectionTimestamp) {
        if (!this.latestConfig) {
            return;
        }
        const successRateConfig = this.latestConfig.getSuccessRateEjectionConfig();
        if (!successRateConfig) {
            return;
        }
        trace('Running success rate check');
        // Step 1
        const targetRequestVolume = successRateConfig.request_volume;
        let addresesWithTargetVolume = 0;
        const successRates = [];
        for (const [endpoint, mapEntry] of this.entryMap.entries()){
            const successes = mapEntry.counter.getLastSuccesses();
            const failures = mapEntry.counter.getLastFailures();
            trace('Stats for ' + (0, subchannel_address_1.endpointToString)(endpoint) + ': successes=' + successes + ' failures=' + failures + ' targetRequestVolume=' + targetRequestVolume);
            if (successes + failures >= targetRequestVolume) {
                addresesWithTargetVolume += 1;
                successRates.push(successes / (successes + failures));
            }
        }
        trace('Found ' + addresesWithTargetVolume + ' success rate candidates; currentEjectionPercent=' + this.getCurrentEjectionPercent() + ' successRates=[' + successRates + ']');
        if (addresesWithTargetVolume < successRateConfig.minimum_hosts) {
            return;
        }
        // Step 2
        const successRateMean = successRates.reduce((a, b)=>a + b) / successRates.length;
        let successRateDeviationSum = 0;
        for (const rate of successRates){
            const deviation = rate - successRateMean;
            successRateDeviationSum += deviation * deviation;
        }
        const successRateVariance = successRateDeviationSum / successRates.length;
        const successRateStdev = Math.sqrt(successRateVariance);
        const ejectionThreshold = successRateMean - successRateStdev * (successRateConfig.stdev_factor / 1000);
        trace('stdev=' + successRateStdev + ' ejectionThreshold=' + ejectionThreshold);
        // Step 3
        for (const [address, mapEntry] of this.entryMap.entries()){
            // Step 3.i
            if (this.getCurrentEjectionPercent() >= this.latestConfig.getMaxEjectionPercent()) {
                break;
            }
            // Step 3.ii
            const successes = mapEntry.counter.getLastSuccesses();
            const failures = mapEntry.counter.getLastFailures();
            if (successes + failures < targetRequestVolume) {
                continue;
            }
            // Step 3.iii
            const successRate = successes / (successes + failures);
            trace('Checking candidate ' + address + ' successRate=' + successRate);
            if (successRate < ejectionThreshold) {
                const randomNumber = Math.random() * 100;
                trace('Candidate ' + address + ' randomNumber=' + randomNumber + ' enforcement_percentage=' + successRateConfig.enforcement_percentage);
                if (randomNumber < successRateConfig.enforcement_percentage) {
                    trace('Ejecting candidate ' + address);
                    this.eject(mapEntry, ejectionTimestamp);
                }
            }
        }
    }
    runFailurePercentageCheck(ejectionTimestamp) {
        if (!this.latestConfig) {
            return;
        }
        const failurePercentageConfig = this.latestConfig.getFailurePercentageEjectionConfig();
        if (!failurePercentageConfig) {
            return;
        }
        trace('Running failure percentage check. threshold=' + failurePercentageConfig.threshold + ' request volume threshold=' + failurePercentageConfig.request_volume);
        // Step 1
        let addressesWithTargetVolume = 0;
        for (const mapEntry of this.entryMap.values()){
            const successes = mapEntry.counter.getLastSuccesses();
            const failures = mapEntry.counter.getLastFailures();
            if (successes + failures >= failurePercentageConfig.request_volume) {
                addressesWithTargetVolume += 1;
            }
        }
        if (addressesWithTargetVolume < failurePercentageConfig.minimum_hosts) {
            return;
        }
        // Step 2
        for (const [address, mapEntry] of this.entryMap.entries()){
            // Step 2.i
            if (this.getCurrentEjectionPercent() >= this.latestConfig.getMaxEjectionPercent()) {
                break;
            }
            // Step 2.ii
            const successes = mapEntry.counter.getLastSuccesses();
            const failures = mapEntry.counter.getLastFailures();
            trace('Candidate successes=' + successes + ' failures=' + failures);
            if (successes + failures < failurePercentageConfig.request_volume) {
                continue;
            }
            // Step 2.iii
            const failurePercentage = failures * 100 / (failures + successes);
            if (failurePercentage > failurePercentageConfig.threshold) {
                const randomNumber = Math.random() * 100;
                trace('Candidate ' + address + ' randomNumber=' + randomNumber + ' enforcement_percentage=' + failurePercentageConfig.enforcement_percentage);
                if (randomNumber < failurePercentageConfig.enforcement_percentage) {
                    trace('Ejecting candidate ' + address);
                    this.eject(mapEntry, ejectionTimestamp);
                }
            }
        }
    }
    eject(mapEntry, ejectionTimestamp) {
        mapEntry.currentEjectionTimestamp = new Date();
        mapEntry.ejectionTimeMultiplier += 1;
        for (const subchannelWrapper of mapEntry.subchannelWrappers){
            subchannelWrapper.eject();
        }
    }
    uneject(mapEntry) {
        mapEntry.currentEjectionTimestamp = null;
        for (const subchannelWrapper of mapEntry.subchannelWrappers){
            subchannelWrapper.uneject();
        }
    }
    switchAllBuckets() {
        for (const mapEntry of this.entryMap.values()){
            mapEntry.counter.switchBuckets();
        }
    }
    startTimer(delayMs) {
        var _a, _b;
        this.ejectionTimer = setTimeout(()=>this.runChecks(), delayMs);
        (_b = (_a = this.ejectionTimer).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    runChecks() {
        const ejectionTimestamp = new Date();
        trace('Ejection timer running');
        this.switchAllBuckets();
        if (!this.latestConfig) {
            return;
        }
        this.timerStartTime = ejectionTimestamp;
        this.startTimer(this.latestConfig.getIntervalMs());
        this.runSuccessRateCheck(ejectionTimestamp);
        this.runFailurePercentageCheck(ejectionTimestamp);
        for (const [address, mapEntry] of this.entryMap.entries()){
            if (mapEntry.currentEjectionTimestamp === null) {
                if (mapEntry.ejectionTimeMultiplier > 0) {
                    mapEntry.ejectionTimeMultiplier -= 1;
                }
            } else {
                const baseEjectionTimeMs = this.latestConfig.getBaseEjectionTimeMs();
                const maxEjectionTimeMs = this.latestConfig.getMaxEjectionTimeMs();
                const returnTime = new Date(mapEntry.currentEjectionTimestamp.getTime());
                returnTime.setMilliseconds(returnTime.getMilliseconds() + Math.min(baseEjectionTimeMs * mapEntry.ejectionTimeMultiplier, Math.max(baseEjectionTimeMs, maxEjectionTimeMs)));
                if (returnTime < new Date()) {
                    trace('Unejecting ' + address);
                    this.uneject(mapEntry);
                }
            }
        }
    }
    updateAddressList(endpointList, lbConfig, attributes) {
        if (!(lbConfig instanceof OutlierDetectionLoadBalancingConfig)) {
            return;
        }
        for (const endpoint of endpointList){
            if (!this.entryMap.has(endpoint)) {
                trace('Adding map entry for ' + (0, subchannel_address_1.endpointToString)(endpoint));
                this.entryMap.set(endpoint, {
                    counter: new CallCounter(),
                    currentEjectionTimestamp: null,
                    ejectionTimeMultiplier: 0,
                    subchannelWrappers: []
                });
            }
        }
        this.entryMap.deleteMissing(endpointList);
        const childPolicy = lbConfig.getChildPolicy();
        this.childBalancer.updateAddressList(endpointList, childPolicy, attributes);
        if (lbConfig.getSuccessRateEjectionConfig() || lbConfig.getFailurePercentageEjectionConfig()) {
            if (this.timerStartTime) {
                trace('Previous timer existed. Replacing timer');
                clearTimeout(this.ejectionTimer);
                const remainingDelay = lbConfig.getIntervalMs() - (new Date().getTime() - this.timerStartTime.getTime());
                this.startTimer(remainingDelay);
            } else {
                trace('Starting new timer');
                this.timerStartTime = new Date();
                this.startTimer(lbConfig.getIntervalMs());
                this.switchAllBuckets();
            }
        } else {
            trace('Counting disabled. Cancelling timer.');
            this.timerStartTime = null;
            clearTimeout(this.ejectionTimer);
            for (const mapEntry of this.entryMap.values()){
                this.uneject(mapEntry);
                mapEntry.ejectionTimeMultiplier = 0;
            }
        }
        this.latestConfig = lbConfig;
    }
    exitIdle() {
        this.childBalancer.exitIdle();
    }
    resetBackoff() {
        this.childBalancer.resetBackoff();
    }
    destroy() {
        clearTimeout(this.ejectionTimer);
        this.childBalancer.destroy();
    }
    getTypeName() {
        return TYPE_NAME;
    }
}
exports.OutlierDetectionLoadBalancer = OutlierDetectionLoadBalancer;
function setup() {
    if (OUTLIER_DETECTION_ENABLED) {
        (0, experimental_1.registerLoadBalancerType)(TYPE_NAME, OutlierDetectionLoadBalancer, OutlierDetectionLoadBalancingConfig);
    }
}
exports.setup = setup; //# sourceMappingURL=load-balancer-outlier-detection.js.map
}}),
"[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/index.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/*
 * Copyright 2019 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.experimental = exports.ServerInterceptingCall = exports.ResponderBuilder = exports.ServerListenerBuilder = exports.addAdminServicesToServer = exports.getChannelzHandlers = exports.getChannelzServiceDefinition = exports.InterceptorConfigurationError = exports.InterceptingCall = exports.RequesterBuilder = exports.ListenerBuilder = exports.StatusBuilder = exports.getClientChannel = exports.ServerCredentials = exports.Server = exports.setLogVerbosity = exports.setLogger = exports.load = exports.loadObject = exports.CallCredentials = exports.ChannelCredentials = exports.waitForClientReady = exports.closeClient = exports.Channel = exports.makeGenericClientConstructor = exports.makeClientConstructor = exports.loadPackageDefinition = exports.Client = exports.compressionAlgorithms = exports.propagate = exports.connectivityState = exports.status = exports.logVerbosity = exports.Metadata = exports.credentials = void 0;
const call_credentials_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/call-credentials.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "CallCredentials", {
    enumerable: true,
    get: function() {
        return call_credentials_1.CallCredentials;
    }
});
const channel_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channel.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Channel", {
    enumerable: true,
    get: function() {
        return channel_1.ChannelImplementation;
    }
});
const compression_algorithms_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/compression-algorithms.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "compressionAlgorithms", {
    enumerable: true,
    get: function() {
        return compression_algorithms_1.CompressionAlgorithms;
    }
});
const connectivity_state_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/connectivity-state.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "connectivityState", {
    enumerable: true,
    get: function() {
        return connectivity_state_1.ConnectivityState;
    }
});
const channel_credentials_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channel-credentials.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ChannelCredentials", {
    enumerable: true,
    get: function() {
        return channel_credentials_1.ChannelCredentials;
    }
});
const client_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/client.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Client", {
    enumerable: true,
    get: function() {
        return client_1.Client;
    }
});
const constants_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/constants.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "logVerbosity", {
    enumerable: true,
    get: function() {
        return constants_1.LogVerbosity;
    }
});
Object.defineProperty(exports, "status", {
    enumerable: true,
    get: function() {
        return constants_1.Status;
    }
});
Object.defineProperty(exports, "propagate", {
    enumerable: true,
    get: function() {
        return constants_1.Propagate;
    }
});
const logging = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/logging.js [app-rsc] (ecmascript)");
const make_client_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/make-client.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "loadPackageDefinition", {
    enumerable: true,
    get: function() {
        return make_client_1.loadPackageDefinition;
    }
});
Object.defineProperty(exports, "makeClientConstructor", {
    enumerable: true,
    get: function() {
        return make_client_1.makeClientConstructor;
    }
});
Object.defineProperty(exports, "makeGenericClientConstructor", {
    enumerable: true,
    get: function() {
        return make_client_1.makeClientConstructor;
    }
});
const metadata_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/metadata.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Metadata", {
    enumerable: true,
    get: function() {
        return metadata_1.Metadata;
    }
});
const server_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "Server", {
    enumerable: true,
    get: function() {
        return server_1.Server;
    }
});
const server_credentials_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server-credentials.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ServerCredentials", {
    enumerable: true,
    get: function() {
        return server_credentials_1.ServerCredentials;
    }
});
const status_builder_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/status-builder.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "StatusBuilder", {
    enumerable: true,
    get: function() {
        return status_builder_1.StatusBuilder;
    }
});
/**** Client Credentials ****/ // Using assign only copies enumerable properties, which is what we want
exports.credentials = {
    /**
     * Combine a ChannelCredentials with any number of CallCredentials into a
     * single ChannelCredentials object.
     * @param channelCredentials The ChannelCredentials object.
     * @param callCredentials Any number of CallCredentials objects.
     * @return The resulting ChannelCredentials object.
     */ combineChannelCredentials: (channelCredentials, ...callCredentials)=>{
        return callCredentials.reduce((acc, other)=>acc.compose(other), channelCredentials);
    },
    /**
     * Combine any number of CallCredentials into a single CallCredentials
     * object.
     * @param first The first CallCredentials object.
     * @param additional Any number of additional CallCredentials objects.
     * @return The resulting CallCredentials object.
     */ combineCallCredentials: (first, ...additional)=>{
        return additional.reduce((acc, other)=>acc.compose(other), first);
    },
    // from channel-credentials.ts
    createInsecure: channel_credentials_1.ChannelCredentials.createInsecure,
    createSsl: channel_credentials_1.ChannelCredentials.createSsl,
    createFromSecureContext: channel_credentials_1.ChannelCredentials.createFromSecureContext,
    // from call-credentials.ts
    createFromMetadataGenerator: call_credentials_1.CallCredentials.createFromMetadataGenerator,
    createFromGoogleCredential: call_credentials_1.CallCredentials.createFromGoogleCredential,
    createEmpty: call_credentials_1.CallCredentials.createEmpty
};
/**
 * Close a Client object.
 * @param client The client to close.
 */ const closeClient = (client)=>client.close();
exports.closeClient = closeClient;
const waitForClientReady = (client, deadline, callback)=>client.waitForReady(deadline, callback);
exports.waitForClientReady = waitForClientReady;
/* eslint-enable @typescript-eslint/no-explicit-any */ /**** Unimplemented function stubs ****/ /* eslint-disable @typescript-eslint/no-explicit-any */ const loadObject = (value, options)=>{
    throw new Error('Not available in this library. Use @grpc/proto-loader and loadPackageDefinition instead');
};
exports.loadObject = loadObject;
const load = (filename, format, options)=>{
    throw new Error('Not available in this library. Use @grpc/proto-loader and loadPackageDefinition instead');
};
exports.load = load;
const setLogger = (logger)=>{
    logging.setLogger(logger);
};
exports.setLogger = setLogger;
const setLogVerbosity = (verbosity)=>{
    logging.setLoggerVerbosity(verbosity);
};
exports.setLogVerbosity = setLogVerbosity;
const getClientChannel = (client)=>{
    return client_1.Client.prototype.getChannel.call(client);
};
exports.getClientChannel = getClientChannel;
var client_interceptors_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/client-interceptors.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ListenerBuilder", {
    enumerable: true,
    get: function() {
        return client_interceptors_1.ListenerBuilder;
    }
});
Object.defineProperty(exports, "RequesterBuilder", {
    enumerable: true,
    get: function() {
        return client_interceptors_1.RequesterBuilder;
    }
});
Object.defineProperty(exports, "InterceptingCall", {
    enumerable: true,
    get: function() {
        return client_interceptors_1.InterceptingCall;
    }
});
Object.defineProperty(exports, "InterceptorConfigurationError", {
    enumerable: true,
    get: function() {
        return client_interceptors_1.InterceptorConfigurationError;
    }
});
var channelz_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channelz.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "getChannelzServiceDefinition", {
    enumerable: true,
    get: function() {
        return channelz_1.getChannelzServiceDefinition;
    }
});
Object.defineProperty(exports, "getChannelzHandlers", {
    enumerable: true,
    get: function() {
        return channelz_1.getChannelzHandlers;
    }
});
var admin_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/admin.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "addAdminServicesToServer", {
    enumerable: true,
    get: function() {
        return admin_1.addAdminServicesToServer;
    }
});
var server_interceptors_1 = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/server-interceptors.js [app-rsc] (ecmascript)");
Object.defineProperty(exports, "ServerListenerBuilder", {
    enumerable: true,
    get: function() {
        return server_interceptors_1.ServerListenerBuilder;
    }
});
Object.defineProperty(exports, "ResponderBuilder", {
    enumerable: true,
    get: function() {
        return server_interceptors_1.ResponderBuilder;
    }
});
Object.defineProperty(exports, "ServerInterceptingCall", {
    enumerable: true,
    get: function() {
        return server_interceptors_1.ServerInterceptingCall;
    }
});
const experimental = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/experimental.js [app-rsc] (ecmascript)");
exports.experimental = experimental;
const resolver_dns = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver-dns.js [app-rsc] (ecmascript)");
const resolver_uds = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver-uds.js [app-rsc] (ecmascript)");
const resolver_ip = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/resolver-ip.js [app-rsc] (ecmascript)");
const load_balancer_pick_first = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-pick-first.js [app-rsc] (ecmascript)");
const load_balancer_round_robin = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-round-robin.js [app-rsc] (ecmascript)");
const load_balancer_outlier_detection = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/load-balancer-outlier-detection.js [app-rsc] (ecmascript)");
const channelz = __turbopack_require__("[project]/node_modules/.pnpm/@grpc+grpc-js@1.12.4/node_modules/@grpc/grpc-js/build/src/channelz.js [app-rsc] (ecmascript)");
(()=>{
    resolver_dns.setup();
    resolver_uds.setup();
    resolver_ip.setup();
    load_balancer_pick_first.setup();
    load_balancer_round_robin.setup();
    load_balancer_outlier_detection.setup();
    channelz.setup();
})(); //# sourceMappingURL=index.js.map
}}),

};

//# sourceMappingURL=7423a_%40grpc_grpc-js_afba1b._.js.map