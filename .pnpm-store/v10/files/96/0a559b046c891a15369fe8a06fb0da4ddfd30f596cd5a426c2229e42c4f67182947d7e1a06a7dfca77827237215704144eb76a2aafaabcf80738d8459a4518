"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIndex = void 0;
var control_1 = require("../pinecone-generated-ts-fetch/control");
var utils_1 = require("../utils");
var types_1 = require("./types");
var errors_1 = require("../errors");
var validateProperties_1 = require("../utils/validateProperties");
var CreateIndexOptionsProperties = [
    'spec',
    'name',
    'dimension',
    'metric',
    'deletionProtection',
    'waitUntilReady',
    'suppressConflicts',
];
var CreateIndexSpecProperties = ['serverless', 'pod'];
var CreateIndexServerlessSpecProperties = [
    'cloud',
    'region',
];
var CreateIndexPodSpecProperties = [
    'environment',
    'replicas',
    'shards',
    'podType',
    'pods',
    'metadataConfig',
    'sourceCollection',
];
var createIndex = function (api) {
    var validator = function (options) {
        if (options) {
            (0, validateProperties_1.ValidateProperties)(options, CreateIndexOptionsProperties);
        }
        if (!options) {
            throw new errors_1.PineconeArgumentError('You must pass an object with required properties (`name`, `dimension`, `spec`) to create an index.');
        }
        if (!options.name) {
            throw new errors_1.PineconeArgumentError('You must pass a non-empty string for `name` in order to create an index.');
        }
        if (!options.dimension || options.dimension <= 0) {
            throw new errors_1.PineconeArgumentError('You must pass a positive integer for `dimension` in order to create an index.');
        }
        if (!options.spec) {
            throw new errors_1.PineconeArgumentError('You must pass a `pods` or `serverless` `spec` object in order to create an index.');
        }
        if (options.spec) {
            (0, validateProperties_1.ValidateProperties)(options.spec, CreateIndexSpecProperties);
        }
        if (options.spec.serverless) {
            (0, validateProperties_1.ValidateProperties)(options.spec.serverless, CreateIndexServerlessSpecProperties);
            if (!options.spec.serverless.cloud) {
                throw new errors_1.PineconeArgumentError('You must pass a `cloud` for the serverless `spec` object in order to create an index.');
            }
            if (!options.spec.serverless.region) {
                throw new errors_1.PineconeArgumentError('You must pass a `region` for the serverless `spec` object in order to create an index.');
            }
        }
        if (options.spec.pod) {
            (0, validateProperties_1.ValidateProperties)(options.spec.pod, CreateIndexPodSpecProperties);
            if (!options.spec.pod.environment) {
                throw new errors_1.PineconeArgumentError('You must pass an `environment` for the pod `spec` object in order to create an index.');
            }
            if (!options.spec.pod.podType) {
                throw new errors_1.PineconeArgumentError('You must pass a `podType` for the pod `spec` object in order to create an index.');
            }
        }
        if (options.spec.serverless &&
            options.spec.serverless.cloud &&
            !Object.values(control_1.ServerlessSpecCloudEnum).includes(options.spec.serverless.cloud)) {
            throw new errors_1.PineconeArgumentError("Invalid cloud value: ".concat(options.spec.serverless.cloud, ". Valid values are: ").concat(Object.values(control_1.ServerlessSpecCloudEnum).join(', '), "."));
        }
        if (options.metric &&
            !Object.values(control_1.IndexModelMetricEnum).includes(options.metric)) {
            {
                throw new errors_1.PineconeArgumentError("Invalid metric value: ".concat(options.metric, ". Valid values are: 'cosine', 'euclidean', or 'dotproduct.'"));
            }
        }
        if (options.spec.pod &&
            options.spec.pod.replicas &&
            options.spec.pod.replicas <= 0) {
            throw new errors_1.PineconeArgumentError('You must pass a positive integer for `replicas` in order to create an index.');
        }
        if (options.spec.pod &&
            options.spec.pod.pods &&
            options.spec.pod.pods <= 0) {
            throw new errors_1.PineconeArgumentError('You must pass a positive integer for `pods` in order to create an index.');
        }
        if (options.spec.pod &&
            !types_1.ValidPodTypes.includes(options.spec.pod.podType)) {
            throw new errors_1.PineconeArgumentError("Invalid pod type: ".concat(options.spec.pod.podType, ". Valid values are: ").concat(types_1.ValidPodTypes.join(', '), "."));
        }
    };
    return function (options) { return __awaiter(void 0, void 0, void 0, function () {
        var createResponse, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // If metric is not specified, default to cosine
                    if (options && !options.metric) {
                        options.metric = control_1.IndexModelMetricEnum.Cosine;
                    }
                    validator(options);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, api.createIndex({
                            createIndexRequest: options,
                        })];
                case 2:
                    createResponse = _a.sent();
                    if (!options.waitUntilReady) return [3 /*break*/, 4];
                    return [4 /*yield*/, waitUntilIndexIsReady(api, options.name)];
                case 3: return [2 /*return*/, _a.sent()];
                case 4: return [2 /*return*/, createResponse];
                case 5:
                    e_1 = _a.sent();
                    if (!(options.suppressConflicts &&
                        e_1 instanceof Error &&
                        e_1.name === 'PineconeConflictError')) {
                        throw e_1;
                    }
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
};
exports.createIndex = createIndex;
var waitUntilIndexIsReady = function (api, indexName, seconds) {
    if (seconds === void 0) { seconds = 0; }
    return __awaiter(void 0, void 0, void 0, function () {
        var indexDescription, e_2, err;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 6, , 8]);
                    return [4 /*yield*/, api.describeIndex({ indexName: indexName })];
                case 1:
                    indexDescription = _b.sent();
                    if (!!((_a = indexDescription.status) === null || _a === void 0 ? void 0 : _a.ready)) return [3 /*break*/, 4];
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000); })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, waitUntilIndexIsReady(api, indexName, seconds + 1)];
                case 3: return [2 /*return*/, _b.sent()];
                case 4:
                    (0, utils_1.debugLog)("Index ".concat(indexName, " is ready after ").concat(seconds));
                    return [2 /*return*/, indexDescription];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_2 = _b.sent();
                    return [4 /*yield*/, (0, errors_1.handleApiError)(e_2, function (_, rawMessageText) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "Error creating index ".concat(indexName, ": ").concat(rawMessageText)];
                        }); }); })];
                case 7:
                    err = _b.sent();
                    throw err;
                case 8: return [2 /*return*/];
            }
        });
    });
};
//# sourceMappingURL=createIndex.js.map