module.exports = {

"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/MetricData.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /**
 * The aggregated point data type.
 */ __turbopack_esm__({
    "DataPointType": (()=>DataPointType)
});
var DataPointType;
(function(DataPointType) {
    /**
     * A histogram data point contains a histogram statistics of collected
     * values with a list of explicit bucket boundaries and statistics such
     * as min, max, count, and sum of all collected values.
     */ DataPointType[DataPointType["HISTOGRAM"] = 0] = "HISTOGRAM";
    /**
     * An exponential histogram data point contains a histogram statistics of
     * collected values where bucket boundaries are automatically calculated
     * using an exponential function, and statistics such as min, max, count,
     * and sum of all collected values.
     */ DataPointType[DataPointType["EXPONENTIAL_HISTOGRAM"] = 1] = "EXPONENTIAL_HISTOGRAM";
    /**
     * A gauge metric data point has only a single numeric value.
     */ DataPointType[DataPointType["GAUGE"] = 2] = "GAUGE";
    /**
     * A sum metric data point has a single numeric value and a
     * monotonicity-indicator.
     */ DataPointType[DataPointType["SUM"] = 3] = "SUM";
})(DataPointType || (DataPointType = {})); //# sourceMappingURL=MetricData.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/AggregationTemporality.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /**
 * AggregationTemporality indicates the way additive quantities are expressed.
 */ __turbopack_esm__({
    "AggregationTemporality": (()=>AggregationTemporality)
});
var AggregationTemporality;
(function(AggregationTemporality) {
    AggregationTemporality[AggregationTemporality["DELTA"] = 0] = "DELTA";
    AggregationTemporality[AggregationTemporality["CUMULATIVE"] = 1] = "CUMULATIVE";
})(AggregationTemporality || (AggregationTemporality = {})); //# sourceMappingURL=AggregationTemporality.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/index.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({});
;
;
;
;
;
;
;
;
;
;
;
 //# sourceMappingURL=index.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/index.js [app-rsc] (ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/types.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /** The kind of aggregator. */ __turbopack_esm__({
    "AggregatorKind": (()=>AggregatorKind)
});
var AggregatorKind;
(function(AggregatorKind) {
    AggregatorKind[AggregatorKind["DROP"] = 0] = "DROP";
    AggregatorKind[AggregatorKind["SUM"] = 1] = "SUM";
    AggregatorKind[AggregatorKind["LAST_VALUE"] = 2] = "LAST_VALUE";
    AggregatorKind[AggregatorKind["HISTOGRAM"] = 3] = "HISTOGRAM";
    AggregatorKind[AggregatorKind["EXPONENTIAL_HISTOGRAM"] = 4] = "EXPONENTIAL_HISTOGRAM";
})(AggregatorKind || (AggregatorKind = {})); //# sourceMappingURL=types.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/Drop.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "DropAggregator": (()=>DropAggregator)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/types.js [app-rsc] (ecmascript)");
;
/** Basic aggregator for None which keeps no recorded value. */ var DropAggregator = function() {
    function DropAggregator() {
        this.kind = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AggregatorKind"].DROP;
    }
    DropAggregator.prototype.createAccumulation = function() {
        return undefined;
    };
    DropAggregator.prototype.merge = function(_previous, _delta) {
        return undefined;
    };
    DropAggregator.prototype.diff = function(_previous, _current) {
        return undefined;
    };
    DropAggregator.prototype.toMetricData = function(_descriptor, _aggregationTemporality, _accumulationByAttributes, _endTime) {
        return undefined;
    };
    return DropAggregator;
}();
;
 //# sourceMappingURL=Drop.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/utils.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "FlatMap": (()=>FlatMap),
    "PromiseAllSettled": (()=>PromiseAllSettled),
    "TimeoutError": (()=>TimeoutError),
    "binarySearchUB": (()=>binarySearchUB),
    "callWithTimeout": (()=>callWithTimeout),
    "equalsCaseInsensitive": (()=>equalsCaseInsensitive),
    "hashAttributes": (()=>hashAttributes),
    "instrumentationScopeId": (()=>instrumentationScopeId),
    "isNotNullish": (()=>isNotNullish),
    "isPromiseAllSettledRejectionResult": (()=>isPromiseAllSettledRejectionResult),
    "setEquals": (()=>setEquals)
});
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
var __awaiter = this && this.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = this && this.__generator || function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, f, y, t, g;
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    "TURBOPACK unreachable";
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
};
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
var __spreadArray = this && this.__spreadArray || function(to, from, pack) {
    if (pack || arguments.length === 2) for(var i = 0, l = from.length, ar; i < l; i++){
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __values = this && this.__values || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
function isNotNullish(item) {
    return item !== undefined && item !== null;
}
function hashAttributes(attributes) {
    var keys = Object.keys(attributes);
    if (keys.length === 0) return '';
    // Return a string that is stable on key orders.
    keys = keys.sort();
    return JSON.stringify(keys.map(function(key) {
        return [
            key,
            attributes[key]
        ];
    }));
}
function instrumentationScopeId(instrumentationScope) {
    var _a, _b;
    return instrumentationScope.name + ":" + ((_a = instrumentationScope.version) !== null && _a !== void 0 ? _a : '') + ":" + ((_b = instrumentationScope.schemaUrl) !== null && _b !== void 0 ? _b : '');
}
/**
 * Error that is thrown on timeouts.
 */ var TimeoutError = function(_super) {
    __extends(TimeoutError, _super);
    function TimeoutError(message) {
        var _this = _super.call(this, message) || this;
        // manually adjust prototype to retain `instanceof` functionality when targeting ES5, see:
        // https://github.com/Microsoft/TypeScript-wiki/blob/main/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(_this, TimeoutError.prototype);
        return _this;
    }
    return TimeoutError;
}(Error);
;
function callWithTimeout(promise, timeout) {
    var timeoutHandle;
    var timeoutPromise = new Promise(function timeoutFunction(_resolve, reject) {
        timeoutHandle = setTimeout(function timeoutHandler() {
            reject(new TimeoutError('Operation timed out.'));
        }, timeout);
    });
    return Promise.race([
        promise,
        timeoutPromise
    ]).then(function(result) {
        clearTimeout(timeoutHandle);
        return result;
    }, function(reason) {
        clearTimeout(timeoutHandle);
        throw reason;
    });
}
function PromiseAllSettled(promises) {
    return __awaiter(this, void 0, void 0, function() {
        var _this = this;
        return __generator(this, function(_a) {
            return [
                2 /*return*/ ,
                Promise.all(promises.map(function(p) {
                    return __awaiter(_this, void 0, void 0, function() {
                        var ret, e_1;
                        return __generator(this, function(_a) {
                            switch(_a.label){
                                case 0:
                                    _a.trys.push([
                                        0,
                                        2,
                                        ,
                                        3
                                    ]);
                                    return [
                                        4 /*yield*/ ,
                                        p
                                    ];
                                case 1:
                                    ret = _a.sent();
                                    return [
                                        2 /*return*/ ,
                                        {
                                            status: 'fulfilled',
                                            value: ret
                                        }
                                    ];
                                case 2:
                                    e_1 = _a.sent();
                                    return [
                                        2 /*return*/ ,
                                        {
                                            status: 'rejected',
                                            reason: e_1
                                        }
                                    ];
                                case 3:
                                    return [
                                        2 /*return*/ 
                                    ];
                            }
                        });
                    });
                }))
            ];
        });
    });
}
function isPromiseAllSettledRejectionResult(it) {
    return it.status === 'rejected';
}
function FlatMap(arr, fn) {
    var result = [];
    arr.forEach(function(it) {
        result.push.apply(result, __spreadArray([], __read(fn(it)), false));
    });
    return result;
}
function setEquals(lhs, rhs) {
    var e_2, _a;
    if (lhs.size !== rhs.size) {
        return false;
    }
    try {
        for(var lhs_1 = __values(lhs), lhs_1_1 = lhs_1.next(); !lhs_1_1.done; lhs_1_1 = lhs_1.next()){
            var item = lhs_1_1.value;
            if (!rhs.has(item)) {
                return false;
            }
        }
    } catch (e_2_1) {
        e_2 = {
            error: e_2_1
        };
    } finally{
        try {
            if (lhs_1_1 && !lhs_1_1.done && (_a = lhs_1.return)) _a.call(lhs_1);
        } finally{
            if (e_2) throw e_2.error;
        }
    }
    return true;
}
function binarySearchUB(arr, value) {
    var lo = 0;
    var hi = arr.length - 1;
    var ret = arr.length;
    while(hi >= lo){
        var mid = lo + Math.trunc((hi - lo) / 2);
        if (arr[mid] < value) {
            lo = mid + 1;
        } else {
            ret = mid;
            hi = mid - 1;
        }
    }
    return ret;
}
function equalsCaseInsensitive(lhs, rhs) {
    return lhs.toLowerCase() === rhs.toLowerCase();
} //# sourceMappingURL=utils.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/InstrumentDescriptor.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "InstrumentType": (()=>InstrumentType),
    "createInstrumentDescriptor": (()=>createInstrumentDescriptor),
    "createInstrumentDescriptorWithView": (()=>createInstrumentDescriptorWithView),
    "isDescriptorCompatibleWith": (()=>isDescriptorCompatibleWith),
    "isValidName": (()=>isValidName)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/utils.js [app-rsc] (ecmascript)");
;
;
var InstrumentType;
(function(InstrumentType) {
    InstrumentType["COUNTER"] = "COUNTER";
    InstrumentType["GAUGE"] = "GAUGE";
    InstrumentType["HISTOGRAM"] = "HISTOGRAM";
    InstrumentType["UP_DOWN_COUNTER"] = "UP_DOWN_COUNTER";
    InstrumentType["OBSERVABLE_COUNTER"] = "OBSERVABLE_COUNTER";
    InstrumentType["OBSERVABLE_GAUGE"] = "OBSERVABLE_GAUGE";
    InstrumentType["OBSERVABLE_UP_DOWN_COUNTER"] = "OBSERVABLE_UP_DOWN_COUNTER";
})(InstrumentType || (InstrumentType = {}));
function createInstrumentDescriptor(name, type, options) {
    var _a, _b, _c, _d;
    if (!isValidName(name)) {
        __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Invalid metric name: \"" + name + "\". The metric name should be a ASCII string with a length no greater than 255 characters.");
    }
    return {
        name: name,
        type: type,
        description: (_a = options === null || options === void 0 ? void 0 : options.description) !== null && _a !== void 0 ? _a : '',
        unit: (_b = options === null || options === void 0 ? void 0 : options.unit) !== null && _b !== void 0 ? _b : '',
        valueType: (_c = options === null || options === void 0 ? void 0 : options.valueType) !== null && _c !== void 0 ? _c : __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["ValueType"].DOUBLE,
        advice: (_d = options === null || options === void 0 ? void 0 : options.advice) !== null && _d !== void 0 ? _d : {}
    };
}
function createInstrumentDescriptorWithView(view, instrument) {
    var _a, _b;
    return {
        name: (_a = view.name) !== null && _a !== void 0 ? _a : instrument.name,
        description: (_b = view.description) !== null && _b !== void 0 ? _b : instrument.description,
        type: instrument.type,
        unit: instrument.unit,
        valueType: instrument.valueType,
        advice: instrument.advice
    };
}
function isDescriptorCompatibleWith(descriptor, otherDescriptor) {
    // Names are case-insensitive strings.
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["equalsCaseInsensitive"])(descriptor.name, otherDescriptor.name) && descriptor.unit === otherDescriptor.unit && descriptor.type === otherDescriptor.type && descriptor.valueType === otherDescriptor.valueType;
}
// ASCII string with a length no greater than 255 characters.
// NB: the first character counted separately from the rest.
var NAME_REGEXP = /^[a-z][a-z0-9_.\-/]{0,254}$/i;
function isValidName(name) {
    return name.match(NAME_REGEXP) != null;
} //# sourceMappingURL=InstrumentDescriptor.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/Sum.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "SumAccumulation": (()=>SumAccumulation),
    "SumAggregator": (()=>SumAggregator)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/MetricData.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/types.js [app-rsc] (ecmascript)");
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
;
;
var SumAccumulation = function() {
    function SumAccumulation(startTime, monotonic, _current, reset) {
        if (_current === void 0) {
            _current = 0;
        }
        if (reset === void 0) {
            reset = false;
        }
        this.startTime = startTime;
        this.monotonic = monotonic;
        this._current = _current;
        this.reset = reset;
    }
    SumAccumulation.prototype.record = function(value) {
        if (this.monotonic && value < 0) {
            return;
        }
        this._current += value;
    };
    SumAccumulation.prototype.setStartTime = function(startTime) {
        this.startTime = startTime;
    };
    SumAccumulation.prototype.toPointValue = function() {
        return this._current;
    };
    return SumAccumulation;
}();
;
/** Basic aggregator which calculates a Sum from individual measurements. */ var SumAggregator = function() {
    function SumAggregator(monotonic) {
        this.monotonic = monotonic;
        this.kind = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AggregatorKind"].SUM;
    }
    SumAggregator.prototype.createAccumulation = function(startTime) {
        return new SumAccumulation(startTime, this.monotonic);
    };
    /**
     * Returns the result of the merge of the given accumulations.
     */ SumAggregator.prototype.merge = function(previous, delta) {
        var prevPv = previous.toPointValue();
        var deltaPv = delta.toPointValue();
        if (delta.reset) {
            return new SumAccumulation(delta.startTime, this.monotonic, deltaPv, delta.reset);
        }
        return new SumAccumulation(previous.startTime, this.monotonic, prevPv + deltaPv);
    };
    /**
     * Returns a new DELTA aggregation by comparing two cumulative measurements.
     */ SumAggregator.prototype.diff = function(previous, current) {
        var prevPv = previous.toPointValue();
        var currPv = current.toPointValue();
        /**
         * If the SumAggregator is a monotonic one and the previous point value is
         * greater than the current one, a reset is deemed to be happened.
         * Return the current point value to prevent the value from been reset.
         */ if (this.monotonic && prevPv > currPv) {
            return new SumAccumulation(current.startTime, this.monotonic, currPv, true);
        }
        return new SumAccumulation(current.startTime, this.monotonic, currPv - prevPv);
    };
    SumAggregator.prototype.toMetricData = function(descriptor, aggregationTemporality, accumulationByAttributes, endTime) {
        return {
            descriptor: descriptor,
            aggregationTemporality: aggregationTemporality,
            dataPointType: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DataPointType"].SUM,
            dataPoints: accumulationByAttributes.map(function(_a) {
                var _b = __read(_a, 2), attributes = _b[0], accumulation = _b[1];
                return {
                    attributes: attributes,
                    startTime: accumulation.startTime,
                    endTime: endTime,
                    value: accumulation.toPointValue()
                };
            }),
            isMonotonic: this.monotonic
        };
    };
    return SumAggregator;
}();
;
 //# sourceMappingURL=Sum.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/LastValue.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "LastValueAccumulation": (()=>LastValueAccumulation),
    "LastValueAggregator": (()=>LastValueAggregator)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/time.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/MetricData.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/types.js [app-rsc] (ecmascript)");
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
;
;
;
var LastValueAccumulation = function() {
    function LastValueAccumulation(startTime, _current, sampleTime) {
        if (_current === void 0) {
            _current = 0;
        }
        if (sampleTime === void 0) {
            sampleTime = [
                0,
                0
            ];
        }
        this.startTime = startTime;
        this._current = _current;
        this.sampleTime = sampleTime;
    }
    LastValueAccumulation.prototype.record = function(value) {
        this._current = value;
        this.sampleTime = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["millisToHrTime"])(Date.now());
    };
    LastValueAccumulation.prototype.setStartTime = function(startTime) {
        this.startTime = startTime;
    };
    LastValueAccumulation.prototype.toPointValue = function() {
        return this._current;
    };
    return LastValueAccumulation;
}();
;
/** Basic aggregator which calculates a LastValue from individual measurements. */ var LastValueAggregator = function() {
    function LastValueAggregator() {
        this.kind = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AggregatorKind"].LAST_VALUE;
    }
    LastValueAggregator.prototype.createAccumulation = function(startTime) {
        return new LastValueAccumulation(startTime);
    };
    /**
     * Returns the result of the merge of the given accumulations.
     *
     * Return the newly captured (delta) accumulation for LastValueAggregator.
     */ LastValueAggregator.prototype.merge = function(previous, delta) {
        // nanoseconds may lose precisions.
        var latestAccumulation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeToMicroseconds"])(delta.sampleTime) >= (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeToMicroseconds"])(previous.sampleTime) ? delta : previous;
        return new LastValueAccumulation(previous.startTime, latestAccumulation.toPointValue(), latestAccumulation.sampleTime);
    };
    /**
     * Returns a new DELTA aggregation by comparing two cumulative measurements.
     *
     * A delta aggregation is not meaningful to LastValueAggregator, just return
     * the newly captured (delta) accumulation for LastValueAggregator.
     */ LastValueAggregator.prototype.diff = function(previous, current) {
        // nanoseconds may lose precisions.
        var latestAccumulation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeToMicroseconds"])(current.sampleTime) >= (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hrTimeToMicroseconds"])(previous.sampleTime) ? current : previous;
        return new LastValueAccumulation(current.startTime, latestAccumulation.toPointValue(), latestAccumulation.sampleTime);
    };
    LastValueAggregator.prototype.toMetricData = function(descriptor, aggregationTemporality, accumulationByAttributes, endTime) {
        return {
            descriptor: descriptor,
            aggregationTemporality: aggregationTemporality,
            dataPointType: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DataPointType"].GAUGE,
            dataPoints: accumulationByAttributes.map(function(_a) {
                var _b = __read(_a, 2), attributes = _b[0], accumulation = _b[1];
                return {
                    attributes: attributes,
                    startTime: accumulation.startTime,
                    endTime: endTime,
                    value: accumulation.toPointValue()
                };
            })
        };
    };
    return LastValueAggregator;
}();
;
 //# sourceMappingURL=LastValue.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/Histogram.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "HistogramAccumulation": (()=>HistogramAccumulation),
    "HistogramAggregator": (()=>HistogramAggregator)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/MetricData.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/InstrumentDescriptor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/types.js [app-rsc] (ecmascript)");
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
;
;
;
;
function createNewEmptyCheckpoint(boundaries) {
    var counts = boundaries.map(function() {
        return 0;
    });
    counts.push(0);
    return {
        buckets: {
            boundaries: boundaries,
            counts: counts
        },
        sum: 0,
        count: 0,
        hasMinMax: false,
        min: Infinity,
        max: -Infinity
    };
}
var HistogramAccumulation = function() {
    function HistogramAccumulation(startTime, _boundaries, _recordMinMax, _current) {
        if (_recordMinMax === void 0) {
            _recordMinMax = true;
        }
        if (_current === void 0) {
            _current = createNewEmptyCheckpoint(_boundaries);
        }
        this.startTime = startTime;
        this._boundaries = _boundaries;
        this._recordMinMax = _recordMinMax;
        this._current = _current;
    }
    HistogramAccumulation.prototype.record = function(value) {
        // NaN does not fall into any bucket, is not zero and should not be counted,
        // NaN is never greater than max nor less than min, therefore return as there's nothing for us to do.
        if (Number.isNaN(value)) {
            return;
        }
        this._current.count += 1;
        this._current.sum += value;
        if (this._recordMinMax) {
            this._current.min = Math.min(value, this._current.min);
            this._current.max = Math.max(value, this._current.max);
            this._current.hasMinMax = true;
        }
        var idx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["binarySearchUB"])(this._boundaries, value);
        this._current.buckets.counts[idx] += 1;
    };
    HistogramAccumulation.prototype.setStartTime = function(startTime) {
        this.startTime = startTime;
    };
    HistogramAccumulation.prototype.toPointValue = function() {
        return this._current;
    };
    return HistogramAccumulation;
}();
;
/**
 * Basic aggregator which observes events and counts them in pre-defined buckets
 * and provides the total sum and count of all observations.
 */ var HistogramAggregator = function() {
    /**
     * @param _boundaries sorted upper bounds of recorded values.
     * @param _recordMinMax If set to true, min and max will be recorded. Otherwise, min and max will not be recorded.
     */ function HistogramAggregator(_boundaries, _recordMinMax) {
        this._boundaries = _boundaries;
        this._recordMinMax = _recordMinMax;
        this.kind = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AggregatorKind"].HISTOGRAM;
    }
    HistogramAggregator.prototype.createAccumulation = function(startTime) {
        return new HistogramAccumulation(startTime, this._boundaries, this._recordMinMax);
    };
    /**
     * Return the result of the merge of two histogram accumulations. As long as one Aggregator
     * instance produces all Accumulations with constant boundaries we don't need to worry about
     * merging accumulations with different boundaries.
     */ HistogramAggregator.prototype.merge = function(previous, delta) {
        var previousValue = previous.toPointValue();
        var deltaValue = delta.toPointValue();
        var previousCounts = previousValue.buckets.counts;
        var deltaCounts = deltaValue.buckets.counts;
        var mergedCounts = new Array(previousCounts.length);
        for(var idx = 0; idx < previousCounts.length; idx++){
            mergedCounts[idx] = previousCounts[idx] + deltaCounts[idx];
        }
        var min = Infinity;
        var max = -Infinity;
        if (this._recordMinMax) {
            if (previousValue.hasMinMax && deltaValue.hasMinMax) {
                min = Math.min(previousValue.min, deltaValue.min);
                max = Math.max(previousValue.max, deltaValue.max);
            } else if (previousValue.hasMinMax) {
                min = previousValue.min;
                max = previousValue.max;
            } else if (deltaValue.hasMinMax) {
                min = deltaValue.min;
                max = deltaValue.max;
            }
        }
        return new HistogramAccumulation(previous.startTime, previousValue.buckets.boundaries, this._recordMinMax, {
            buckets: {
                boundaries: previousValue.buckets.boundaries,
                counts: mergedCounts
            },
            count: previousValue.count + deltaValue.count,
            sum: previousValue.sum + deltaValue.sum,
            hasMinMax: this._recordMinMax && (previousValue.hasMinMax || deltaValue.hasMinMax),
            min: min,
            max: max
        });
    };
    /**
     * Returns a new DELTA aggregation by comparing two cumulative measurements.
     */ HistogramAggregator.prototype.diff = function(previous, current) {
        var previousValue = previous.toPointValue();
        var currentValue = current.toPointValue();
        var previousCounts = previousValue.buckets.counts;
        var currentCounts = currentValue.buckets.counts;
        var diffedCounts = new Array(previousCounts.length);
        for(var idx = 0; idx < previousCounts.length; idx++){
            diffedCounts[idx] = currentCounts[idx] - previousCounts[idx];
        }
        return new HistogramAccumulation(current.startTime, previousValue.buckets.boundaries, this._recordMinMax, {
            buckets: {
                boundaries: previousValue.buckets.boundaries,
                counts: diffedCounts
            },
            count: currentValue.count - previousValue.count,
            sum: currentValue.sum - previousValue.sum,
            hasMinMax: false,
            min: Infinity,
            max: -Infinity
        });
    };
    HistogramAggregator.prototype.toMetricData = function(descriptor, aggregationTemporality, accumulationByAttributes, endTime) {
        return {
            descriptor: descriptor,
            aggregationTemporality: aggregationTemporality,
            dataPointType: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DataPointType"].HISTOGRAM,
            dataPoints: accumulationByAttributes.map(function(_a) {
                var _b = __read(_a, 2), attributes = _b[0], accumulation = _b[1];
                var pointValue = accumulation.toPointValue();
                // determine if instrument allows negative values.
                var allowsNegativeValues = descriptor.type === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].GAUGE || descriptor.type === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].UP_DOWN_COUNTER || descriptor.type === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_GAUGE || descriptor.type === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_UP_DOWN_COUNTER;
                return {
                    attributes: attributes,
                    startTime: accumulation.startTime,
                    endTime: endTime,
                    value: {
                        min: pointValue.hasMinMax ? pointValue.min : undefined,
                        max: pointValue.hasMinMax ? pointValue.max : undefined,
                        sum: !allowsNegativeValues ? pointValue.sum : undefined,
                        buckets: pointValue.buckets,
                        count: pointValue.count
                    }
                };
            })
        };
    };
    return HistogramAggregator;
}();
;
 //# sourceMappingURL=Histogram.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/util.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /**
 * Note: other languages provide this as a built in function. This is
 * a naive, but functionally correct implementation. This is used sparingly,
 * when creating a new mapping in a running application.
 *
 * ldexp returns frac × 2**exp. With the following special cases:
 *   ldexp(±0, exp) = ±0
 *   ldexp(±Inf, exp) = ±Inf
 *   ldexp(NaN, exp) = NaN
 * @param frac
 * @param exp
 * @returns {number}
 */ __turbopack_esm__({
    "ldexp": (()=>ldexp),
    "nextGreaterSquare": (()=>nextGreaterSquare)
});
function ldexp(frac, exp) {
    if (frac === 0 || frac === Number.POSITIVE_INFINITY || frac === Number.NEGATIVE_INFINITY || Number.isNaN(frac)) {
        return frac;
    }
    return frac * Math.pow(2, exp);
}
function nextGreaterSquare(v) {
    // The following expression computes the least power-of-two
    // that is >= v.  There are a number of tricky ways to
    // do this, see https://stackoverflow.com/questions/466204/rounding-up-to-next-power-of-2
    v--;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    v++;
    return v;
} //# sourceMappingURL=util.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/ieee754.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /**
 * The functions and constants in this file allow us to interact
 * with the internal representation of an IEEE 64-bit floating point
 * number. We need to work with all 64-bits, thus, care needs to be
 * taken when working with Javascript's bitwise operators (<<, >>, &,
 * |, etc) as they truncate operands to 32-bits. In order to work around
 * this we work with the 64-bits as two 32-bit halves, perform bitwise
 * operations on them independently, and combine the results (if needed).
 */ __turbopack_esm__({
    "MAX_NORMAL_EXPONENT": (()=>MAX_NORMAL_EXPONENT),
    "MIN_NORMAL_EXPONENT": (()=>MIN_NORMAL_EXPONENT),
    "MIN_VALUE": (()=>MIN_VALUE),
    "SIGNIFICAND_WIDTH": (()=>SIGNIFICAND_WIDTH),
    "getNormalBase2": (()=>getNormalBase2),
    "getSignificand": (()=>getSignificand)
});
var SIGNIFICAND_WIDTH = 52;
/**
 * EXPONENT_MASK is set to 1 for the hi 32-bits of an IEEE 754
 * floating point exponent: 0x7ff00000.
 */ var EXPONENT_MASK = 0x7ff00000;
/**
 * SIGNIFICAND_MASK is the mask for the significand portion of the hi 32-bits
 * of an IEEE 754 double-precision floating-point value: 0xfffff
 */ var SIGNIFICAND_MASK = 0xfffff;
/**
 * EXPONENT_BIAS is the exponent bias specified for encoding
 * the IEEE 754 double-precision floating point exponent: 1023
 */ var EXPONENT_BIAS = 1023;
var MIN_NORMAL_EXPONENT = -EXPONENT_BIAS + 1;
var MAX_NORMAL_EXPONENT = EXPONENT_BIAS;
var MIN_VALUE = Math.pow(2, -1022);
function getNormalBase2(value) {
    var dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, value);
    // access the raw 64-bit float as 32-bit uints
    var hiBits = dv.getUint32(0);
    var expBits = (hiBits & EXPONENT_MASK) >> 20;
    return expBits - EXPONENT_BIAS;
}
function getSignificand(value) {
    var dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, value);
    // access the raw 64-bit float as two 32-bit uints
    var hiBits = dv.getUint32(0);
    var loBits = dv.getUint32(4);
    // extract the significand bits from the hi bits and left shift 32 places note:
    // we can't use the native << operator as it will truncate the result to 32-bits
    var significandHiBits = (hiBits & SIGNIFICAND_MASK) * Math.pow(2, 32);
    // combine the hi and lo bits and return
    return significandHiBits + loBits;
} //# sourceMappingURL=ieee754.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/types.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "MappingError": (()=>MappingError)
});
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
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
 */ var MappingError = function(_super) {
    __extends(MappingError, _super);
    function MappingError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return MappingError;
}(Error);
;
 //# sourceMappingURL=types.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/LogarithmMapping.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "LogarithmMapping": (()=>LogarithmMapping)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/ieee754.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/types.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/util.js [app-rsc] (ecmascript)");
;
;
;
/**
 * LogarithmMapping implements exponential mapping functions for scale > 0.
 * For scales <= 0 the exponent mapping should be used.
 */ var LogarithmMapping = function() {
    function LogarithmMapping(scale) {
        this._scale = scale;
        this._scaleFactor = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.ldexp(Math.LOG2E, scale);
        this._inverseFactor = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.ldexp(Math.LN2, -scale);
    }
    /**
     * Maps positive floating point values to indexes corresponding to scale
     * @param value
     * @returns {number} index for provided value at the current scale
     */ LogarithmMapping.prototype.mapToIndex = function(value) {
        if (value <= __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.MIN_VALUE) {
            return this._minNormalLowerBoundaryIndex() - 1;
        }
        // exact power of two special case
        if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.getSignificand(value) === 0) {
            var exp = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.getNormalBase2(value);
            return (exp << this._scale) - 1;
        }
        // non-power of two cases. use Math.floor to round the scaled logarithm
        var index = Math.floor(Math.log(value) * this._scaleFactor);
        var maxIndex = this._maxNormalLowerBoundaryIndex();
        if (index >= maxIndex) {
            return maxIndex;
        }
        return index;
    };
    /**
     * Returns the lower bucket boundary for the given index for scale
     *
     * @param index
     * @returns {number}
     */ LogarithmMapping.prototype.lowerBoundary = function(index) {
        var maxIndex = this._maxNormalLowerBoundaryIndex();
        if (index >= maxIndex) {
            if (index === maxIndex) {
                return 2 * Math.exp((index - (1 << this._scale)) / this._scaleFactor);
            }
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MappingError"]("overflow: " + index + " is > maximum lower boundary: " + maxIndex);
        }
        var minIndex = this._minNormalLowerBoundaryIndex();
        if (index <= minIndex) {
            if (index === minIndex) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.MIN_VALUE;
            } else if (index === minIndex - 1) {
                return Math.exp((index + (1 << this._scale)) / this._scaleFactor) / 2;
            }
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MappingError"]("overflow: " + index + " is < minimum lower boundary: " + minIndex);
        }
        return Math.exp(index * this._inverseFactor);
    };
    Object.defineProperty(LogarithmMapping.prototype, "scale", {
        /**
         * The scale used by this mapping
         * @returns {number}
         */ get: function() {
            return this._scale;
        },
        enumerable: false,
        configurable: true
    });
    LogarithmMapping.prototype._minNormalLowerBoundaryIndex = function() {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.MIN_NORMAL_EXPONENT << this._scale;
    };
    LogarithmMapping.prototype._maxNormalLowerBoundaryIndex = function() {
        return (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.MAX_NORMAL_EXPONENT + 1 << this._scale) - 1;
    };
    return LogarithmMapping;
}();
;
 //# sourceMappingURL=LogarithmMapping.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/ExponentMapping.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "ExponentMapping": (()=>ExponentMapping)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/ieee754.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/types.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/util.js [app-rsc] (ecmascript)");
;
;
;
/**
 * ExponentMapping implements exponential mapping functions for
 * scales <=0. For scales > 0 LogarithmMapping should be used.
 */ var ExponentMapping = function() {
    function ExponentMapping(scale) {
        this._shift = -scale;
    }
    /**
     * Maps positive floating point values to indexes corresponding to scale
     * @param value
     * @returns {number} index for provided value at the current scale
     */ ExponentMapping.prototype.mapToIndex = function(value) {
        if (value < __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.MIN_VALUE) {
            return this._minNormalLowerBoundaryIndex();
        }
        var exp = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.getNormalBase2(value);
        // In case the value is an exact power of two, compute a
        // correction of -1. Note, we are using a custom _rightShift
        // to accommodate a 52-bit argument, which the native bitwise
        // operators do not support
        var correction = this._rightShift(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.getSignificand(value) - 1, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.SIGNIFICAND_WIDTH);
        return exp + correction >> this._shift;
    };
    /**
     * Returns the lower bucket boundary for the given index for scale
     *
     * @param index
     * @returns {number}
     */ ExponentMapping.prototype.lowerBoundary = function(index) {
        var minIndex = this._minNormalLowerBoundaryIndex();
        if (index < minIndex) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MappingError"]("underflow: " + index + " is < minimum lower boundary: " + minIndex);
        }
        var maxIndex = this._maxNormalLowerBoundaryIndex();
        if (index > maxIndex) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MappingError"]("overflow: " + index + " is > maximum lower boundary: " + maxIndex);
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.ldexp(1, index << this._shift);
    };
    Object.defineProperty(ExponentMapping.prototype, "scale", {
        /**
         * The scale used by this mapping
         * @returns {number}
         */ get: function() {
            if (this._shift === 0) {
                return 0;
            }
            return -this._shift;
        },
        enumerable: false,
        configurable: true
    });
    ExponentMapping.prototype._minNormalLowerBoundaryIndex = function() {
        var index = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.MIN_NORMAL_EXPONENT >> this._shift;
        if (this._shift < 2) {
            index--;
        }
        return index;
    };
    ExponentMapping.prototype._maxNormalLowerBoundaryIndex = function() {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ieee754$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__.MAX_NORMAL_EXPONENT >> this._shift;
    };
    ExponentMapping.prototype._rightShift = function(value, shift) {
        return Math.floor(value * Math.pow(2, -shift));
    };
    return ExponentMapping;
}();
;
 //# sourceMappingURL=ExponentMapping.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/getMapping.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "getMapping": (()=>getMapping)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$LogarithmMapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/LogarithmMapping.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ExponentMapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/ExponentMapping.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/types.js [app-rsc] (ecmascript)");
;
;
;
var MIN_SCALE = -10;
var MAX_SCALE = 20;
var PREBUILT_MAPPINGS = Array.from({
    length: 31
}, function(_, i) {
    if (i > 10) {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$LogarithmMapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["LogarithmMapping"](i - 10);
    }
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$ExponentMapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExponentMapping"](i - 10);
});
function getMapping(scale) {
    if (scale > MAX_SCALE || scale < MIN_SCALE) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MappingError"]("expected scale >= " + MIN_SCALE + " && <= " + MAX_SCALE + ", got: " + scale);
    }
    // mappings are offset by 10. scale -10 is at position 0 and scale 20 is at 30
    return PREBUILT_MAPPINGS[scale + 10];
} //# sourceMappingURL=getMapping.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/Buckets.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "Buckets": (()=>Buckets)
});
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
var __spreadArray = this && this.__spreadArray || function(to, from, pack) {
    if (pack || arguments.length === 2) for(var i = 0, l = from.length, ar; i < l; i++){
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
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
 */ var Buckets = function() {
    /**
     * The term index refers to the number of the exponential histogram bucket
     * used to determine its boundaries. The lower boundary of a bucket is
     * determined by base ** index and the upper boundary of a bucket is
     * determined by base ** (index + 1). index values are signed to account
     * for values less than or equal to 1.
     *
     * indexBase is the index of the 0th position in the
     * backing array, i.e., backing[0] is the count
     * in the bucket with index `indexBase`.
     *
     * indexStart is the smallest index value represented
     * in the backing array.
     *
     * indexEnd is the largest index value represented in
     * the backing array.
     */ function Buckets(backing, indexBase, indexStart, indexEnd) {
        if (backing === void 0) {
            backing = new BucketsBacking();
        }
        if (indexBase === void 0) {
            indexBase = 0;
        }
        if (indexStart === void 0) {
            indexStart = 0;
        }
        if (indexEnd === void 0) {
            indexEnd = 0;
        }
        this.backing = backing;
        this.indexBase = indexBase;
        this.indexStart = indexStart;
        this.indexEnd = indexEnd;
    }
    Object.defineProperty(Buckets.prototype, "offset", {
        /**
         * Offset is the bucket index of the smallest entry in the counts array
         * @returns {number}
         */ get: function() {
            return this.indexStart;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Buckets.prototype, "length", {
        /**
         * Buckets is a view into the backing array.
         * @returns {number}
         */ get: function() {
            if (this.backing.length === 0) {
                return 0;
            }
            if (this.indexEnd === this.indexStart && this.at(0) === 0) {
                return 0;
            }
            return this.indexEnd - this.indexStart + 1;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * An array of counts, where count[i] carries the count
     * of the bucket at index (offset+i).  count[i] is the count of
     * values greater than base^(offset+i) and less than or equal to
     * base^(offset+i+1).
     * @returns {number} The logical counts based on the backing array
     */ Buckets.prototype.counts = function() {
        var _this = this;
        return Array.from({
            length: this.length
        }, function(_, i) {
            return _this.at(i);
        });
    };
    /**
     * At returns the count of the bucket at a position in the logical
     * array of counts.
     * @param position
     * @returns {number}
     */ Buckets.prototype.at = function(position) {
        var bias = this.indexBase - this.indexStart;
        if (position < bias) {
            position += this.backing.length;
        }
        position -= bias;
        return this.backing.countAt(position);
    };
    /**
     * incrementBucket increments the backing array index by `increment`
     * @param bucketIndex
     * @param increment
     */ Buckets.prototype.incrementBucket = function(bucketIndex, increment) {
        this.backing.increment(bucketIndex, increment);
    };
    /**
     * decrementBucket decrements the backing array index by `decrement`
     * if decrement is greater than the current value, it's set to 0.
     * @param bucketIndex
     * @param decrement
     */ Buckets.prototype.decrementBucket = function(bucketIndex, decrement) {
        this.backing.decrement(bucketIndex, decrement);
    };
    /**
     * trim removes leading and / or trailing zero buckets (which can occur
     * after diffing two histos) and rotates the backing array so that the
     * smallest non-zero index is in the 0th position of the backing array
     */ Buckets.prototype.trim = function() {
        for(var i = 0; i < this.length; i++){
            if (this.at(i) !== 0) {
                this.indexStart += i;
                break;
            } else if (i === this.length - 1) {
                //the entire array is zeroed out
                this.indexStart = this.indexEnd = this.indexBase = 0;
                return;
            }
        }
        for(var i = this.length - 1; i >= 0; i--){
            if (this.at(i) !== 0) {
                this.indexEnd -= this.length - i - 1;
                break;
            }
        }
        this._rotate();
    };
    /**
     * downscale first rotates, then collapses 2**`by`-to-1 buckets.
     * @param by
     */ Buckets.prototype.downscale = function(by) {
        this._rotate();
        var size = 1 + this.indexEnd - this.indexStart;
        var each = 1 << by;
        var inpos = 0;
        var outpos = 0;
        for(var pos = this.indexStart; pos <= this.indexEnd;){
            var mod = pos % each;
            if (mod < 0) {
                mod += each;
            }
            for(var i = mod; i < each && inpos < size; i++){
                this._relocateBucket(outpos, inpos);
                inpos++;
                pos++;
            }
            outpos++;
        }
        this.indexStart >>= by;
        this.indexEnd >>= by;
        this.indexBase = this.indexStart;
    };
    /**
     * Clone returns a deep copy of Buckets
     * @returns {Buckets}
     */ Buckets.prototype.clone = function() {
        return new Buckets(this.backing.clone(), this.indexBase, this.indexStart, this.indexEnd);
    };
    /**
     * _rotate shifts the backing array contents so that indexStart ==
     * indexBase to simplify the downscale logic.
     */ Buckets.prototype._rotate = function() {
        var bias = this.indexBase - this.indexStart;
        if (bias === 0) {
            return;
        } else if (bias > 0) {
            this.backing.reverse(0, this.backing.length);
            this.backing.reverse(0, bias);
            this.backing.reverse(bias, this.backing.length);
        } else {
            // negative bias, this can happen when diffing two histograms
            this.backing.reverse(0, this.backing.length);
            this.backing.reverse(0, this.backing.length + bias);
        }
        this.indexBase = this.indexStart;
    };
    /**
     * _relocateBucket adds the count in counts[src] to counts[dest] and
     * resets count[src] to zero.
     */ Buckets.prototype._relocateBucket = function(dest, src) {
        if (dest === src) {
            return;
        }
        this.incrementBucket(dest, this.backing.emptyBucket(src));
    };
    return Buckets;
}();
;
/**
 * BucketsBacking holds the raw buckets and some utility methods to
 * manage them.
 */ var BucketsBacking = function() {
    function BucketsBacking(_counts) {
        if (_counts === void 0) {
            _counts = [
                0
            ];
        }
        this._counts = _counts;
    }
    Object.defineProperty(BucketsBacking.prototype, "length", {
        /**
         * length returns the physical size of the backing array, which
         * is >= buckets.length()
         */ get: function() {
            return this._counts.length;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * countAt returns the count in a specific bucket
     */ BucketsBacking.prototype.countAt = function(pos) {
        return this._counts[pos];
    };
    /**
     * growTo grows a backing array and copies old entries
     * into their correct new positions.
     */ BucketsBacking.prototype.growTo = function(newSize, oldPositiveLimit, newPositiveLimit) {
        var tmp = new Array(newSize).fill(0);
        tmp.splice.apply(tmp, __spreadArray([
            newPositiveLimit,
            this._counts.length - oldPositiveLimit
        ], __read(this._counts.slice(oldPositiveLimit)), false));
        tmp.splice.apply(tmp, __spreadArray([
            0,
            oldPositiveLimit
        ], __read(this._counts.slice(0, oldPositiveLimit)), false));
        this._counts = tmp;
    };
    /**
     * reverse the items in the backing array in the range [from, limit).
     */ BucketsBacking.prototype.reverse = function(from, limit) {
        var num = Math.floor((from + limit) / 2) - from;
        for(var i = 0; i < num; i++){
            var tmp = this._counts[from + i];
            this._counts[from + i] = this._counts[limit - i - 1];
            this._counts[limit - i - 1] = tmp;
        }
    };
    /**
     * emptyBucket empties the count from a bucket, for
     * moving into another.
     */ BucketsBacking.prototype.emptyBucket = function(src) {
        var tmp = this._counts[src];
        this._counts[src] = 0;
        return tmp;
    };
    /**
     * increments a bucket by `increment`
     */ BucketsBacking.prototype.increment = function(bucketIndex, increment) {
        this._counts[bucketIndex] += increment;
    };
    /**
     * decrements a bucket by `decrement`
     */ BucketsBacking.prototype.decrement = function(bucketIndex, decrement) {
        if (this._counts[bucketIndex] >= decrement) {
            this._counts[bucketIndex] -= decrement;
        } else {
            // this should not happen, but we're being defensive against
            // negative counts.
            this._counts[bucketIndex] = 0;
        }
    };
    /**
     * clone returns a deep copy of BucketsBacking
     */ BucketsBacking.prototype.clone = function() {
        return new BucketsBacking(__spreadArray([], __read(this._counts), false));
    };
    return BucketsBacking;
}(); //# sourceMappingURL=Buckets.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/ExponentialHistogram.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "ExponentialHistogramAccumulation": (()=>ExponentialHistogramAccumulation),
    "ExponentialHistogramAggregator": (()=>ExponentialHistogramAggregator)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/util.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$getMapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/mapping/getMapping.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$Buckets$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/exponential-histogram/Buckets.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/MetricData.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/InstrumentDescriptor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/types.js [app-rsc] (ecmascript)");
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
;
;
;
;
;
;
;
// HighLow is a utility class used for computing a common scale for
// two exponential histogram accumulations
var HighLow = function() {
    function HighLow(low, high) {
        this.low = low;
        this.high = high;
    }
    HighLow.combine = function(h1, h2) {
        return new HighLow(Math.min(h1.low, h2.low), Math.max(h1.high, h2.high));
    };
    return HighLow;
}();
var MAX_SCALE = 20;
var DEFAULT_MAX_SIZE = 160;
var MIN_MAX_SIZE = 2;
var ExponentialHistogramAccumulation = function() {
    function ExponentialHistogramAccumulation(startTime, _maxSize, _recordMinMax, _sum, _count, _zeroCount, _min, _max, _positive, _negative, _mapping) {
        if (startTime === void 0) {
            startTime = startTime;
        }
        if (_maxSize === void 0) {
            _maxSize = DEFAULT_MAX_SIZE;
        }
        if (_recordMinMax === void 0) {
            _recordMinMax = true;
        }
        if (_sum === void 0) {
            _sum = 0;
        }
        if (_count === void 0) {
            _count = 0;
        }
        if (_zeroCount === void 0) {
            _zeroCount = 0;
        }
        if (_min === void 0) {
            _min = Number.POSITIVE_INFINITY;
        }
        if (_max === void 0) {
            _max = Number.NEGATIVE_INFINITY;
        }
        if (_positive === void 0) {
            _positive = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$Buckets$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Buckets"]();
        }
        if (_negative === void 0) {
            _negative = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$Buckets$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Buckets"]();
        }
        if (_mapping === void 0) {
            _mapping = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$getMapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getMapping"])(MAX_SCALE);
        }
        this.startTime = startTime;
        this._maxSize = _maxSize;
        this._recordMinMax = _recordMinMax;
        this._sum = _sum;
        this._count = _count;
        this._zeroCount = _zeroCount;
        this._min = _min;
        this._max = _max;
        this._positive = _positive;
        this._negative = _negative;
        this._mapping = _mapping;
        if (this._maxSize < MIN_MAX_SIZE) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("Exponential Histogram Max Size set to " + this._maxSize + ",                 changing to the minimum size of: " + MIN_MAX_SIZE);
            this._maxSize = MIN_MAX_SIZE;
        }
    }
    /**
     * record updates a histogram with a single count
     * @param {Number} value
     */ ExponentialHistogramAccumulation.prototype.record = function(value) {
        this.updateByIncrement(value, 1);
    };
    /**
     * Sets the start time for this accumulation
     * @param {HrTime} startTime
     */ ExponentialHistogramAccumulation.prototype.setStartTime = function(startTime) {
        this.startTime = startTime;
    };
    /**
     * Returns the datapoint representation of this accumulation
     * @param {HrTime} startTime
     */ ExponentialHistogramAccumulation.prototype.toPointValue = function() {
        return {
            hasMinMax: this._recordMinMax,
            min: this.min,
            max: this.max,
            sum: this.sum,
            positive: {
                offset: this.positive.offset,
                bucketCounts: this.positive.counts()
            },
            negative: {
                offset: this.negative.offset,
                bucketCounts: this.negative.counts()
            },
            count: this.count,
            scale: this.scale,
            zeroCount: this.zeroCount
        };
    };
    Object.defineProperty(ExponentialHistogramAccumulation.prototype, "sum", {
        /**
         * @returns {Number} The sum of values recorded by this accumulation
         */ get: function() {
            return this._sum;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExponentialHistogramAccumulation.prototype, "min", {
        /**
         * @returns {Number} The minimum value recorded by this accumulation
         */ get: function() {
            return this._min;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExponentialHistogramAccumulation.prototype, "max", {
        /**
         * @returns {Number} The maximum value recorded by this accumulation
         */ get: function() {
            return this._max;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExponentialHistogramAccumulation.prototype, "count", {
        /**
         * @returns {Number} The count of values recorded by this accumulation
         */ get: function() {
            return this._count;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExponentialHistogramAccumulation.prototype, "zeroCount", {
        /**
         * @returns {Number} The number of 0 values recorded by this accumulation
         */ get: function() {
            return this._zeroCount;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExponentialHistogramAccumulation.prototype, "scale", {
        /**
         * @returns {Number} The scale used by this accumulation
         */ get: function() {
            if (this._count === this._zeroCount) {
                // all zeros! scale doesn't matter, use zero
                return 0;
            }
            return this._mapping.scale;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExponentialHistogramAccumulation.prototype, "positive", {
        /**
         * positive holds the positive values
         * @returns {Buckets}
         */ get: function() {
            return this._positive;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ExponentialHistogramAccumulation.prototype, "negative", {
        /**
         * negative holds the negative values by their absolute value
         * @returns {Buckets}
         */ get: function() {
            return this._negative;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * updateByIncr supports updating a histogram with a non-negative
     * increment.
     * @param value
     * @param increment
     */ ExponentialHistogramAccumulation.prototype.updateByIncrement = function(value, increment) {
        // NaN does not fall into any bucket, is not zero and should not be counted,
        // NaN is never greater than max nor less than min, therefore return as there's nothing for us to do.
        if (Number.isNaN(value)) {
            return;
        }
        if (value > this._max) {
            this._max = value;
        }
        if (value < this._min) {
            this._min = value;
        }
        this._count += increment;
        if (value === 0) {
            this._zeroCount += increment;
            return;
        }
        this._sum += value * increment;
        if (value > 0) {
            this._updateBuckets(this._positive, value, increment);
        } else {
            this._updateBuckets(this._negative, -value, increment);
        }
    };
    /**
     * merge combines data from previous value into self
     * @param {ExponentialHistogramAccumulation} previous
     */ ExponentialHistogramAccumulation.prototype.merge = function(previous) {
        if (this._count === 0) {
            this._min = previous.min;
            this._max = previous.max;
        } else if (previous.count !== 0) {
            if (previous.min < this.min) {
                this._min = previous.min;
            }
            if (previous.max > this.max) {
                this._max = previous.max;
            }
        }
        this.startTime = previous.startTime;
        this._sum += previous.sum;
        this._count += previous.count;
        this._zeroCount += previous.zeroCount;
        var minScale = this._minScale(previous);
        this._downscale(this.scale - minScale);
        this._mergeBuckets(this.positive, previous, previous.positive, minScale);
        this._mergeBuckets(this.negative, previous, previous.negative, minScale);
    };
    /**
     * diff subtracts other from self
     * @param {ExponentialHistogramAccumulation} other
     */ ExponentialHistogramAccumulation.prototype.diff = function(other) {
        this._min = Infinity;
        this._max = -Infinity;
        this._sum -= other.sum;
        this._count -= other.count;
        this._zeroCount -= other.zeroCount;
        var minScale = this._minScale(other);
        this._downscale(this.scale - minScale);
        this._diffBuckets(this.positive, other, other.positive, minScale);
        this._diffBuckets(this.negative, other, other.negative, minScale);
    };
    /**
     * clone returns a deep copy of self
     * @returns {ExponentialHistogramAccumulation}
     */ ExponentialHistogramAccumulation.prototype.clone = function() {
        return new ExponentialHistogramAccumulation(this.startTime, this._maxSize, this._recordMinMax, this._sum, this._count, this._zeroCount, this._min, this._max, this.positive.clone(), this.negative.clone(), this._mapping);
    };
    /**
     * _updateBuckets maps the incoming value to a bucket index for the current
     * scale. If the bucket index is outside of the range of the backing array,
     * it will rescale the backing array and update the mapping for the new scale.
     */ ExponentialHistogramAccumulation.prototype._updateBuckets = function(buckets, value, increment) {
        var index = this._mapping.mapToIndex(value);
        // rescale the mapping if needed
        var rescalingNeeded = false;
        var high = 0;
        var low = 0;
        if (buckets.length === 0) {
            buckets.indexStart = index;
            buckets.indexEnd = buckets.indexStart;
            buckets.indexBase = buckets.indexStart;
        } else if (index < buckets.indexStart && buckets.indexEnd - index >= this._maxSize) {
            rescalingNeeded = true;
            low = index;
            high = buckets.indexEnd;
        } else if (index > buckets.indexEnd && index - buckets.indexStart >= this._maxSize) {
            rescalingNeeded = true;
            low = buckets.indexStart;
            high = index;
        }
        // rescale and compute index at new scale
        if (rescalingNeeded) {
            var change = this._changeScale(high, low);
            this._downscale(change);
            index = this._mapping.mapToIndex(value);
        }
        this._incrementIndexBy(buckets, index, increment);
    };
    /**
     * _incrementIndexBy increments the count of the bucket specified by `index`.
     * If the index is outside of the range [buckets.indexStart, buckets.indexEnd]
     * the boundaries of the backing array will be adjusted and more buckets will
     * be added if needed.
     */ ExponentialHistogramAccumulation.prototype._incrementIndexBy = function(buckets, index, increment) {
        if (increment === 0) {
            // nothing to do for a zero increment, can happen during a merge operation
            return;
        }
        if (buckets.length === 0) {
            buckets.indexStart = buckets.indexEnd = buckets.indexBase = index;
        }
        if (index < buckets.indexStart) {
            var span = buckets.indexEnd - index;
            if (span >= buckets.backing.length) {
                this._grow(buckets, span + 1);
            }
            buckets.indexStart = index;
        } else if (index > buckets.indexEnd) {
            var span = index - buckets.indexStart;
            if (span >= buckets.backing.length) {
                this._grow(buckets, span + 1);
            }
            buckets.indexEnd = index;
        }
        var bucketIndex = index - buckets.indexBase;
        if (bucketIndex < 0) {
            bucketIndex += buckets.backing.length;
        }
        buckets.incrementBucket(bucketIndex, increment);
    };
    /**
     * grow resizes the backing array by doubling in size up to maxSize.
     * This extends the array with a bunch of zeros and copies the
     * existing counts to the same position.
     */ ExponentialHistogramAccumulation.prototype._grow = function(buckets, needed) {
        var size = buckets.backing.length;
        var bias = buckets.indexBase - buckets.indexStart;
        var oldPositiveLimit = size - bias;
        var newSize = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["nextGreaterSquare"])(needed);
        if (newSize > this._maxSize) {
            newSize = this._maxSize;
        }
        var newPositiveLimit = newSize - bias;
        buckets.backing.growTo(newSize, oldPositiveLimit, newPositiveLimit);
    };
    /**
     * _changeScale computes how much downscaling is needed by shifting the
     * high and low values until they are separated by no more than size.
     */ ExponentialHistogramAccumulation.prototype._changeScale = function(high, low) {
        var change = 0;
        while(high - low >= this._maxSize){
            high >>= 1;
            low >>= 1;
            change++;
        }
        return change;
    };
    /**
     * _downscale subtracts `change` from the current mapping scale.
     */ ExponentialHistogramAccumulation.prototype._downscale = function(change) {
        if (change === 0) {
            return;
        }
        if (change < 0) {
            // Note: this should be impossible. If we get here it's because
            // there is a bug in the implementation.
            throw new Error("impossible change of scale: " + this.scale);
        }
        var newScale = this._mapping.scale - change;
        this._positive.downscale(change);
        this._negative.downscale(change);
        this._mapping = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$exponential$2d$histogram$2f$mapping$2f$getMapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getMapping"])(newScale);
    };
    /**
     * _minScale is used by diff and merge to compute an ideal combined scale
     */ ExponentialHistogramAccumulation.prototype._minScale = function(other) {
        var minScale = Math.min(this.scale, other.scale);
        var highLowPos = HighLow.combine(this._highLowAtScale(this.positive, this.scale, minScale), this._highLowAtScale(other.positive, other.scale, minScale));
        var highLowNeg = HighLow.combine(this._highLowAtScale(this.negative, this.scale, minScale), this._highLowAtScale(other.negative, other.scale, minScale));
        return Math.min(minScale - this._changeScale(highLowPos.high, highLowPos.low), minScale - this._changeScale(highLowNeg.high, highLowNeg.low));
    };
    /**
     * _highLowAtScale is used by diff and merge to compute an ideal combined scale.
     */ ExponentialHistogramAccumulation.prototype._highLowAtScale = function(buckets, currentScale, newScale) {
        if (buckets.length === 0) {
            return new HighLow(0, -1);
        }
        var shift = currentScale - newScale;
        return new HighLow(buckets.indexStart >> shift, buckets.indexEnd >> shift);
    };
    /**
     * _mergeBuckets translates index values from another histogram and
     * adds the values into the corresponding buckets of this histogram.
     */ ExponentialHistogramAccumulation.prototype._mergeBuckets = function(ours, other, theirs, scale) {
        var theirOffset = theirs.offset;
        var theirChange = other.scale - scale;
        for(var i = 0; i < theirs.length; i++){
            this._incrementIndexBy(ours, theirOffset + i >> theirChange, theirs.at(i));
        }
    };
    /**
     * _diffBuckets translates index values from another histogram and
     * subtracts the values in the corresponding buckets of this histogram.
     */ ExponentialHistogramAccumulation.prototype._diffBuckets = function(ours, other, theirs, scale) {
        var theirOffset = theirs.offset;
        var theirChange = other.scale - scale;
        for(var i = 0; i < theirs.length; i++){
            var ourIndex = theirOffset + i >> theirChange;
            var bucketIndex = ourIndex - ours.indexBase;
            if (bucketIndex < 0) {
                bucketIndex += ours.backing.length;
            }
            ours.decrementBucket(bucketIndex, theirs.at(i));
        }
        ours.trim();
    };
    return ExponentialHistogramAccumulation;
}();
;
/**
 * Aggregator for ExponentialHistogramAccumulations
 */ var ExponentialHistogramAggregator = function() {
    /**
     * @param _maxSize Maximum number of buckets for each of the positive
     *    and negative ranges, exclusive of the zero-bucket.
     * @param _recordMinMax If set to true, min and max will be recorded.
     *    Otherwise, min and max will not be recorded.
     */ function ExponentialHistogramAggregator(_maxSize, _recordMinMax) {
        this._maxSize = _maxSize;
        this._recordMinMax = _recordMinMax;
        this.kind = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AggregatorKind"].EXPONENTIAL_HISTOGRAM;
    }
    ExponentialHistogramAggregator.prototype.createAccumulation = function(startTime) {
        return new ExponentialHistogramAccumulation(startTime, this._maxSize, this._recordMinMax);
    };
    /**
     * Return the result of the merge of two exponential histogram accumulations.
     */ ExponentialHistogramAggregator.prototype.merge = function(previous, delta) {
        var result = delta.clone();
        result.merge(previous);
        return result;
    };
    /**
     * Returns a new DELTA aggregation by comparing two cumulative measurements.
     */ ExponentialHistogramAggregator.prototype.diff = function(previous, current) {
        var result = current.clone();
        result.diff(previous);
        return result;
    };
    ExponentialHistogramAggregator.prototype.toMetricData = function(descriptor, aggregationTemporality, accumulationByAttributes, endTime) {
        return {
            descriptor: descriptor,
            aggregationTemporality: aggregationTemporality,
            dataPointType: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DataPointType"].EXPONENTIAL_HISTOGRAM,
            dataPoints: accumulationByAttributes.map(function(_a) {
                var _b = __read(_a, 2), attributes = _b[0], accumulation = _b[1];
                var pointValue = accumulation.toPointValue();
                // determine if instrument allows negative values.
                var allowsNegativeValues = descriptor.type === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].GAUGE || descriptor.type === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].UP_DOWN_COUNTER || descriptor.type === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_GAUGE || descriptor.type === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_UP_DOWN_COUNTER;
                return {
                    attributes: attributes,
                    startTime: accumulation.startTime,
                    endTime: endTime,
                    value: {
                        min: pointValue.hasMinMax ? pointValue.min : undefined,
                        max: pointValue.hasMinMax ? pointValue.max : undefined,
                        sum: !allowsNegativeValues ? pointValue.sum : undefined,
                        positive: {
                            offset: pointValue.positive.offset,
                            bucketCounts: pointValue.positive.bucketCounts
                        },
                        negative: {
                            offset: pointValue.negative.offset,
                            bucketCounts: pointValue.negative.bucketCounts
                        },
                        count: pointValue.count,
                        scale: pointValue.scale,
                        zeroCount: pointValue.zeroCount
                    }
                };
            })
        };
    };
    return ExponentialHistogramAggregator;
}();
;
 //# sourceMappingURL=ExponentialHistogram.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/Aggregation.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "Aggregation": (()=>Aggregation),
    "DefaultAggregation": (()=>DefaultAggregation),
    "DropAggregation": (()=>DropAggregation),
    "ExplicitBucketHistogramAggregation": (()=>ExplicitBucketHistogramAggregation),
    "ExponentialHistogramAggregation": (()=>ExponentialHistogramAggregation),
    "HistogramAggregation": (()=>HistogramAggregation),
    "LastValueAggregation": (()=>LastValueAggregation),
    "SumAggregation": (()=>SumAggregation)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$Drop$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/Drop.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/InstrumentDescriptor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$Sum$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/Sum.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$LastValue$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/LastValue.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$Histogram$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/Histogram.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$ExponentialHistogram$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/aggregator/ExponentialHistogram.js [app-rsc] (ecmascript)");
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
;
;
;
/**
 * Configures how measurements are combined into metrics for views.
 *
 * Aggregation provides a set of built-in aggregations via static methods.
 */ var Aggregation = function() {
    function Aggregation() {}
    Aggregation.Drop = function() {
        return DROP_AGGREGATION;
    };
    Aggregation.Sum = function() {
        return SUM_AGGREGATION;
    };
    Aggregation.LastValue = function() {
        return LAST_VALUE_AGGREGATION;
    };
    Aggregation.Histogram = function() {
        return HISTOGRAM_AGGREGATION;
    };
    Aggregation.ExponentialHistogram = function() {
        return EXPONENTIAL_HISTOGRAM_AGGREGATION;
    };
    Aggregation.Default = function() {
        return DEFAULT_AGGREGATION;
    };
    return Aggregation;
}();
;
/**
 * The default drop aggregation.
 */ var DropAggregation = function(_super) {
    __extends(DropAggregation, _super);
    function DropAggregation() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DropAggregation.prototype.createAggregator = function(_instrument) {
        return DropAggregation.DEFAULT_INSTANCE;
    };
    DropAggregation.DEFAULT_INSTANCE = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$Drop$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DropAggregator"]();
    return DropAggregation;
}(Aggregation);
;
/**
 * The default sum aggregation.
 */ var SumAggregation = function(_super) {
    __extends(SumAggregation, _super);
    function SumAggregation() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SumAggregation.prototype.createAggregator = function(instrument) {
        switch(instrument.type){
            case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].COUNTER:
            case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_COUNTER:
            case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].HISTOGRAM:
                {
                    return SumAggregation.MONOTONIC_INSTANCE;
                }
            default:
                {
                    return SumAggregation.NON_MONOTONIC_INSTANCE;
                }
        }
    };
    SumAggregation.MONOTONIC_INSTANCE = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$Sum$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SumAggregator"](true);
    SumAggregation.NON_MONOTONIC_INSTANCE = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$Sum$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SumAggregator"](false);
    return SumAggregation;
}(Aggregation);
;
/**
 * The default last value aggregation.
 */ var LastValueAggregation = function(_super) {
    __extends(LastValueAggregation, _super);
    function LastValueAggregation() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LastValueAggregation.prototype.createAggregator = function(_instrument) {
        return LastValueAggregation.DEFAULT_INSTANCE;
    };
    LastValueAggregation.DEFAULT_INSTANCE = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$LastValue$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["LastValueAggregator"]();
    return LastValueAggregation;
}(Aggregation);
;
/**
 * The default histogram aggregation.
 */ var HistogramAggregation = function(_super) {
    __extends(HistogramAggregation, _super);
    function HistogramAggregation() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    HistogramAggregation.prototype.createAggregator = function(_instrument) {
        return HistogramAggregation.DEFAULT_INSTANCE;
    };
    HistogramAggregation.DEFAULT_INSTANCE = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$Histogram$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["HistogramAggregator"]([
        0,
        5,
        10,
        25,
        50,
        75,
        100,
        250,
        500,
        750,
        1000,
        2500,
        5000,
        7500,
        10000
    ], true);
    return HistogramAggregation;
}(Aggregation);
;
/**
 * The explicit bucket histogram aggregation.
 */ var ExplicitBucketHistogramAggregation = function(_super) {
    __extends(ExplicitBucketHistogramAggregation, _super);
    /**
     * @param boundaries the bucket boundaries of the histogram aggregation
     * @param _recordMinMax If set to true, min and max will be recorded. Otherwise, min and max will not be recorded.
     */ function ExplicitBucketHistogramAggregation(boundaries, _recordMinMax) {
        if (_recordMinMax === void 0) {
            _recordMinMax = true;
        }
        var _this = _super.call(this) || this;
        _this._recordMinMax = _recordMinMax;
        if (boundaries == null) {
            throw new Error('ExplicitBucketHistogramAggregation should be created with explicit boundaries, if a single bucket histogram is required, please pass an empty array');
        }
        // Copy the boundaries array for modification.
        boundaries = boundaries.concat();
        // We need to an ordered set to be able to correctly compute count for each
        // boundary since we'll iterate on each in order.
        boundaries = boundaries.sort(function(a, b) {
            return a - b;
        });
        // Remove all Infinity from the boundaries.
        var minusInfinityIndex = boundaries.lastIndexOf(-Infinity);
        var infinityIndex = boundaries.indexOf(Infinity);
        if (infinityIndex === -1) {
            infinityIndex = undefined;
        }
        _this._boundaries = boundaries.slice(minusInfinityIndex + 1, infinityIndex);
        return _this;
    }
    ExplicitBucketHistogramAggregation.prototype.createAggregator = function(_instrument) {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$Histogram$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["HistogramAggregator"](this._boundaries, this._recordMinMax);
    };
    return ExplicitBucketHistogramAggregation;
}(Aggregation);
;
var ExponentialHistogramAggregation = function(_super) {
    __extends(ExponentialHistogramAggregation, _super);
    function ExponentialHistogramAggregation(_maxSize, _recordMinMax) {
        if (_maxSize === void 0) {
            _maxSize = 160;
        }
        if (_recordMinMax === void 0) {
            _recordMinMax = true;
        }
        var _this = _super.call(this) || this;
        _this._maxSize = _maxSize;
        _this._recordMinMax = _recordMinMax;
        return _this;
    }
    ExponentialHistogramAggregation.prototype.createAggregator = function(_instrument) {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$aggregator$2f$ExponentialHistogram$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExponentialHistogramAggregator"](this._maxSize, this._recordMinMax);
    };
    return ExponentialHistogramAggregation;
}(Aggregation);
;
/**
 * The default aggregation.
 */ var DefaultAggregation = function(_super) {
    __extends(DefaultAggregation, _super);
    function DefaultAggregation() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DefaultAggregation.prototype._resolve = function(instrument) {
        // cast to unknown to disable complaints on the (unreachable) fallback.
        switch(instrument.type){
            case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].COUNTER:
            case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].UP_DOWN_COUNTER:
            case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_COUNTER:
            case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_UP_DOWN_COUNTER:
                {
                    return SUM_AGGREGATION;
                }
            case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].GAUGE:
            case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_GAUGE:
                {
                    return LAST_VALUE_AGGREGATION;
                }
            case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].HISTOGRAM:
                {
                    if (instrument.advice.explicitBucketBoundaries) {
                        return new ExplicitBucketHistogramAggregation(instrument.advice.explicitBucketBoundaries);
                    }
                    return HISTOGRAM_AGGREGATION;
                }
        }
        __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.diag.warn("Unable to recognize instrument type: " + instrument.type);
        return DROP_AGGREGATION;
    };
    DefaultAggregation.prototype.createAggregator = function(instrument) {
        return this._resolve(instrument).createAggregator(instrument);
    };
    return DefaultAggregation;
}(Aggregation);
;
var DROP_AGGREGATION = new DropAggregation();
var SUM_AGGREGATION = new SumAggregation();
var LAST_VALUE_AGGREGATION = new LastValueAggregation();
var HISTOGRAM_AGGREGATION = new HistogramAggregation();
var EXPONENTIAL_HISTOGRAM_AGGREGATION = new ExponentialHistogramAggregation();
var DEFAULT_AGGREGATION = new DefaultAggregation(); //# sourceMappingURL=Aggregation.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/AggregationSelector.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "DEFAULT_AGGREGATION_SELECTOR": (()=>DEFAULT_AGGREGATION_SELECTOR),
    "DEFAULT_AGGREGATION_TEMPORALITY_SELECTOR": (()=>DEFAULT_AGGREGATION_TEMPORALITY_SELECTOR)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/Aggregation.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationTemporality$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/AggregationTemporality.js [app-rsc] (ecmascript)");
;
;
var DEFAULT_AGGREGATION_SELECTOR = function(_instrumentType) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Aggregation"].Default();
};
var DEFAULT_AGGREGATION_TEMPORALITY_SELECTOR = function(_instrumentType) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationTemporality$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AggregationTemporality"].CUMULATIVE;
}; //# sourceMappingURL=AggregationSelector.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/ConsoleMetricExporter.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "ConsoleMetricExporter": (()=>ConsoleMetricExporter)
});
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
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/ExportResult.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationSelector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/AggregationSelector.js [app-rsc] (ecmascript)");
var __values = this && this.__values || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
;
;
/**
 * This is an implementation of {@link PushMetricExporter} that prints metrics to the
 * console. This class can be used for diagnostic purposes.
 *
 * NOTE: This {@link PushMetricExporter} is intended for diagnostics use only, output rendered to the console may change at any time.
 */ /* eslint-disable no-console */ var ConsoleMetricExporter = function() {
    function ConsoleMetricExporter(options) {
        var _a;
        this._shutdown = false;
        this._temporalitySelector = (_a = options === null || options === void 0 ? void 0 : options.temporalitySelector) !== null && _a !== void 0 ? _a : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationSelector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_AGGREGATION_TEMPORALITY_SELECTOR"];
    }
    ConsoleMetricExporter.prototype.export = function(metrics, resultCallback) {
        if (this._shutdown) {
            // If the exporter is shutting down, by spec, we need to return FAILED as export result
            setImmediate(resultCallback, {
                code: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"].FAILED
            });
            return;
        }
        return ConsoleMetricExporter._sendMetrics(metrics, resultCallback);
    };
    ConsoleMetricExporter.prototype.forceFlush = function() {
        return Promise.resolve();
    };
    ConsoleMetricExporter.prototype.selectAggregationTemporality = function(_instrumentType) {
        return this._temporalitySelector(_instrumentType);
    };
    ConsoleMetricExporter.prototype.shutdown = function() {
        this._shutdown = true;
        return Promise.resolve();
    };
    ConsoleMetricExporter._sendMetrics = function(metrics, done) {
        var e_1, _a, e_2, _b;
        try {
            for(var _c = __values(metrics.scopeMetrics), _d = _c.next(); !_d.done; _d = _c.next()){
                var scopeMetrics = _d.value;
                try {
                    for(var _e = (e_2 = void 0, __values(scopeMetrics.metrics)), _f = _e.next(); !_f.done; _f = _e.next()){
                        var metric = _f.value;
                        console.dir({
                            descriptor: metric.descriptor,
                            dataPointType: metric.dataPointType,
                            dataPoints: metric.dataPoints
                        }, {
                            depth: null
                        });
                    }
                } catch (e_2_1) {
                    e_2 = {
                        error: e_2_1
                    };
                } finally{
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    } finally{
                        if (e_2) throw e_2.error;
                    }
                }
            }
        } catch (e_1_1) {
            e_1 = {
                error: e_1_1
            };
        } finally{
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            } finally{
                if (e_1) throw e_1.error;
            }
        }
        done({
            code: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"].SUCCESS
        });
    };
    return ConsoleMetricExporter;
}();
;
 //# sourceMappingURL=ConsoleMetricExporter.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/InMemoryMetricExporter.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "InMemoryMetricExporter": (()=>InMemoryMetricExporter)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/ExportResult.js [app-rsc] (ecmascript)");
;
/**
 * In-memory Metrics Exporter is a Push Metric Exporter
 * which accumulates metrics data in the local memory and
 * allows to inspect it (useful for e.g. unit tests).
 */ var InMemoryMetricExporter = function() {
    function InMemoryMetricExporter(aggregationTemporality) {
        this._shutdown = false;
        this._metrics = [];
        this._aggregationTemporality = aggregationTemporality;
    }
    /**
     * @inheritedDoc
     */ InMemoryMetricExporter.prototype.export = function(metrics, resultCallback) {
        // Avoid storing metrics when exporter is shutdown
        if (this._shutdown) {
            setTimeout(function() {
                return resultCallback({
                    code: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"].FAILED
                });
            }, 0);
            return;
        }
        this._metrics.push(metrics);
        setTimeout(function() {
            return resultCallback({
                code: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"].SUCCESS
            });
        }, 0);
    };
    /**
     * Returns all the collected resource metrics
     * @returns ResourceMetrics[]
     */ InMemoryMetricExporter.prototype.getMetrics = function() {
        return this._metrics;
    };
    InMemoryMetricExporter.prototype.forceFlush = function() {
        return Promise.resolve();
    };
    InMemoryMetricExporter.prototype.reset = function() {
        this._metrics = [];
    };
    InMemoryMetricExporter.prototype.selectAggregationTemporality = function(_instrumentType) {
        return this._aggregationTemporality;
    };
    InMemoryMetricExporter.prototype.shutdown = function() {
        this._shutdown = true;
        return Promise.resolve();
    };
    return InMemoryMetricExporter;
}();
;
 //# sourceMappingURL=InMemoryMetricExporter.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MetricCollector.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "MetricCollector": (()=>MetricCollector)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/time.js [app-rsc] (ecmascript)");
var __awaiter = this && this.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = this && this.__generator || function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, f, y, t, g;
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    "TURBOPACK unreachable";
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
};
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
var __spreadArray = this && this.__spreadArray || function(to, from, pack) {
    if (pack || arguments.length === 2) for(var i = 0, l = from.length, ar; i < l; i++){
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
;
/**
 * An internal opaque interface that the MetricReader receives as
 * MetricProducer. It acts as the storage key to the internal metric stream
 * state for each MetricReader.
 */ var MetricCollector = function() {
    function MetricCollector(_sharedState, _metricReader) {
        this._sharedState = _sharedState;
        this._metricReader = _metricReader;
    }
    MetricCollector.prototype.collect = function(options) {
        return __awaiter(this, void 0, void 0, function() {
            var collectionTime, scopeMetrics, errors, meterCollectionPromises;
            var _this = this;
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        collectionTime = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["millisToHrTime"])(Date.now());
                        scopeMetrics = [];
                        errors = [];
                        meterCollectionPromises = Array.from(this._sharedState.meterSharedStates.values()).map(function(meterSharedState) {
                            return __awaiter(_this, void 0, void 0, function() {
                                var current;
                                return __generator(this, function(_a) {
                                    switch(_a.label){
                                        case 0:
                                            return [
                                                4 /*yield*/ ,
                                                meterSharedState.collect(this, collectionTime, options)
                                            ];
                                        case 1:
                                            current = _a.sent();
                                            // only add scope metrics if available
                                            if ((current === null || current === void 0 ? void 0 : current.scopeMetrics) != null) {
                                                scopeMetrics.push(current.scopeMetrics);
                                            }
                                            // only add errors if available
                                            if ((current === null || current === void 0 ? void 0 : current.errors) != null) {
                                                errors.push.apply(errors, __spreadArray([], __read(current.errors), false));
                                            }
                                            return [
                                                2 /*return*/ 
                                            ];
                                    }
                                });
                            });
                        });
                        return [
                            4 /*yield*/ ,
                            Promise.all(meterCollectionPromises)
                        ];
                    case 1:
                        _a.sent();
                        return [
                            2 /*return*/ ,
                            {
                                resourceMetrics: {
                                    resource: this._sharedState.resource,
                                    scopeMetrics: scopeMetrics
                                },
                                errors: errors
                            }
                        ];
                }
            });
        });
    };
    /**
     * Delegates for MetricReader.forceFlush.
     */ MetricCollector.prototype.forceFlush = function(options) {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        return [
                            4 /*yield*/ ,
                            this._metricReader.forceFlush(options)
                        ];
                    case 1:
                        _a.sent();
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    /**
     * Delegates for MetricReader.shutdown.
     */ MetricCollector.prototype.shutdown = function(options) {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        return [
                            4 /*yield*/ ,
                            this._metricReader.shutdown(options)
                        ];
                    case 1:
                        _a.sent();
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    MetricCollector.prototype.selectAggregationTemporality = function(instrumentType) {
        return this._metricReader.selectAggregationTemporality(instrumentType);
    };
    MetricCollector.prototype.selectAggregation = function(instrumentType) {
        return this._metricReader.selectAggregation(instrumentType);
    };
    return MetricCollector;
}();
;
 //# sourceMappingURL=MetricCollector.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/HashMap.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "AttributeHashMap": (()=>AttributeHashMap),
    "HashMap": (()=>HashMap)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/utils.js [app-rsc] (ecmascript)");
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
var __generator = this && this.__generator || function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, f, y, t, g;
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    "TURBOPACK unreachable";
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
};
;
var HashMap = function() {
    function HashMap(_hash) {
        this._hash = _hash;
        this._valueMap = new Map();
        this._keyMap = new Map();
    }
    HashMap.prototype.get = function(key, hashCode) {
        hashCode !== null && hashCode !== void 0 ? hashCode : hashCode = this._hash(key);
        return this._valueMap.get(hashCode);
    };
    HashMap.prototype.getOrDefault = function(key, defaultFactory) {
        var hash = this._hash(key);
        if (this._valueMap.has(hash)) {
            return this._valueMap.get(hash);
        }
        var val = defaultFactory();
        if (!this._keyMap.has(hash)) {
            this._keyMap.set(hash, key);
        }
        this._valueMap.set(hash, val);
        return val;
    };
    HashMap.prototype.set = function(key, value, hashCode) {
        hashCode !== null && hashCode !== void 0 ? hashCode : hashCode = this._hash(key);
        if (!this._keyMap.has(hashCode)) {
            this._keyMap.set(hashCode, key);
        }
        this._valueMap.set(hashCode, value);
    };
    HashMap.prototype.has = function(key, hashCode) {
        hashCode !== null && hashCode !== void 0 ? hashCode : hashCode = this._hash(key);
        return this._valueMap.has(hashCode);
    };
    HashMap.prototype.keys = function() {
        var keyIterator, next;
        return __generator(this, function(_a) {
            switch(_a.label){
                case 0:
                    keyIterator = this._keyMap.entries();
                    next = keyIterator.next();
                    _a.label = 1;
                case 1:
                    if (!(next.done !== true)) return [
                        3 /*break*/ ,
                        3
                    ];
                    return [
                        4 /*yield*/ ,
                        [
                            next.value[1],
                            next.value[0]
                        ]
                    ];
                case 2:
                    _a.sent();
                    next = keyIterator.next();
                    return [
                        3 /*break*/ ,
                        1
                    ];
                case 3:
                    return [
                        2 /*return*/ 
                    ];
            }
        });
    };
    HashMap.prototype.entries = function() {
        var valueIterator, next;
        return __generator(this, function(_a) {
            switch(_a.label){
                case 0:
                    valueIterator = this._valueMap.entries();
                    next = valueIterator.next();
                    _a.label = 1;
                case 1:
                    if (!(next.done !== true)) return [
                        3 /*break*/ ,
                        3
                    ];
                    // next.value[0] here can not be undefined
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    return [
                        4 /*yield*/ ,
                        [
                            this._keyMap.get(next.value[0]),
                            next.value[1],
                            next.value[0]
                        ]
                    ];
                case 2:
                    // next.value[0] here can not be undefined
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    _a.sent();
                    next = valueIterator.next();
                    return [
                        3 /*break*/ ,
                        1
                    ];
                case 3:
                    return [
                        2 /*return*/ 
                    ];
            }
        });
    };
    Object.defineProperty(HashMap.prototype, "size", {
        get: function() {
            return this._valueMap.size;
        },
        enumerable: false,
        configurable: true
    });
    return HashMap;
}();
;
var AttributeHashMap = function(_super) {
    __extends(AttributeHashMap, _super);
    function AttributeHashMap() {
        return _super.call(this, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["hashAttributes"]) || this;
    }
    return AttributeHashMap;
}(HashMap);
;
 //# sourceMappingURL=HashMap.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/DeltaMetricProcessor.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "DeltaMetricProcessor": (()=>DeltaMetricProcessor)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/HashMap.js [app-rsc] (ecmascript)");
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
;
/**
 * Internal interface.
 *
 * Allows synchronous collection of metrics. This processor should allow
 * allocation of new aggregation cells for metrics and convert cumulative
 * recording to delta data points.
 */ var DeltaMetricProcessor = function() {
    function DeltaMetricProcessor(_aggregator) {
        this._aggregator = _aggregator;
        this._activeCollectionStorage = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AttributeHashMap"]();
        // TODO: find a reasonable mean to clean the memo;
        // https://github.com/open-telemetry/opentelemetry-specification/pull/2208
        this._cumulativeMemoStorage = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AttributeHashMap"]();
    }
    DeltaMetricProcessor.prototype.record = function(value, attributes, _context, collectionTime) {
        var _this = this;
        var accumulation = this._activeCollectionStorage.getOrDefault(attributes, function() {
            return _this._aggregator.createAccumulation(collectionTime);
        });
        accumulation === null || accumulation === void 0 ? void 0 : accumulation.record(value);
    };
    DeltaMetricProcessor.prototype.batchCumulate = function(measurements, collectionTime) {
        var _this = this;
        Array.from(measurements.entries()).forEach(function(_a) {
            var _b = __read(_a, 3), attributes = _b[0], value = _b[1], hashCode = _b[2];
            var accumulation = _this._aggregator.createAccumulation(collectionTime);
            accumulation === null || accumulation === void 0 ? void 0 : accumulation.record(value);
            var delta = accumulation;
            // Diff with recorded cumulative memo.
            if (_this._cumulativeMemoStorage.has(attributes, hashCode)) {
                // has() returned true, previous is present.
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                var previous = _this._cumulativeMemoStorage.get(attributes, hashCode);
                delta = _this._aggregator.diff(previous, accumulation);
            }
            // Merge with uncollected active delta.
            if (_this._activeCollectionStorage.has(attributes, hashCode)) {
                // has() returned true, previous is present.
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                var active = _this._activeCollectionStorage.get(attributes, hashCode);
                delta = _this._aggregator.merge(active, delta);
            }
            // Save the current record and the delta record.
            _this._cumulativeMemoStorage.set(attributes, accumulation, hashCode);
            _this._activeCollectionStorage.set(attributes, delta, hashCode);
        });
    };
    /**
     * Returns a collection of delta metrics. Start time is the when first
     * time event collected.
     */ DeltaMetricProcessor.prototype.collect = function() {
        var unreportedDelta = this._activeCollectionStorage;
        this._activeCollectionStorage = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AttributeHashMap"]();
        return unreportedDelta;
    };
    return DeltaMetricProcessor;
}();
;
 //# sourceMappingURL=DeltaMetricProcessor.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/TemporalMetricProcessor.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "TemporalMetricProcessor": (()=>TemporalMetricProcessor)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationTemporality$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/AggregationTemporality.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/HashMap.js [app-rsc] (ecmascript)");
var __values = this && this.__values || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
;
;
/**
 * Internal interface.
 *
 * Provides unique reporting for each collector. Allows synchronous collection
 * of metrics and reports given temporality values.
 */ var TemporalMetricProcessor = function() {
    function TemporalMetricProcessor(_aggregator, collectorHandles) {
        var _this = this;
        this._aggregator = _aggregator;
        this._unreportedAccumulations = new Map();
        this._reportHistory = new Map();
        collectorHandles.forEach(function(handle) {
            _this._unreportedAccumulations.set(handle, []);
        });
    }
    /**
     * Builds the {@link MetricData} streams to report against a specific MetricCollector.
     * @param collector The information of the MetricCollector.
     * @param collectors The registered collectors.
     * @param instrumentDescriptor The instrumentation descriptor that these metrics generated with.
     * @param currentAccumulations The current accumulation of metric data from instruments.
     * @param collectionTime The current collection timestamp.
     * @returns The {@link MetricData} points or `null`.
     */ TemporalMetricProcessor.prototype.buildMetrics = function(collector, instrumentDescriptor, currentAccumulations, collectionTime) {
        this._stashAccumulations(currentAccumulations);
        var unreportedAccumulations = this._getMergedUnreportedAccumulations(collector);
        var result = unreportedAccumulations;
        var aggregationTemporality;
        // Check our last report time.
        if (this._reportHistory.has(collector)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            var last = this._reportHistory.get(collector);
            var lastCollectionTime = last.collectionTime;
            aggregationTemporality = last.aggregationTemporality;
            // Use aggregation temporality + instrument to determine if we do a merge or a diff of
            // previous. We have the following four scenarios:
            // 1. Cumulative Aggregation (temporality) + Delta recording (sync instrument).
            //    Here we merge with our last record to get a cumulative aggregation.
            // 2. Cumulative Aggregation + Cumulative recording (async instrument).
            //    Cumulative records are converted to delta recording with DeltaMetricProcessor.
            //    Here we merge with our last record to get a cumulative aggregation.
            // 3. Delta Aggregation + Delta recording
            //    Calibrate the startTime of metric streams to be the reader's lastCollectionTime.
            // 4. Delta Aggregation + Cumulative recording.
            //    Cumulative records are converted to delta recording with DeltaMetricProcessor.
            //    Calibrate the startTime of metric streams to be the reader's lastCollectionTime.
            if (aggregationTemporality === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationTemporality$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AggregationTemporality"].CUMULATIVE) {
                // We need to make sure the current delta recording gets merged into the previous cumulative
                // for the next cumulative recording.
                result = TemporalMetricProcessor.merge(last.accumulations, unreportedAccumulations, this._aggregator);
            } else {
                result = TemporalMetricProcessor.calibrateStartTime(last.accumulations, unreportedAccumulations, lastCollectionTime);
            }
        } else {
            // Call into user code to select aggregation temporality for the instrument.
            aggregationTemporality = collector.selectAggregationTemporality(instrumentDescriptor.type);
        }
        // Update last reported (cumulative) accumulation.
        this._reportHistory.set(collector, {
            accumulations: result,
            collectionTime: collectionTime,
            aggregationTemporality: aggregationTemporality
        });
        var accumulationRecords = AttributesMapToAccumulationRecords(result);
        // do not convert to metric data if there is nothing to convert.
        if (accumulationRecords.length === 0) {
            return undefined;
        }
        return this._aggregator.toMetricData(instrumentDescriptor, aggregationTemporality, accumulationRecords, /* endTime */ collectionTime);
    };
    TemporalMetricProcessor.prototype._stashAccumulations = function(currentAccumulation) {
        var e_1, _a;
        var registeredCollectors = this._unreportedAccumulations.keys();
        try {
            for(var registeredCollectors_1 = __values(registeredCollectors), registeredCollectors_1_1 = registeredCollectors_1.next(); !registeredCollectors_1_1.done; registeredCollectors_1_1 = registeredCollectors_1.next()){
                var collector = registeredCollectors_1_1.value;
                var stash = this._unreportedAccumulations.get(collector);
                if (stash === undefined) {
                    stash = [];
                    this._unreportedAccumulations.set(collector, stash);
                }
                stash.push(currentAccumulation);
            }
        } catch (e_1_1) {
            e_1 = {
                error: e_1_1
            };
        } finally{
            try {
                if (registeredCollectors_1_1 && !registeredCollectors_1_1.done && (_a = registeredCollectors_1.return)) _a.call(registeredCollectors_1);
            } finally{
                if (e_1) throw e_1.error;
            }
        }
    };
    TemporalMetricProcessor.prototype._getMergedUnreportedAccumulations = function(collector) {
        var e_2, _a;
        var result = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AttributeHashMap"]();
        var unreportedList = this._unreportedAccumulations.get(collector);
        this._unreportedAccumulations.set(collector, []);
        if (unreportedList === undefined) {
            return result;
        }
        try {
            for(var unreportedList_1 = __values(unreportedList), unreportedList_1_1 = unreportedList_1.next(); !unreportedList_1_1.done; unreportedList_1_1 = unreportedList_1.next()){
                var it_1 = unreportedList_1_1.value;
                result = TemporalMetricProcessor.merge(result, it_1, this._aggregator);
            }
        } catch (e_2_1) {
            e_2 = {
                error: e_2_1
            };
        } finally{
            try {
                if (unreportedList_1_1 && !unreportedList_1_1.done && (_a = unreportedList_1.return)) _a.call(unreportedList_1);
            } finally{
                if (e_2) throw e_2.error;
            }
        }
        return result;
    };
    TemporalMetricProcessor.merge = function(last, current, aggregator) {
        var result = last;
        var iterator = current.entries();
        var next = iterator.next();
        while(next.done !== true){
            var _a = __read(next.value, 3), key = _a[0], record = _a[1], hash = _a[2];
            if (last.has(key, hash)) {
                var lastAccumulation = last.get(key, hash);
                // last.has() returned true, lastAccumulation is present.
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                var accumulation = aggregator.merge(lastAccumulation, record);
                result.set(key, accumulation, hash);
            } else {
                result.set(key, record, hash);
            }
            next = iterator.next();
        }
        return result;
    };
    /**
     * Calibrate the reported metric streams' startTime to lastCollectionTime. Leaves
     * the new stream to be the initial observation time unchanged.
     */ TemporalMetricProcessor.calibrateStartTime = function(last, current, lastCollectionTime) {
        var e_3, _a;
        try {
            for(var _b = __values(last.keys()), _c = _b.next(); !_c.done; _c = _b.next()){
                var _d = __read(_c.value, 2), key = _d[0], hash = _d[1];
                var currentAccumulation = current.get(key, hash);
                currentAccumulation === null || currentAccumulation === void 0 ? void 0 : currentAccumulation.setStartTime(lastCollectionTime);
            }
        } catch (e_3_1) {
            e_3 = {
                error: e_3_1
            };
        } finally{
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            } finally{
                if (e_3) throw e_3.error;
            }
        }
        return current;
    };
    return TemporalMetricProcessor;
}();
;
// TypeScript complains about converting 3 elements tuple to AccumulationRecord<T>.
function AttributesMapToAccumulationRecords(map) {
    return Array.from(map.entries());
} //# sourceMappingURL=TemporalMetricProcessor.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MetricStorage.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "MetricStorage": (()=>MetricStorage)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/InstrumentDescriptor.js [app-rsc] (ecmascript)");
;
/**
 * Internal interface.
 *
 * Represents a storage from which we can collect metrics.
 */ var MetricStorage = function() {
    function MetricStorage(_instrumentDescriptor) {
        this._instrumentDescriptor = _instrumentDescriptor;
    }
    MetricStorage.prototype.getInstrumentDescriptor = function() {
        return this._instrumentDescriptor;
    };
    MetricStorage.prototype.updateDescription = function(description) {
        this._instrumentDescriptor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createInstrumentDescriptor"])(this._instrumentDescriptor.name, this._instrumentDescriptor.type, {
            description: description,
            valueType: this._instrumentDescriptor.valueType,
            unit: this._instrumentDescriptor.unit,
            advice: this._instrumentDescriptor.advice
        });
    };
    return MetricStorage;
}();
;
 //# sourceMappingURL=MetricStorage.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/SyncMetricStorage.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "SyncMetricStorage": (()=>SyncMetricStorage)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$DeltaMetricProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/DeltaMetricProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$TemporalMetricProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/TemporalMetricProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MetricStorage$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MetricStorage.js [app-rsc] (ecmascript)");
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
;
;
;
/**
 * Internal interface.
 *
 * Stores and aggregates {@link MetricData} for synchronous instruments.
 */ var SyncMetricStorage = function(_super) {
    __extends(SyncMetricStorage, _super);
    function SyncMetricStorage(instrumentDescriptor, aggregator, _attributesProcessor, collectorHandles) {
        var _this = _super.call(this, instrumentDescriptor) || this;
        _this._attributesProcessor = _attributesProcessor;
        _this._deltaMetricStorage = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$DeltaMetricProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DeltaMetricProcessor"](aggregator);
        _this._temporalMetricStorage = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$TemporalMetricProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TemporalMetricProcessor"](aggregator, collectorHandles);
        return _this;
    }
    SyncMetricStorage.prototype.record = function(value, attributes, context, recordTime) {
        attributes = this._attributesProcessor.process(attributes, context);
        this._deltaMetricStorage.record(value, attributes, context, recordTime);
    };
    /**
     * Collects the metrics from this storage.
     *
     * Note: This is a stateful operation and may reset any interval-related
     * state for the MetricCollector.
     */ SyncMetricStorage.prototype.collect = function(collector, collectionTime) {
        var accumulations = this._deltaMetricStorage.collect();
        return this._temporalMetricStorage.buildMetrics(collector, this._instrumentDescriptor, accumulations, collectionTime);
    };
    return SyncMetricStorage;
}(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MetricStorage$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MetricStorage"]);
;
 //# sourceMappingURL=SyncMetricStorage.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MultiWritableMetricStorage.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ /**
 * Internal interface.
 */ __turbopack_esm__({
    "MultiMetricStorage": (()=>MultiMetricStorage)
});
var MultiMetricStorage = function() {
    function MultiMetricStorage(_backingStorages) {
        this._backingStorages = _backingStorages;
    }
    MultiMetricStorage.prototype.record = function(value, attributes, context, recordTime) {
        this._backingStorages.forEach(function(it) {
            it.record(value, attributes, context, recordTime);
        });
    };
    return MultiMetricStorage;
}();
;
 //# sourceMappingURL=MultiWritableMetricStorage.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/AsyncMetricStorage.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "AsyncMetricStorage": (()=>AsyncMetricStorage)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/HashMap.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$DeltaMetricProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/DeltaMetricProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$TemporalMetricProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/TemporalMetricProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MetricStorage$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MetricStorage.js [app-rsc] (ecmascript)");
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
;
;
;
;
/**
 * Internal interface.
 *
 * Stores and aggregates {@link MetricData} for asynchronous instruments.
 */ var AsyncMetricStorage = function(_super) {
    __extends(AsyncMetricStorage, _super);
    function AsyncMetricStorage(_instrumentDescriptor, aggregator, _attributesProcessor, collectorHandles) {
        var _this = _super.call(this, _instrumentDescriptor) || this;
        _this._attributesProcessor = _attributesProcessor;
        _this._deltaMetricStorage = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$DeltaMetricProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DeltaMetricProcessor"](aggregator);
        _this._temporalMetricStorage = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$TemporalMetricProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TemporalMetricProcessor"](aggregator, collectorHandles);
        return _this;
    }
    AsyncMetricStorage.prototype.record = function(measurements, observationTime) {
        var _this = this;
        var processed = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AttributeHashMap"]();
        Array.from(measurements.entries()).forEach(function(_a) {
            var _b = __read(_a, 2), attributes = _b[0], value = _b[1];
            processed.set(_this._attributesProcessor.process(attributes), value);
        });
        this._deltaMetricStorage.batchCumulate(processed, observationTime);
    };
    /**
     * Collects the metrics from this storage. The ObservableCallback is invoked
     * during the collection.
     *
     * Note: This is a stateful operation and may reset any interval-related
     * state for the MetricCollector.
     */ AsyncMetricStorage.prototype.collect = function(collector, collectionTime) {
        var accumulations = this._deltaMetricStorage.collect();
        return this._temporalMetricStorage.buildMetrics(collector, this._instrumentDescriptor, accumulations, collectionTime);
    };
    return AsyncMetricStorage;
}(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MetricStorage$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MetricStorage"]);
;
 //# sourceMappingURL=AsyncMetricStorage.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/AttributesProcessor.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "AttributesProcessor": (()=>AttributesProcessor),
    "FilteringAttributesProcessor": (()=>FilteringAttributesProcessor),
    "NoopAttributesProcessor": (()=>NoopAttributesProcessor)
});
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
/**
 * The {@link AttributesProcessor} is responsible for customizing which
 * attribute(s) are to be reported as metrics dimension(s) and adding
 * additional dimension(s) from the {@link Context}.
 */ var AttributesProcessor = function() {
    function AttributesProcessor() {}
    AttributesProcessor.Noop = function() {
        return NOOP;
    };
    return AttributesProcessor;
}();
;
var NoopAttributesProcessor = function(_super) {
    __extends(NoopAttributesProcessor, _super);
    function NoopAttributesProcessor() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    NoopAttributesProcessor.prototype.process = function(incoming, _context) {
        return incoming;
    };
    return NoopAttributesProcessor;
}(AttributesProcessor);
;
/**
 * {@link AttributesProcessor} that filters by allowed attribute names and drops any names that are not in the
 * allow list.
 */ var FilteringAttributesProcessor = function(_super) {
    __extends(FilteringAttributesProcessor, _super);
    function FilteringAttributesProcessor(_allowedAttributeNames) {
        var _this = _super.call(this) || this;
        _this._allowedAttributeNames = _allowedAttributeNames;
        return _this;
    }
    FilteringAttributesProcessor.prototype.process = function(incoming, _context) {
        var _this = this;
        var filteredAttributes = {};
        Object.keys(incoming).filter(function(attributeName) {
            return _this._allowedAttributeNames.includes(attributeName);
        }).forEach(function(attributeName) {
            return filteredAttributes[attributeName] = incoming[attributeName];
        });
        return filteredAttributes;
    };
    return FilteringAttributesProcessor;
}(AttributesProcessor);
;
var NOOP = new NoopAttributesProcessor(); //# sourceMappingURL=AttributesProcessor.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/RegistrationConflicts.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "getConflictResolutionRecipe": (()=>getConflictResolutionRecipe),
    "getDescriptionResolutionRecipe": (()=>getDescriptionResolutionRecipe),
    "getIncompatibilityDetails": (()=>getIncompatibilityDetails),
    "getTypeConflictResolutionRecipe": (()=>getTypeConflictResolutionRecipe),
    "getUnitConflictResolutionRecipe": (()=>getUnitConflictResolutionRecipe),
    "getValueTypeConflictResolutionRecipe": (()=>getValueTypeConflictResolutionRecipe)
});
function getIncompatibilityDetails(existing, otherDescriptor) {
    var incompatibility = '';
    if (existing.unit !== otherDescriptor.unit) {
        incompatibility += "\t- Unit '" + existing.unit + "' does not match '" + otherDescriptor.unit + "'\n";
    }
    if (existing.type !== otherDescriptor.type) {
        incompatibility += "\t- Type '" + existing.type + "' does not match '" + otherDescriptor.type + "'\n";
    }
    if (existing.valueType !== otherDescriptor.valueType) {
        incompatibility += "\t- Value Type '" + existing.valueType + "' does not match '" + otherDescriptor.valueType + "'\n";
    }
    if (existing.description !== otherDescriptor.description) {
        incompatibility += "\t- Description '" + existing.description + "' does not match '" + otherDescriptor.description + "'\n";
    }
    return incompatibility;
}
function getValueTypeConflictResolutionRecipe(existing, otherDescriptor) {
    return "\t- use valueType '" + existing.valueType + "' on instrument creation or use an instrument name other than '" + otherDescriptor.name + "'";
}
function getUnitConflictResolutionRecipe(existing, otherDescriptor) {
    return "\t- use unit '" + existing.unit + "' on instrument creation or use an instrument name other than '" + otherDescriptor.name + "'";
}
function getTypeConflictResolutionRecipe(existing, otherDescriptor) {
    var selector = {
        name: otherDescriptor.name,
        type: otherDescriptor.type,
        unit: otherDescriptor.unit
    };
    var selectorString = JSON.stringify(selector);
    return "\t- create a new view with a name other than '" + existing.name + "' and InstrumentSelector '" + selectorString + "'";
}
function getDescriptionResolutionRecipe(existing, otherDescriptor) {
    var selector = {
        name: otherDescriptor.name,
        type: otherDescriptor.type,
        unit: otherDescriptor.unit
    };
    var selectorString = JSON.stringify(selector);
    return "\t- create a new view with a name other than '" + existing.name + "' and InstrumentSelector '" + selectorString + "'\n    \t- OR - create a new view with the name " + existing.name + " and description '" + existing.description + "' and InstrumentSelector " + selectorString + "\n    \t- OR - create a new view with the name " + otherDescriptor.name + " and description '" + existing.description + "' and InstrumentSelector " + selectorString;
}
function getConflictResolutionRecipe(existing, otherDescriptor) {
    // Conflicts that cannot be solved via views.
    if (existing.valueType !== otherDescriptor.valueType) {
        return getValueTypeConflictResolutionRecipe(existing, otherDescriptor);
    }
    if (existing.unit !== otherDescriptor.unit) {
        return getUnitConflictResolutionRecipe(existing, otherDescriptor);
    }
    // Conflicts that can be solved via views.
    if (existing.type !== otherDescriptor.type) {
        // this will automatically solve possible description conflicts.
        return getTypeConflictResolutionRecipe(existing, otherDescriptor);
    }
    if (existing.description !== otherDescriptor.description) {
        return getDescriptionResolutionRecipe(existing, otherDescriptor);
    }
    return '';
} //# sourceMappingURL=RegistrationConflicts.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MetricStorageRegistry.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "MetricStorageRegistry": (()=>MetricStorageRegistry)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/InstrumentDescriptor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$RegistrationConflicts$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/RegistrationConflicts.js [app-rsc] (ecmascript)");
var __values = this && this.__values || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
;
;
;
/**
 * Internal class for storing {@link MetricStorage}
 */ var MetricStorageRegistry = function() {
    function MetricStorageRegistry() {
        this._sharedRegistry = new Map();
        this._perCollectorRegistry = new Map();
    }
    MetricStorageRegistry.create = function() {
        return new MetricStorageRegistry();
    };
    MetricStorageRegistry.prototype.getStorages = function(collector) {
        var e_1, _a, e_2, _b;
        var storages = [];
        try {
            for(var _c = __values(this._sharedRegistry.values()), _d = _c.next(); !_d.done; _d = _c.next()){
                var metricStorages = _d.value;
                storages = storages.concat(metricStorages);
            }
        } catch (e_1_1) {
            e_1 = {
                error: e_1_1
            };
        } finally{
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            } finally{
                if (e_1) throw e_1.error;
            }
        }
        var perCollectorStorages = this._perCollectorRegistry.get(collector);
        if (perCollectorStorages != null) {
            try {
                for(var _e = __values(perCollectorStorages.values()), _f = _e.next(); !_f.done; _f = _e.next()){
                    var metricStorages = _f.value;
                    storages = storages.concat(metricStorages);
                }
            } catch (e_2_1) {
                e_2 = {
                    error: e_2_1
                };
            } finally{
                try {
                    if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                } finally{
                    if (e_2) throw e_2.error;
                }
            }
        }
        return storages;
    };
    MetricStorageRegistry.prototype.register = function(storage) {
        this._registerStorage(storage, this._sharedRegistry);
    };
    MetricStorageRegistry.prototype.registerForCollector = function(collector, storage) {
        var storageMap = this._perCollectorRegistry.get(collector);
        if (storageMap == null) {
            storageMap = new Map();
            this._perCollectorRegistry.set(collector, storageMap);
        }
        this._registerStorage(storage, storageMap);
    };
    MetricStorageRegistry.prototype.findOrUpdateCompatibleStorage = function(expectedDescriptor) {
        var storages = this._sharedRegistry.get(expectedDescriptor.name);
        if (storages === undefined) {
            return null;
        }
        // If the descriptor is compatible, the type of their metric storage
        // (either SyncMetricStorage or AsyncMetricStorage) must be compatible.
        return this._findOrUpdateCompatibleStorage(expectedDescriptor, storages);
    };
    MetricStorageRegistry.prototype.findOrUpdateCompatibleCollectorStorage = function(collector, expectedDescriptor) {
        var storageMap = this._perCollectorRegistry.get(collector);
        if (storageMap === undefined) {
            return null;
        }
        var storages = storageMap.get(expectedDescriptor.name);
        if (storages === undefined) {
            return null;
        }
        // If the descriptor is compatible, the type of their metric storage
        // (either SyncMetricStorage or AsyncMetricStorage) must be compatible.
        return this._findOrUpdateCompatibleStorage(expectedDescriptor, storages);
    };
    MetricStorageRegistry.prototype._registerStorage = function(storage, storageMap) {
        var descriptor = storage.getInstrumentDescriptor();
        var storages = storageMap.get(descriptor.name);
        if (storages === undefined) {
            storageMap.set(descriptor.name, [
                storage
            ]);
            return;
        }
        storages.push(storage);
    };
    MetricStorageRegistry.prototype._findOrUpdateCompatibleStorage = function(expectedDescriptor, existingStorages) {
        var e_3, _a;
        var compatibleStorage = null;
        try {
            for(var existingStorages_1 = __values(existingStorages), existingStorages_1_1 = existingStorages_1.next(); !existingStorages_1_1.done; existingStorages_1_1 = existingStorages_1.next()){
                var existingStorage = existingStorages_1_1.value;
                var existingDescriptor = existingStorage.getInstrumentDescriptor();
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isDescriptorCompatibleWith"])(existingDescriptor, expectedDescriptor)) {
                    // Use the longer description if it does not match.
                    if (existingDescriptor.description !== expectedDescriptor.description) {
                        if (expectedDescriptor.description.length > existingDescriptor.description.length) {
                            existingStorage.updateDescription(expectedDescriptor.description);
                        }
                        __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.diag.warn('A view or instrument with the name ', expectedDescriptor.name, ' has already been registered, but has a different description and is incompatible with another registered view.\n', 'Details:\n', (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$RegistrationConflicts$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getIncompatibilityDetails"])(existingDescriptor, expectedDescriptor), 'The longer description will be used.\nTo resolve the conflict:', (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$RegistrationConflicts$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getConflictResolutionRecipe"])(existingDescriptor, expectedDescriptor));
                    }
                    // Storage is fully compatible. There will never be more than one pre-existing fully compatible storage.
                    compatibleStorage = existingStorage;
                } else {
                    // The implementation SHOULD warn about duplicate instrument registration
                    // conflicts after applying View configuration.
                    __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.diag.warn('A view or instrument with the name ', expectedDescriptor.name, ' has already been registered and is incompatible with another registered view.\n', 'Details:\n', (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$RegistrationConflicts$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getIncompatibilityDetails"])(existingDescriptor, expectedDescriptor), 'To resolve the conflict:\n', (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$RegistrationConflicts$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getConflictResolutionRecipe"])(existingDescriptor, expectedDescriptor));
                }
            }
        } catch (e_3_1) {
            e_3 = {
                error: e_3_1
            };
        } finally{
            try {
                if (existingStorages_1_1 && !existingStorages_1_1.done && (_a = existingStorages_1.return)) _a.call(existingStorages_1);
            } finally{
                if (e_3) throw e_3.error;
            }
        }
        return compatibleStorage;
    };
    return MetricStorageRegistry;
}();
;
 //# sourceMappingURL=MetricStorageRegistry.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/Instruments.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "CounterInstrument": (()=>CounterInstrument),
    "GaugeInstrument": (()=>GaugeInstrument),
    "HistogramInstrument": (()=>HistogramInstrument),
    "ObservableCounterInstrument": (()=>ObservableCounterInstrument),
    "ObservableGaugeInstrument": (()=>ObservableGaugeInstrument),
    "ObservableInstrument": (()=>ObservableInstrument),
    "ObservableUpDownCounterInstrument": (()=>ObservableUpDownCounterInstrument),
    "SyncInstrument": (()=>SyncInstrument),
    "UpDownCounterInstrument": (()=>UpDownCounterInstrument),
    "isObservableInstrument": (()=>isObservableInstrument)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/time.js [app-rsc] (ecmascript)");
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
;
;
var SyncInstrument = function() {
    function SyncInstrument(_writableMetricStorage, _descriptor) {
        this._writableMetricStorage = _writableMetricStorage;
        this._descriptor = _descriptor;
    }
    SyncInstrument.prototype._record = function(value, attributes, context) {
        if (attributes === void 0) {
            attributes = {};
        }
        if (context === void 0) {
            context = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["context"].active();
        }
        if (typeof value !== 'number') {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("non-number value provided to metric " + this._descriptor.name + ": " + value);
            return;
        }
        if (this._descriptor.valueType === __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["ValueType"].INT && !Number.isInteger(value)) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("INT value type cannot accept a floating-point value for " + this._descriptor.name + ", ignoring the fractional digits.");
            value = Math.trunc(value);
            // ignore non-finite values.
            if (!Number.isInteger(value)) {
                return;
            }
        }
        this._writableMetricStorage.record(value, attributes, context, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$time$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["millisToHrTime"])(Date.now()));
    };
    return SyncInstrument;
}();
;
/**
 * The class implements {@link UpDownCounter} interface.
 */ var UpDownCounterInstrument = function(_super) {
    __extends(UpDownCounterInstrument, _super);
    function UpDownCounterInstrument() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Increment value of counter by the input. Inputs may be negative.
     */ UpDownCounterInstrument.prototype.add = function(value, attributes, ctx) {
        this._record(value, attributes, ctx);
    };
    return UpDownCounterInstrument;
}(SyncInstrument);
;
/**
 * The class implements {@link Counter} interface.
 */ var CounterInstrument = function(_super) {
    __extends(CounterInstrument, _super);
    function CounterInstrument() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Increment value of counter by the input. Inputs may not be negative.
     */ CounterInstrument.prototype.add = function(value, attributes, ctx) {
        if (value < 0) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("negative value provided to counter " + this._descriptor.name + ": " + value);
            return;
        }
        this._record(value, attributes, ctx);
    };
    return CounterInstrument;
}(SyncInstrument);
;
/**
 * The class implements {@link Gauge} interface.
 */ var GaugeInstrument = function(_super) {
    __extends(GaugeInstrument, _super);
    function GaugeInstrument() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Records a measurement.
     */ GaugeInstrument.prototype.record = function(value, attributes, ctx) {
        this._record(value, attributes, ctx);
    };
    return GaugeInstrument;
}(SyncInstrument);
;
/**
 * The class implements {@link Histogram} interface.
 */ var HistogramInstrument = function(_super) {
    __extends(HistogramInstrument, _super);
    function HistogramInstrument() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Records a measurement. Value of the measurement must not be negative.
     */ HistogramInstrument.prototype.record = function(value, attributes, ctx) {
        if (value < 0) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("negative value provided to histogram " + this._descriptor.name + ": " + value);
            return;
        }
        this._record(value, attributes, ctx);
    };
    return HistogramInstrument;
}(SyncInstrument);
;
var ObservableInstrument = function() {
    function ObservableInstrument(descriptor, metricStorages, _observableRegistry) {
        this._observableRegistry = _observableRegistry;
        this._descriptor = descriptor;
        this._metricStorages = metricStorages;
    }
    /**
     * @see {Observable.addCallback}
     */ ObservableInstrument.prototype.addCallback = function(callback) {
        this._observableRegistry.addCallback(callback, this);
    };
    /**
     * @see {Observable.removeCallback}
     */ ObservableInstrument.prototype.removeCallback = function(callback) {
        this._observableRegistry.removeCallback(callback, this);
    };
    return ObservableInstrument;
}();
;
var ObservableCounterInstrument = function(_super) {
    __extends(ObservableCounterInstrument, _super);
    function ObservableCounterInstrument() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ObservableCounterInstrument;
}(ObservableInstrument);
;
var ObservableGaugeInstrument = function(_super) {
    __extends(ObservableGaugeInstrument, _super);
    function ObservableGaugeInstrument() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ObservableGaugeInstrument;
}(ObservableInstrument);
;
var ObservableUpDownCounterInstrument = function(_super) {
    __extends(ObservableUpDownCounterInstrument, _super);
    function ObservableUpDownCounterInstrument() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ObservableUpDownCounterInstrument;
}(ObservableInstrument);
;
function isObservableInstrument(it) {
    return it instanceof ObservableInstrument;
} //# sourceMappingURL=Instruments.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/ObservableResult.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "BatchObservableResultImpl": (()=>BatchObservableResultImpl),
    "ObservableResultImpl": (()=>ObservableResultImpl)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/HashMap.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/Instruments.js [app-rsc] (ecmascript)");
;
;
;
/**
 * The class implements {@link ObservableResult} interface.
 */ var ObservableResultImpl = function() {
    function ObservableResultImpl(_instrumentName, _valueType) {
        this._instrumentName = _instrumentName;
        this._valueType = _valueType;
        /**
         * @internal
         */ this._buffer = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AttributeHashMap"]();
    }
    /**
     * Observe a measurement of the value associated with the given attributes.
     */ ObservableResultImpl.prototype.observe = function(value, attributes) {
        if (attributes === void 0) {
            attributes = {};
        }
        if (typeof value !== 'number') {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("non-number value provided to metric " + this._instrumentName + ": " + value);
            return;
        }
        if (this._valueType === __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["ValueType"].INT && !Number.isInteger(value)) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("INT value type cannot accept a floating-point value for " + this._instrumentName + ", ignoring the fractional digits.");
            value = Math.trunc(value);
            // ignore non-finite values.
            if (!Number.isInteger(value)) {
                return;
            }
        }
        this._buffer.set(attributes, value);
    };
    return ObservableResultImpl;
}();
;
/**
 * The class implements {@link BatchObservableCallback} interface.
 */ var BatchObservableResultImpl = function() {
    function BatchObservableResultImpl() {
        /**
         * @internal
         */ this._buffer = new Map();
    }
    /**
     * Observe a measurement of the value associated with the given attributes.
     */ BatchObservableResultImpl.prototype.observe = function(metric, value, attributes) {
        if (attributes === void 0) {
            attributes = {};
        }
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isObservableInstrument"])(metric)) {
            return;
        }
        var map = this._buffer.get(metric);
        if (map == null) {
            map = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$HashMap$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AttributeHashMap"]();
            this._buffer.set(metric, map);
        }
        if (typeof value !== 'number') {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("non-number value provided to metric " + metric._descriptor.name + ": " + value);
            return;
        }
        if (metric._descriptor.valueType === __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["ValueType"].INT && !Number.isInteger(value)) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn("INT value type cannot accept a floating-point value for " + metric._descriptor.name + ", ignoring the fractional digits.");
            value = Math.trunc(value);
            // ignore non-finite values.
            if (!Number.isInteger(value)) {
                return;
            }
        }
        map.set(attributes, value);
    };
    return BatchObservableResultImpl;
}();
;
 //# sourceMappingURL=ObservableResult.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/ObservableRegistry.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "ObservableRegistry": (()=>ObservableRegistry)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/Instruments.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$ObservableResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/ObservableResult.js [app-rsc] (ecmascript)");
var __awaiter = this && this.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = this && this.__generator || function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, f, y, t, g;
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    "TURBOPACK unreachable";
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
};
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
var __spreadArray = this && this.__spreadArray || function(to, from, pack) {
    if (pack || arguments.length === 2) for(var i = 0, l = from.length, ar; i < l; i++){
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
;
;
;
;
/**
 * An internal interface for managing ObservableCallbacks.
 *
 * Every registered callback associated with a set of instruments are be evaluated
 * exactly once during collection prior to reading data for that instrument.
 */ var ObservableRegistry = function() {
    function ObservableRegistry() {
        this._callbacks = [];
        this._batchCallbacks = [];
    }
    ObservableRegistry.prototype.addCallback = function(callback, instrument) {
        var idx = this._findCallback(callback, instrument);
        if (idx >= 0) {
            return;
        }
        this._callbacks.push({
            callback: callback,
            instrument: instrument
        });
    };
    ObservableRegistry.prototype.removeCallback = function(callback, instrument) {
        var idx = this._findCallback(callback, instrument);
        if (idx < 0) {
            return;
        }
        this._callbacks.splice(idx, 1);
    };
    ObservableRegistry.prototype.addBatchCallback = function(callback, instruments) {
        // Create a set of unique instruments.
        var observableInstruments = new Set(instruments.filter(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isObservableInstrument"]));
        if (observableInstruments.size === 0) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].error('BatchObservableCallback is not associated with valid instruments', instruments);
            return;
        }
        var idx = this._findBatchCallback(callback, observableInstruments);
        if (idx >= 0) {
            return;
        }
        this._batchCallbacks.push({
            callback: callback,
            instruments: observableInstruments
        });
    };
    ObservableRegistry.prototype.removeBatchCallback = function(callback, instruments) {
        // Create a set of unique instruments.
        var observableInstruments = new Set(instruments.filter(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isObservableInstrument"]));
        var idx = this._findBatchCallback(callback, observableInstruments);
        if (idx < 0) {
            return;
        }
        this._batchCallbacks.splice(idx, 1);
    };
    /**
     * @returns a promise of rejected reasons for invoking callbacks.
     */ ObservableRegistry.prototype.observe = function(collectionTime, timeoutMillis) {
        return __awaiter(this, void 0, void 0, function() {
            var callbackFutures, batchCallbackFutures, results, rejections;
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        callbackFutures = this._observeCallbacks(collectionTime, timeoutMillis);
                        batchCallbackFutures = this._observeBatchCallbacks(collectionTime, timeoutMillis);
                        return [
                            4 /*yield*/ ,
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["PromiseAllSettled"])(__spreadArray(__spreadArray([], __read(callbackFutures), false), __read(batchCallbackFutures), false))
                        ];
                    case 1:
                        results = _a.sent();
                        rejections = results.filter(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isPromiseAllSettledRejectionResult"]).map(function(it) {
                            return it.reason;
                        });
                        return [
                            2 /*return*/ ,
                            rejections
                        ];
                }
            });
        });
    };
    ObservableRegistry.prototype._observeCallbacks = function(observationTime, timeoutMillis) {
        var _this = this;
        return this._callbacks.map(function(_a) {
            var callback = _a.callback, instrument = _a.instrument;
            return __awaiter(_this, void 0, void 0, function() {
                var observableResult, callPromise;
                return __generator(this, function(_b) {
                    switch(_b.label){
                        case 0:
                            observableResult = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$ObservableResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ObservableResultImpl"](instrument._descriptor.name, instrument._descriptor.valueType);
                            callPromise = Promise.resolve(callback(observableResult));
                            if (timeoutMillis != null) {
                                callPromise = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["callWithTimeout"])(callPromise, timeoutMillis);
                            }
                            return [
                                4 /*yield*/ ,
                                callPromise
                            ];
                        case 1:
                            _b.sent();
                            instrument._metricStorages.forEach(function(metricStorage) {
                                metricStorage.record(observableResult._buffer, observationTime);
                            });
                            return [
                                2 /*return*/ 
                            ];
                    }
                });
            });
        });
    };
    ObservableRegistry.prototype._observeBatchCallbacks = function(observationTime, timeoutMillis) {
        var _this = this;
        return this._batchCallbacks.map(function(_a) {
            var callback = _a.callback, instruments = _a.instruments;
            return __awaiter(_this, void 0, void 0, function() {
                var observableResult, callPromise;
                return __generator(this, function(_b) {
                    switch(_b.label){
                        case 0:
                            observableResult = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$ObservableResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BatchObservableResultImpl"]();
                            callPromise = Promise.resolve(callback(observableResult));
                            if (timeoutMillis != null) {
                                callPromise = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["callWithTimeout"])(callPromise, timeoutMillis);
                            }
                            return [
                                4 /*yield*/ ,
                                callPromise
                            ];
                        case 1:
                            _b.sent();
                            instruments.forEach(function(instrument) {
                                var buffer = observableResult._buffer.get(instrument);
                                if (buffer == null) {
                                    return;
                                }
                                instrument._metricStorages.forEach(function(metricStorage) {
                                    metricStorage.record(buffer, observationTime);
                                });
                            });
                            return [
                                2 /*return*/ 
                            ];
                    }
                });
            });
        });
    };
    ObservableRegistry.prototype._findCallback = function(callback, instrument) {
        return this._callbacks.findIndex(function(record) {
            return record.callback === callback && record.instrument === instrument;
        });
    };
    ObservableRegistry.prototype._findBatchCallback = function(callback, instruments) {
        return this._batchCallbacks.findIndex(function(record) {
            return record.callback === callback && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setEquals"])(record.instruments, instruments);
        });
    };
    return ObservableRegistry;
}();
;
 //# sourceMappingURL=ObservableRegistry.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/Meter.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "Meter": (()=>Meter)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/InstrumentDescriptor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/Instruments.js [app-rsc] (ecmascript)");
;
;
/**
 * This class implements the {@link IMeter} interface.
 */ var Meter = function() {
    function Meter(_meterSharedState) {
        this._meterSharedState = _meterSharedState;
    }
    /**
     * Create a {@link Gauge} instrument.
     */ Meter.prototype.createGauge = function(name, options) {
        var descriptor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createInstrumentDescriptor"])(name, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].GAUGE, options);
        var storage = this._meterSharedState.registerMetricStorage(descriptor);
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["GaugeInstrument"](storage, descriptor);
    };
    /**
     * Create a {@link Histogram} instrument.
     */ Meter.prototype.createHistogram = function(name, options) {
        var descriptor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createInstrumentDescriptor"])(name, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].HISTOGRAM, options);
        var storage = this._meterSharedState.registerMetricStorage(descriptor);
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["HistogramInstrument"](storage, descriptor);
    };
    /**
     * Create a {@link Counter} instrument.
     */ Meter.prototype.createCounter = function(name, options) {
        var descriptor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createInstrumentDescriptor"])(name, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].COUNTER, options);
        var storage = this._meterSharedState.registerMetricStorage(descriptor);
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CounterInstrument"](storage, descriptor);
    };
    /**
     * Create a {@link UpDownCounter} instrument.
     */ Meter.prototype.createUpDownCounter = function(name, options) {
        var descriptor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createInstrumentDescriptor"])(name, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].UP_DOWN_COUNTER, options);
        var storage = this._meterSharedState.registerMetricStorage(descriptor);
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["UpDownCounterInstrument"](storage, descriptor);
    };
    /**
     * Create a {@link ObservableGauge} instrument.
     */ Meter.prototype.createObservableGauge = function(name, options) {
        var descriptor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createInstrumentDescriptor"])(name, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_GAUGE, options);
        var storages = this._meterSharedState.registerAsyncMetricStorage(descriptor);
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ObservableGaugeInstrument"](descriptor, storages, this._meterSharedState.observableRegistry);
    };
    /**
     * Create a {@link ObservableCounter} instrument.
     */ Meter.prototype.createObservableCounter = function(name, options) {
        var descriptor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createInstrumentDescriptor"])(name, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_COUNTER, options);
        var storages = this._meterSharedState.registerAsyncMetricStorage(descriptor);
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ObservableCounterInstrument"](descriptor, storages, this._meterSharedState.observableRegistry);
    };
    /**
     * Create a {@link ObservableUpDownCounter} instrument.
     */ Meter.prototype.createObservableUpDownCounter = function(name, options) {
        var descriptor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createInstrumentDescriptor"])(name, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"].OBSERVABLE_UP_DOWN_COUNTER, options);
        var storages = this._meterSharedState.registerAsyncMetricStorage(descriptor);
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Instruments$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ObservableUpDownCounterInstrument"](descriptor, storages, this._meterSharedState.observableRegistry);
    };
    /**
     * @see {@link Meter.addBatchObservableCallback}
     */ Meter.prototype.addBatchObservableCallback = function(callback, observables) {
        this._meterSharedState.observableRegistry.addBatchCallback(callback, observables);
    };
    /**
     * @see {@link Meter.removeBatchObservableCallback}
     */ Meter.prototype.removeBatchObservableCallback = function(callback, observables) {
        this._meterSharedState.observableRegistry.removeBatchCallback(callback, observables);
    };
    return Meter;
}();
;
 //# sourceMappingURL=Meter.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MeterSharedState.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "MeterSharedState": (()=>MeterSharedState)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$SyncMetricStorage$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/SyncMetricStorage.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MultiWritableMetricStorage$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MultiWritableMetricStorage.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$AsyncMetricStorage$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/AsyncMetricStorage.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/InstrumentDescriptor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$AttributesProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/AttributesProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MetricStorageRegistry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MetricStorageRegistry.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$ObservableRegistry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/ObservableRegistry.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Meter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/Meter.js [app-rsc] (ecmascript)");
var __awaiter = this && this.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = this && this.__generator || function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, f, y, t, g;
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    "TURBOPACK unreachable";
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
};
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
;
;
;
;
;
;
;
;
;
/**
 * An internal record for shared meter provider states.
 */ var MeterSharedState = function() {
    function MeterSharedState(_meterProviderSharedState, _instrumentationScope) {
        this._meterProviderSharedState = _meterProviderSharedState;
        this._instrumentationScope = _instrumentationScope;
        this.metricStorageRegistry = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MetricStorageRegistry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MetricStorageRegistry"]();
        this.observableRegistry = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$ObservableRegistry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ObservableRegistry"]();
        this.meter = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$Meter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Meter"](this);
    }
    MeterSharedState.prototype.registerMetricStorage = function(descriptor) {
        var storages = this._registerMetricStorage(descriptor, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$SyncMetricStorage$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SyncMetricStorage"]);
        if (storages.length === 1) {
            return storages[0];
        }
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MultiWritableMetricStorage$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MultiMetricStorage"](storages);
    };
    MeterSharedState.prototype.registerAsyncMetricStorage = function(descriptor) {
        var storages = this._registerMetricStorage(descriptor, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$AsyncMetricStorage$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AsyncMetricStorage"]);
        return storages;
    };
    /**
     * @param collector opaque handle of {@link MetricCollector} which initiated the collection.
     * @param collectionTime the HrTime at which the collection was initiated.
     * @param options options for collection.
     * @returns the list of metric data collected.
     */ MeterSharedState.prototype.collect = function(collector, collectionTime, options) {
        return __awaiter(this, void 0, void 0, function() {
            var errors, storages, metricDataList;
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        return [
                            4 /*yield*/ ,
                            this.observableRegistry.observe(collectionTime, options === null || options === void 0 ? void 0 : options.timeoutMillis)
                        ];
                    case 1:
                        errors = _a.sent();
                        storages = this.metricStorageRegistry.getStorages(collector);
                        // prevent more allocations if there are no storages.
                        if (storages.length === 0) {
                            return [
                                2 /*return*/ ,
                                null
                            ];
                        }
                        metricDataList = storages.map(function(metricStorage) {
                            return metricStorage.collect(collector, collectionTime);
                        }).filter(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isNotNullish"]);
                        // skip this scope if no data was collected (storage created, but no data observed)
                        if (metricDataList.length === 0) {
                            return [
                                2 /*return*/ ,
                                {
                                    errors: errors
                                }
                            ];
                        }
                        return [
                            2 /*return*/ ,
                            {
                                scopeMetrics: {
                                    scope: this._instrumentationScope,
                                    metrics: metricDataList
                                },
                                errors: errors
                            }
                        ];
                }
            });
        });
    };
    MeterSharedState.prototype._registerMetricStorage = function(descriptor, MetricStorageType) {
        var _this = this;
        var views = this._meterProviderSharedState.viewRegistry.findViews(descriptor, this._instrumentationScope);
        var storages = views.map(function(view) {
            var viewDescriptor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createInstrumentDescriptorWithView"])(view, descriptor);
            var compatibleStorage = _this.metricStorageRegistry.findOrUpdateCompatibleStorage(viewDescriptor);
            if (compatibleStorage != null) {
                return compatibleStorage;
            }
            var aggregator = view.aggregation.createAggregator(viewDescriptor);
            var viewStorage = new MetricStorageType(viewDescriptor, aggregator, view.attributesProcessor, _this._meterProviderSharedState.metricCollectors);
            _this.metricStorageRegistry.register(viewStorage);
            return viewStorage;
        });
        // Fallback to the per-collector aggregations if no view is configured for the instrument.
        if (storages.length === 0) {
            var perCollectorAggregations = this._meterProviderSharedState.selectAggregations(descriptor.type);
            var collectorStorages = perCollectorAggregations.map(function(_a) {
                var _b = __read(_a, 2), collector = _b[0], aggregation = _b[1];
                var compatibleStorage = _this.metricStorageRegistry.findOrUpdateCompatibleCollectorStorage(collector, descriptor);
                if (compatibleStorage != null) {
                    return compatibleStorage;
                }
                var aggregator = aggregation.createAggregator(descriptor);
                var storage = new MetricStorageType(descriptor, aggregator, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$AttributesProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AttributesProcessor"].Noop(), [
                    collector
                ]);
                _this.metricStorageRegistry.registerForCollector(collector, storage);
                return storage;
            });
            storages = storages.concat(collectorStorages);
        }
        return storages;
    };
    return MeterSharedState;
}();
;
 //# sourceMappingURL=MeterSharedState.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/ViewRegistry.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "ViewRegistry": (()=>ViewRegistry)
});
var ViewRegistry = function() {
    function ViewRegistry() {
        this._registeredViews = [];
    }
    ViewRegistry.prototype.addView = function(view) {
        this._registeredViews.push(view);
    };
    ViewRegistry.prototype.findViews = function(instrument, meter) {
        var _this = this;
        var views = this._registeredViews.filter(function(registeredView) {
            return _this._matchInstrument(registeredView.instrumentSelector, instrument) && _this._matchMeter(registeredView.meterSelector, meter);
        });
        return views;
    };
    ViewRegistry.prototype._matchInstrument = function(selector, instrument) {
        return (selector.getType() === undefined || instrument.type === selector.getType()) && selector.getNameFilter().match(instrument.name) && selector.getUnitFilter().match(instrument.unit);
    };
    ViewRegistry.prototype._matchMeter = function(selector, meter) {
        return selector.getNameFilter().match(meter.name) && (meter.version === undefined || selector.getVersionFilter().match(meter.version)) && (meter.schemaUrl === undefined || selector.getSchemaUrlFilter().match(meter.schemaUrl));
    };
    return ViewRegistry;
}();
;
 //# sourceMappingURL=ViewRegistry.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MeterProviderSharedState.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "MeterProviderSharedState": (()=>MeterProviderSharedState)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MeterSharedState$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MeterSharedState.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$ViewRegistry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/ViewRegistry.js [app-rsc] (ecmascript)");
var __values = this && this.__values || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
;
;
;
/**
 * An internal record for shared meter provider states.
 */ var MeterProviderSharedState = function() {
    function MeterProviderSharedState(resource) {
        this.resource = resource;
        this.viewRegistry = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$ViewRegistry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ViewRegistry"]();
        this.metricCollectors = [];
        this.meterSharedStates = new Map();
    }
    MeterProviderSharedState.prototype.getMeterSharedState = function(instrumentationScope) {
        var id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["instrumentationScopeId"])(instrumentationScope);
        var meterSharedState = this.meterSharedStates.get(id);
        if (meterSharedState == null) {
            meterSharedState = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MeterSharedState$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MeterSharedState"](this, instrumentationScope);
            this.meterSharedStates.set(id, meterSharedState);
        }
        return meterSharedState;
    };
    MeterProviderSharedState.prototype.selectAggregations = function(instrumentType) {
        var e_1, _a;
        var result = [];
        try {
            for(var _b = __values(this.metricCollectors), _c = _b.next(); !_c.done; _c = _b.next()){
                var collector = _c.value;
                result.push([
                    collector,
                    collector.selectAggregation(instrumentType)
                ]);
            }
        } catch (e_1_1) {
            e_1 = {
                error: e_1_1
            };
        } finally{
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            } finally{
                if (e_1) throw e_1.error;
            }
        }
        return result;
    };
    return MeterProviderSharedState;
}();
;
 //# sourceMappingURL=MeterProviderSharedState.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/MeterProvider.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "MeterProvider": (()=>MeterProvider)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MetricCollector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MetricCollector.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MeterProviderSharedState$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/state/MeterProviderSharedState.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$resources$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$resources$2f$build$2f$esm$2f$Resource$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+resources@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/resources/build/esm/Resource.js [app-rsc] (ecmascript)");
var __awaiter = this && this.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = this && this.__generator || function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, f, y, t, g;
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    "TURBOPACK unreachable";
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
};
var __values = this && this.__values || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
;
;
;
;
/**
 * @param mergeWithDefaults
 * @param providedResource
 */ function prepareResource(mergeWithDefaults, providedResource) {
    var resource = providedResource !== null && providedResource !== void 0 ? providedResource : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$resources$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$resources$2f$build$2f$esm$2f$Resource$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Resource"].empty();
    if (mergeWithDefaults) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$resources$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$resources$2f$build$2f$esm$2f$Resource$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Resource"].default().merge(resource);
    }
    return resource;
}
/**
 * This class implements the {@link MeterProvider} interface.
 */ var MeterProvider = function() {
    function MeterProvider(options) {
        var e_1, _a, e_2, _b;
        var _c;
        this._shutdown = false;
        this._sharedState = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MeterProviderSharedState$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MeterProviderSharedState"](prepareResource((_c = options === null || options === void 0 ? void 0 : options.mergeResourceWithDefaults) !== null && _c !== void 0 ? _c : true, options === null || options === void 0 ? void 0 : options.resource));
        if ((options === null || options === void 0 ? void 0 : options.views) != null && options.views.length > 0) {
            try {
                for(var _d = __values(options.views), _e = _d.next(); !_e.done; _e = _d.next()){
                    var view = _e.value;
                    this._sharedState.viewRegistry.addView(view);
                }
            } catch (e_1_1) {
                e_1 = {
                    error: e_1_1
                };
            } finally{
                try {
                    if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                } finally{
                    if (e_1) throw e_1.error;
                }
            }
        }
        if ((options === null || options === void 0 ? void 0 : options.readers) != null && options.readers.length > 0) {
            try {
                for(var _f = __values(options.readers), _g = _f.next(); !_g.done; _g = _f.next()){
                    var metricReader = _g.value;
                    this.addMetricReader(metricReader);
                }
            } catch (e_2_1) {
                e_2 = {
                    error: e_2_1
                };
            } finally{
                try {
                    if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
                } finally{
                    if (e_2) throw e_2.error;
                }
            }
        }
    }
    /**
     * Get a meter with the configuration of the MeterProvider.
     */ MeterProvider.prototype.getMeter = function(name, version, options) {
        if (version === void 0) {
            version = '';
        }
        if (options === void 0) {
            options = {};
        }
        // https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/sdk.md#meter-creation
        if (this._shutdown) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn('A shutdown MeterProvider cannot provide a Meter');
            return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["createNoopMeter"])();
        }
        return this._sharedState.getMeterSharedState({
            name: name,
            version: version,
            schemaUrl: options.schemaUrl
        }).meter;
    };
    /**
     * Register a {@link MetricReader} to the meter provider. After the
     * registration, the MetricReader can start metrics collection.
     *
     * <p> NOTE: {@link MetricReader} instances MUST be added before creating any instruments.
     * A {@link MetricReader} instance registered later may receive no or incomplete metric data.
     *
     * @param metricReader the metric reader to be registered.
     *
     * @deprecated This method will be removed in SDK 2.0. Please use
     * {@link MeterProviderOptions.readers} via the {@link MeterProvider} constructor instead
     */ MeterProvider.prototype.addMetricReader = function(metricReader) {
        var collector = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$state$2f$MetricCollector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MetricCollector"](this._sharedState, metricReader);
        metricReader.setMetricProducer(collector);
        this._sharedState.metricCollectors.push(collector);
    };
    /**
     * Flush all buffered data and shut down the MeterProvider and all registered
     * MetricReaders.
     *
     * Returns a promise which is resolved when all flushes are complete.
     */ MeterProvider.prototype.shutdown = function(options) {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        if (this._shutdown) {
                            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn('shutdown may only be called once per MeterProvider');
                            return [
                                2 /*return*/ 
                            ];
                        }
                        this._shutdown = true;
                        return [
                            4 /*yield*/ ,
                            Promise.all(this._sharedState.metricCollectors.map(function(collector) {
                                return collector.shutdown(options);
                            }))
                        ];
                    case 1:
                        _a.sent();
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    /**
     * Notifies all registered MetricReaders to flush any buffered data.
     *
     * Returns a promise which is resolved when all flushes are complete.
     */ MeterProvider.prototype.forceFlush = function(options) {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        // do not flush after shutdown
                        if (this._shutdown) {
                            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["diag"].warn('invalid attempt to force flush after MeterProvider shutdown');
                            return [
                                2 /*return*/ 
                            ];
                        }
                        return [
                            4 /*yield*/ ,
                            Promise.all(this._sharedState.metricCollectors.map(function(collector) {
                                return collector.forceFlush(options);
                            }))
                        ];
                    case 1:
                        _a.sent();
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    return MeterProvider;
}();
;
 //# sourceMappingURL=MeterProvider.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/MetricReader.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "MetricReader": (()=>MetricReader)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationSelector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/AggregationSelector.js [app-rsc] (ecmascript)");
var __awaiter = this && this.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = this && this.__generator || function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, f, y, t, g;
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    "TURBOPACK unreachable";
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
};
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
var __spreadArray = this && this.__spreadArray || function(to, from, pack) {
    if (pack || arguments.length === 2) for(var i = 0, l = from.length, ar; i < l; i++){
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
;
;
;
/**
 * A registered reader of metrics that, when linked to a {@link MetricProducer}, offers global
 * control over metrics.
 */ var MetricReader = function() {
    function MetricReader(options) {
        var _a, _b, _c;
        // Tracks the shutdown state.
        // TODO: use BindOncePromise here once a new version of @opentelemetry/core is available.
        this._shutdown = false;
        this._aggregationSelector = (_a = options === null || options === void 0 ? void 0 : options.aggregationSelector) !== null && _a !== void 0 ? _a : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationSelector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_AGGREGATION_SELECTOR"];
        this._aggregationTemporalitySelector = (_b = options === null || options === void 0 ? void 0 : options.aggregationTemporalitySelector) !== null && _b !== void 0 ? _b : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationSelector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_AGGREGATION_TEMPORALITY_SELECTOR"];
        this._metricProducers = (_c = options === null || options === void 0 ? void 0 : options.metricProducers) !== null && _c !== void 0 ? _c : [];
    }
    /**
     * Set the {@link MetricProducer} used by this instance. **This should only be called by the
     * SDK and should be considered internal.**
     *
     * To add additional {@link MetricProducer}s to a {@link MetricReader}, pass them to the
     * constructor as {@link MetricReaderOptions.metricProducers}.
     *
     * @internal
     * @param metricProducer
     */ MetricReader.prototype.setMetricProducer = function(metricProducer) {
        if (this._sdkMetricProducer) {
            throw new Error('MetricReader can not be bound to a MeterProvider again.');
        }
        this._sdkMetricProducer = metricProducer;
        this.onInitialized();
    };
    /**
     * Select the {@link Aggregation} for the given {@link InstrumentType} for this
     * reader.
     */ MetricReader.prototype.selectAggregation = function(instrumentType) {
        return this._aggregationSelector(instrumentType);
    };
    /**
     * Select the {@link AggregationTemporality} for the given
     * {@link InstrumentType} for this reader.
     */ MetricReader.prototype.selectAggregationTemporality = function(instrumentType) {
        return this._aggregationTemporalitySelector(instrumentType);
    };
    /**
     * Handle once the SDK has initialized this {@link MetricReader}
     * Overriding this method is optional.
     */ MetricReader.prototype.onInitialized = function() {
    // Default implementation is empty.
    };
    /**
     * Collect all metrics from the associated {@link MetricProducer}
     */ MetricReader.prototype.collect = function(options) {
        return __awaiter(this, void 0, void 0, function() {
            var _a, sdkCollectionResults, additionalCollectionResults, errors, resource, scopeMetrics;
            return __generator(this, function(_b) {
                switch(_b.label){
                    case 0:
                        if (this._sdkMetricProducer === undefined) {
                            throw new Error('MetricReader is not bound to a MetricProducer');
                        }
                        // Subsequent invocations to collect are not allowed. SDKs SHOULD return some failure for these calls.
                        if (this._shutdown) {
                            throw new Error('MetricReader is shutdown');
                        }
                        return [
                            4 /*yield*/ ,
                            Promise.all(__spreadArray([
                                this._sdkMetricProducer.collect({
                                    timeoutMillis: options === null || options === void 0 ? void 0 : options.timeoutMillis
                                })
                            ], __read(this._metricProducers.map(function(producer) {
                                return producer.collect({
                                    timeoutMillis: options === null || options === void 0 ? void 0 : options.timeoutMillis
                                });
                            })), false))
                        ];
                    case 1:
                        _a = __read.apply(void 0, [
                            _b.sent()
                        ]), sdkCollectionResults = _a[0], additionalCollectionResults = _a.slice(1);
                        errors = sdkCollectionResults.errors.concat((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["FlatMap"])(additionalCollectionResults, function(result) {
                            return result.errors;
                        }));
                        resource = sdkCollectionResults.resourceMetrics.resource;
                        scopeMetrics = sdkCollectionResults.resourceMetrics.scopeMetrics.concat((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["FlatMap"])(additionalCollectionResults, function(result) {
                            return result.resourceMetrics.scopeMetrics;
                        }));
                        return [
                            2 /*return*/ ,
                            {
                                resourceMetrics: {
                                    resource: resource,
                                    scopeMetrics: scopeMetrics
                                },
                                errors: errors
                            }
                        ];
                }
            });
        });
    };
    /**
     * Shuts down the metric reader, the promise will reject after the optional timeout or resolve after completion.
     *
     * <p> NOTE: this operation will continue even after the promise rejects due to a timeout.
     * @param options options with timeout.
     */ MetricReader.prototype.shutdown = function(options) {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        // Do not call shutdown again if it has already been called.
                        if (this._shutdown) {
                            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.diag.error('Cannot call shutdown twice.');
                            return [
                                2 /*return*/ 
                            ];
                        }
                        if (!((options === null || options === void 0 ? void 0 : options.timeoutMillis) == null)) return [
                            3 /*break*/ ,
                            2
                        ];
                        return [
                            4 /*yield*/ ,
                            this.onShutdown()
                        ];
                    case 1:
                        _a.sent();
                        return [
                            3 /*break*/ ,
                            4
                        ];
                    case 2:
                        return [
                            4 /*yield*/ ,
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["callWithTimeout"])(this.onShutdown(), options.timeoutMillis)
                        ];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        this._shutdown = true;
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    /**
     * Flushes metrics read by this reader, the promise will reject after the optional timeout or resolve after completion.
     *
     * <p> NOTE: this operation will continue even after the promise rejects due to a timeout.
     * @param options options with timeout.
     */ MetricReader.prototype.forceFlush = function(options) {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        if (this._shutdown) {
                            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.diag.warn('Cannot forceFlush on already shutdown MetricReader.');
                            return [
                                2 /*return*/ 
                            ];
                        }
                        if (!((options === null || options === void 0 ? void 0 : options.timeoutMillis) == null)) return [
                            3 /*break*/ ,
                            2
                        ];
                        return [
                            4 /*yield*/ ,
                            this.onForceFlush()
                        ];
                    case 1:
                        _a.sent();
                        return [
                            2 /*return*/ 
                        ];
                    case 2:
                        return [
                            4 /*yield*/ ,
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["callWithTimeout"])(this.onForceFlush(), options.timeoutMillis)
                        ];
                    case 3:
                        _a.sent();
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    return MetricReader;
}();
;
 //# sourceMappingURL=MetricReader.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/PeriodicExportingMetricReader.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "PeriodicExportingMetricReader": (()=>PeriodicExportingMetricReader)
});
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/common/global-error-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/index.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/ExportResult.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$timer$2d$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+core@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/core/build/esm/platform/node/timer-util.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricReader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/MetricReader.js [app-rsc] (ecmascript)");
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
var __awaiter = this && this.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }
        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }
        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = this && this.__generator || function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, f, y, t, g;
    return g = {
        next: verb(0),
        "throw": verb(1),
        "return": verb(2)
    }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
        return this;
    }), g;
    "TURBOPACK unreachable";
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(_)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
};
var __read = this && this.__read || function(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while((n === void 0 || n-- > 0) && !(r = i.next()).done)ar.push(r.value);
    } catch (error) {
        e = {
            error: error
        };
    } finally{
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally{
            if (e) throw e.error;
        }
    }
    return ar;
};
var __spreadArray = this && this.__spreadArray || function(to, from, pack) {
    if (pack || arguments.length === 2) for(var i = 0, l = from.length, ar; i < l; i++){
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
;
;
;
;
/**
 * {@link MetricReader} which collects metrics based on a user-configurable time interval, and passes the metrics to
 * the configured {@link PushMetricExporter}
 */ var PeriodicExportingMetricReader = function(_super) {
    __extends(PeriodicExportingMetricReader, _super);
    function PeriodicExportingMetricReader(options) {
        var _a, _b, _c, _d;
        var _this = _super.call(this, {
            aggregationSelector: (_a = options.exporter.selectAggregation) === null || _a === void 0 ? void 0 : _a.bind(options.exporter),
            aggregationTemporalitySelector: (_b = options.exporter.selectAggregationTemporality) === null || _b === void 0 ? void 0 : _b.bind(options.exporter),
            metricProducers: options.metricProducers
        }) || this;
        if (options.exportIntervalMillis !== undefined && options.exportIntervalMillis <= 0) {
            throw Error('exportIntervalMillis must be greater than 0');
        }
        if (options.exportTimeoutMillis !== undefined && options.exportTimeoutMillis <= 0) {
            throw Error('exportTimeoutMillis must be greater than 0');
        }
        if (options.exportTimeoutMillis !== undefined && options.exportIntervalMillis !== undefined && options.exportIntervalMillis < options.exportTimeoutMillis) {
            throw Error('exportIntervalMillis must be greater than or equal to exportTimeoutMillis');
        }
        _this._exportInterval = (_c = options.exportIntervalMillis) !== null && _c !== void 0 ? _c : 60000;
        _this._exportTimeout = (_d = options.exportTimeoutMillis) !== null && _d !== void 0 ? _d : 30000;
        _this._exporter = options.exporter;
        return _this;
    }
    PeriodicExportingMetricReader.prototype._runOnce = function() {
        return __awaiter(this, void 0, void 0, function() {
            var err_1;
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        _a.trys.push([
                            0,
                            2,
                            ,
                            3
                        ]);
                        return [
                            4 /*yield*/ ,
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["callWithTimeout"])(this._doRun(), this._exportTimeout)
                        ];
                    case 1:
                        _a.sent();
                        return [
                            3 /*break*/ ,
                            3
                        ];
                    case 2:
                        err_1 = _a.sent();
                        if (err_1 instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TimeoutError"]) {
                            __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.diag.error('Export took longer than %s milliseconds and timed out.', this._exportTimeout);
                            return [
                                2 /*return*/ 
                            ];
                        }
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"])(err_1);
                        return [
                            3 /*break*/ ,
                            3
                        ];
                    case 3:
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    PeriodicExportingMetricReader.prototype._doRun = function() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function() {
            var _c, resourceMetrics, errors, e_1, result;
            var _d;
            return __generator(this, function(_e) {
                switch(_e.label){
                    case 0:
                        return [
                            4 /*yield*/ ,
                            this.collect({
                                timeoutMillis: this._exportTimeout
                            })
                        ];
                    case 1:
                        _c = _e.sent(), resourceMetrics = _c.resourceMetrics, errors = _c.errors;
                        if (errors.length > 0) {
                            (_d = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.diag).error.apply(_d, __spreadArray([
                                'PeriodicExportingMetricReader: metrics collection errors'
                            ], __read(errors), false));
                        }
                        if (!resourceMetrics.resource.asyncAttributesPending) return [
                            3 /*break*/ ,
                            5
                        ];
                        _e.label = 2;
                    case 2:
                        _e.trys.push([
                            2,
                            4,
                            ,
                            5
                        ]);
                        return [
                            4 /*yield*/ ,
                            (_b = (_a = resourceMetrics.resource).waitForAsyncAttributes) === null || _b === void 0 ? void 0 : _b.call(_a)
                        ];
                    case 3:
                        _e.sent();
                        return [
                            3 /*break*/ ,
                            5
                        ];
                    case 4:
                        e_1 = _e.sent();
                        __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__.diag.debug('Error while resolving async portion of resource: ', e_1);
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$common$2f$global$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["globalErrorHandler"])(e_1);
                        return [
                            3 /*break*/ ,
                            5
                        ];
                    case 5:
                        return [
                            4 /*yield*/ ,
                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["internal"]._export(this._exporter, resourceMetrics)
                        ];
                    case 6:
                        result = _e.sent();
                        if (result.code !== __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$ExportResult$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExportResultCode"].SUCCESS) {
                            throw new Error("PeriodicExportingMetricReader: metrics export failed (error " + result.error + ")");
                        }
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    PeriodicExportingMetricReader.prototype.onInitialized = function() {
        var _this = this;
        // start running the interval as soon as this reader is initialized and keep handle for shutdown.
        this._interval = setInterval(function() {
            // this._runOnce never rejects. Using void operator to suppress @typescript-eslint/no-floating-promises.
            void _this._runOnce();
        }, this._exportInterval);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$core$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$core$2f$build$2f$esm$2f$platform$2f$node$2f$timer$2d$util$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unrefTimer"])(this._interval);
    };
    PeriodicExportingMetricReader.prototype.onForceFlush = function() {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        return [
                            4 /*yield*/ ,
                            this._runOnce()
                        ];
                    case 1:
                        _a.sent();
                        return [
                            4 /*yield*/ ,
                            this._exporter.forceFlush()
                        ];
                    case 2:
                        _a.sent();
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    PeriodicExportingMetricReader.prototype.onShutdown = function() {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch(_a.label){
                    case 0:
                        if (this._interval) {
                            clearInterval(this._interval);
                        }
                        return [
                            4 /*yield*/ ,
                            this._exporter.shutdown()
                        ];
                    case 1:
                        _a.sent();
                        return [
                            2 /*return*/ 
                        ];
                }
            });
        });
    };
    return PeriodicExportingMetricReader;
}(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricReader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MetricReader"]);
;
 //# sourceMappingURL=PeriodicExportingMetricReader.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/Predicate.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ // https://tc39.es/proposal-regex-escaping
// escape ^ $ \ .  + ? ( ) [ ] { } |
// do not need to escape * as we interpret it as wildcard
__turbopack_esm__({
    "ExactPredicate": (()=>ExactPredicate),
    "PatternPredicate": (()=>PatternPredicate)
});
var ESCAPE = /[\^$\\.+?()[\]{}|]/g;
/**
 * Wildcard pattern predicate, supports patterns like `*`, `foo*`, `*bar`.
 */ var PatternPredicate = function() {
    function PatternPredicate(pattern) {
        if (pattern === '*') {
            this._matchAll = true;
            this._regexp = /.*/;
        } else {
            this._matchAll = false;
            this._regexp = new RegExp(PatternPredicate.escapePattern(pattern));
        }
    }
    PatternPredicate.prototype.match = function(str) {
        if (this._matchAll) {
            return true;
        }
        return this._regexp.test(str);
    };
    PatternPredicate.escapePattern = function(pattern) {
        return "^" + pattern.replace(ESCAPE, '\\$&').replace('*', '.*') + "$";
    };
    PatternPredicate.hasWildcard = function(pattern) {
        return pattern.includes('*');
    };
    return PatternPredicate;
}();
;
var ExactPredicate = function() {
    function ExactPredicate(pattern) {
        this._matchAll = pattern === undefined;
        this._pattern = pattern;
    }
    ExactPredicate.prototype.match = function(str) {
        if (this._matchAll) {
            return true;
        }
        if (str === this._pattern) {
            return true;
        }
        return false;
    };
    return ExactPredicate;
}();
;
 //# sourceMappingURL=Predicate.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/InstrumentSelector.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "InstrumentSelector": (()=>InstrumentSelector)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Predicate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/Predicate.js [app-rsc] (ecmascript)");
;
var InstrumentSelector = function() {
    function InstrumentSelector(criteria) {
        var _a;
        this._nameFilter = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Predicate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["PatternPredicate"]((_a = criteria === null || criteria === void 0 ? void 0 : criteria.name) !== null && _a !== void 0 ? _a : '*');
        this._type = criteria === null || criteria === void 0 ? void 0 : criteria.type;
        this._unitFilter = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Predicate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExactPredicate"](criteria === null || criteria === void 0 ? void 0 : criteria.unit);
    }
    InstrumentSelector.prototype.getType = function() {
        return this._type;
    };
    InstrumentSelector.prototype.getNameFilter = function() {
        return this._nameFilter;
    };
    InstrumentSelector.prototype.getUnitFilter = function() {
        return this._unitFilter;
    };
    return InstrumentSelector;
}();
;
 //# sourceMappingURL=InstrumentSelector.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/MeterSelector.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "MeterSelector": (()=>MeterSelector)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Predicate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/Predicate.js [app-rsc] (ecmascript)");
;
var MeterSelector = function() {
    function MeterSelector(criteria) {
        this._nameFilter = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Predicate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExactPredicate"](criteria === null || criteria === void 0 ? void 0 : criteria.name);
        this._versionFilter = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Predicate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExactPredicate"](criteria === null || criteria === void 0 ? void 0 : criteria.version);
        this._schemaUrlFilter = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Predicate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExactPredicate"](criteria === null || criteria === void 0 ? void 0 : criteria.schemaUrl);
    }
    MeterSelector.prototype.getNameFilter = function() {
        return this._nameFilter;
    };
    /**
     * TODO: semver filter? no spec yet.
     */ MeterSelector.prototype.getVersionFilter = function() {
        return this._versionFilter;
    };
    MeterSelector.prototype.getSchemaUrlFilter = function() {
        return this._schemaUrlFilter;
    };
    return MeterSelector;
}();
;
 //# sourceMappingURL=MeterSelector.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/View.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
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
 */ __turbopack_esm__({
    "View": (()=>View)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Predicate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/Predicate.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$AttributesProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/AttributesProcessor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/Aggregation.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$InstrumentSelector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/InstrumentSelector.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$MeterSelector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/MeterSelector.js [app-rsc] (ecmascript)");
;
;
;
;
;
function isSelectorNotProvided(options) {
    return options.instrumentName == null && options.instrumentType == null && options.instrumentUnit == null && options.meterName == null && options.meterVersion == null && options.meterSchemaUrl == null;
}
/**
 * Can be passed to a {@link MeterProvider} to select instruments and alter their metric stream.
 */ var View = function() {
    /**
     * Create a new {@link View} instance.
     *
     * Parameters can be categorized as two types:
     *  Instrument selection criteria: Used to describe the instrument(s) this view will be applied to.
     *  Will be treated as additive (the Instrument has to meet all the provided criteria to be selected).
     *
     *  Metric stream altering: Alter the metric stream of instruments selected by instrument selection criteria.
     *
     * @param viewOptions {@link ViewOptions} for altering the metric stream and instrument selection.
     * @param viewOptions.name
     * Alters the metric stream:
     *  This will be used as the name of the metrics stream.
     *  If not provided, the original Instrument name will be used.
     * @param viewOptions.description
     * Alters the metric stream:
     *  This will be used as the description of the metrics stream.
     *  If not provided, the original Instrument description will be used by default.
     * @param viewOptions.attributeKeys
     * Alters the metric stream:
     *  If provided, the attributes that are not in the list will be ignored.
     *  If not provided, all attribute keys will be used by default.
     * @param viewOptions.aggregation
     * Alters the metric stream:
     *  Alters the {@link Aggregation} of the metric stream.
     * @param viewOptions.instrumentName
     * Instrument selection criteria:
     *  Original name of the Instrument(s) with wildcard support.
     * @param viewOptions.instrumentType
     * Instrument selection criteria:
     *  The original type of the Instrument(s).
     * @param viewOptions.instrumentUnit
     * Instrument selection criteria:
     *  The unit of the Instrument(s).
     * @param viewOptions.meterName
     * Instrument selection criteria:
     *  The name of the Meter. No wildcard support, name must match the meter exactly.
     * @param viewOptions.meterVersion
     * Instrument selection criteria:
     *  The version of the Meter. No wildcard support, version must match exactly.
     * @param viewOptions.meterSchemaUrl
     * Instrument selection criteria:
     *  The schema URL of the Meter. No wildcard support, schema URL must match exactly.
     *
     * @example
     * // Create a view that changes the Instrument 'my.instrument' to use to an
     * // ExplicitBucketHistogramAggregation with the boundaries [20, 30, 40]
     * new View({
     *   aggregation: new ExplicitBucketHistogramAggregation([20, 30, 40]),
     *   instrumentName: 'my.instrument'
     * })
     */ function View(viewOptions) {
        var _a;
        // If no criteria is provided, the SDK SHOULD treat it as an error.
        // It is recommended that the SDK implementations fail fast.
        if (isSelectorNotProvided(viewOptions)) {
            throw new Error('Cannot create view with no selector arguments supplied');
        }
        // the SDK SHOULD NOT allow Views with a specified name to be declared with instrument selectors that
        // may select more than one instrument (e.g. wild card instrument name) in the same Meter.
        if (viewOptions.name != null && ((viewOptions === null || viewOptions === void 0 ? void 0 : viewOptions.instrumentName) == null || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Predicate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["PatternPredicate"].hasWildcard(viewOptions.instrumentName))) {
            throw new Error('Views with a specified name must be declared with an instrument selector that selects at most one instrument per meter.');
        }
        // Create AttributesProcessor if attributeKeys are defined set.
        if (viewOptions.attributeKeys != null) {
            this.attributesProcessor = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$AttributesProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["FilteringAttributesProcessor"](viewOptions.attributeKeys);
        } else {
            this.attributesProcessor = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$AttributesProcessor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AttributesProcessor"].Noop();
        }
        this.name = viewOptions.name;
        this.description = viewOptions.description;
        this.aggregation = (_a = viewOptions.aggregation) !== null && _a !== void 0 ? _a : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Aggregation"].Default();
        this.instrumentSelector = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$InstrumentSelector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentSelector"]({
            name: viewOptions.instrumentName,
            type: viewOptions.instrumentType,
            unit: viewOptions.instrumentUnit
        });
        this.meterSelector = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$MeterSelector$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MeterSelector"]({
            name: viewOptions.meterName,
            version: viewOptions.meterVersion,
            schemaUrl: viewOptions.meterSchemaUrl
        });
    }
    return View;
}();
;
 //# sourceMappingURL=View.js.map
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/index.js [app-rsc] (ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "Aggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Aggregation"]),
    "AggregationTemporality": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationTemporality$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AggregationTemporality"]),
    "ConsoleMetricExporter": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$ConsoleMetricExporter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ConsoleMetricExporter"]),
    "DataPointType": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DataPointType"]),
    "DefaultAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DefaultAggregation"]),
    "DropAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DropAggregation"]),
    "ExplicitBucketHistogramAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExplicitBucketHistogramAggregation"]),
    "ExponentialHistogramAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ExponentialHistogramAggregation"]),
    "HistogramAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["HistogramAggregation"]),
    "InMemoryMetricExporter": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$InMemoryMetricExporter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InMemoryMetricExporter"]),
    "InstrumentType": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstrumentType"]),
    "LastValueAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["LastValueAggregation"]),
    "MeterProvider": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$MeterProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MeterProvider"]),
    "MetricReader": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricReader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MetricReader"]),
    "PeriodicExportingMetricReader": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$PeriodicExportingMetricReader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["PeriodicExportingMetricReader"]),
    "SumAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SumAggregation"]),
    "TimeoutError": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TimeoutError"]),
    "View": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$View$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["View"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$Aggregation$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/Aggregation.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$AggregationTemporality$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/AggregationTemporality.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$ConsoleMetricExporter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/ConsoleMetricExporter.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/MetricData.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$InMemoryMetricExporter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/InMemoryMetricExporter.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$InstrumentDescriptor$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/InstrumentDescriptor.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$MeterProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/MeterProvider.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$MetricReader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/MetricReader.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$export$2f$PeriodicExportingMetricReader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/export/PeriodicExportingMetricReader.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$view$2f$View$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/view/View.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/index.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "Aggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["Aggregation"]),
    "AggregationTemporality": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["AggregationTemporality"]),
    "ConsoleMetricExporter": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ConsoleMetricExporter"]),
    "DataPointType": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["DataPointType"]),
    "DefaultAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["DefaultAggregation"]),
    "DropAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["DropAggregation"]),
    "ExplicitBucketHistogramAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ExplicitBucketHistogramAggregation"]),
    "ExponentialHistogramAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ExponentialHistogramAggregation"]),
    "HistogramAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["HistogramAggregation"]),
    "InMemoryMetricExporter": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["InMemoryMetricExporter"]),
    "InstrumentType": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["InstrumentType"]),
    "LastValueAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["LastValueAggregation"]),
    "MeterProvider": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["MeterProvider"]),
    "MetricReader": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["MetricReader"]),
    "PeriodicExportingMetricReader": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["PeriodicExportingMetricReader"]),
    "SumAggregation": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["SumAggregation"]),
    "TimeoutError": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["TimeoutError"]),
    "View": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["View"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$opentelemetry$2b$sdk$2d$metrics$40$1$2e$28$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0$2f$node_modules$2f40$opentelemetry$2f$sdk$2d$metrics$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@opentelemetry+sdk-metrics@1.28.0_@opentelemetry+api@1.9.0/node_modules/@opentelemetry/sdk-metrics/build/esm/index.js [app-rsc] (ecmascript) <exports>");
}}),

};

//# sourceMappingURL=6de8f_%40opentelemetry_sdk-metrics_build_esm_53fb55._.js.map