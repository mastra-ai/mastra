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
var createIndex_1 = require("../createIndex");
var errors_1 = require("../../errors");
// describeIndexResponse can either be a single response, or an array of responses for testing polling scenarios
var setupCreateIndexResponse = function (createIndexResponse, describeIndexResponse, isCreateIndexSuccess, isDescribeIndexSuccess) {
    if (isCreateIndexSuccess === void 0) { isCreateIndexSuccess = true; }
    if (isDescribeIndexSuccess === void 0) { isDescribeIndexSuccess = true; }
    var fakeCreateIndex = jest
        .fn()
        .mockImplementation(function () {
        return isCreateIndexSuccess
            ? Promise.resolve(createIndexResponse)
            : Promise.reject(createIndexResponse);
    });
    // unfold describeIndexResponse
    var describeIndexResponses = Array.isArray(describeIndexResponse)
        ? describeIndexResponse
        : [describeIndexResponse];
    var describeIndexMock = jest.fn();
    describeIndexResponses.forEach(function (response) {
        describeIndexMock.mockImplementationOnce(function () {
            return isDescribeIndexSuccess
                ? Promise.resolve(response)
                : Promise.reject({ response: response });
        });
    });
    var fakeDescribeIndex = describeIndexMock;
    var MIA = {
        createIndex: fakeCreateIndex,
        describeIndex: fakeDescribeIndex,
    };
    return MIA;
};
describe('createIndex', function () {
    test('calls the openapi create index endpoint, passing name, dimension, metric, and spec', function () { return __awaiter(void 0, void 0, void 0, function () {
        var MIA, returned;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    MIA = setupCreateIndexResponse(undefined, undefined);
                    return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                            name: 'index-name',
                            dimension: 10,
                            metric: 'cosine',
                            spec: {
                                pod: {
                                    environment: 'us-west1',
                                    pods: 1,
                                    podType: 'p1.x1',
                                },
                            },
                        })];
                case 1:
                    returned = _a.sent();
                    expect(returned).toEqual(void 0);
                    expect(MIA.createIndex).toHaveBeenCalledWith({
                        createIndexRequest: {
                            name: 'index-name',
                            dimension: 10,
                            metric: 'cosine',
                            spec: {
                                pod: {
                                    environment: 'us-west1',
                                    pods: 1,
                                    podType: 'p1.x1',
                                },
                            },
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    test('default metric to "cosine" if not specified', function () { return __awaiter(void 0, void 0, void 0, function () {
        var MIA, returned;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    MIA = setupCreateIndexResponse(undefined, undefined);
                    return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                            name: 'index-name',
                            dimension: 10,
                            spec: {
                                pod: {
                                    environment: 'us-west1',
                                    pods: 1,
                                    podType: 'p1.x1',
                                },
                            },
                        })];
                case 1:
                    returned = _a.sent();
                    expect(returned).toEqual(void 0);
                    expect(MIA.createIndex).toHaveBeenCalledWith({
                        createIndexRequest: {
                            name: 'index-name',
                            dimension: 10,
                            metric: 'cosine',
                            spec: {
                                pod: {
                                    environment: 'us-west1',
                                    pods: 1,
                                    podType: 'p1.x1',
                                },
                            },
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    test('Throw error if name, dimension, or spec are not passed', function () { return __awaiter(void 0, void 0, void 0, function () {
        var MIA, toThrow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    MIA = setupCreateIndexResponse(undefined, undefined);
                    toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // @ts-ignore
                                return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                        dimension: 10,
                                        spec: {
                                            pod: {
                                                environment: 'us-west1',
                                                pods: 1,
                                                podType: 'p1.x1',
                                            },
                                        },
                                    })];
                                case 1:
                                    // @ts-ignore
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(toThrow).rejects.toThrow('You must pass a non-empty string for `name` in order to create an index.')];
                case 2:
                    _a.sent();
                    // Missing spec
                    toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // @ts-ignore
                                return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                        name: 'index-name',
                                        dimension: 10,
                                    })];
                                case 1:
                                    // @ts-ignore
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, expect(toThrow).rejects.toThrow('You must pass a `pods` or `serverless` `spec` object in order to create an index.')];
                case 4:
                    _a.sent();
                    // Missing dimension
                    toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // @ts-ignore
                                return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                        name: 'index-name',
                                        spec: {
                                            pod: {
                                                environment: 'us-west1',
                                                pods: 1,
                                                podType: 'p1.x1',
                                            },
                                        },
                                    })];
                                case 1:
                                    // @ts-ignore
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, expect(toThrow).rejects.toThrow('You must pass a positive integer for `dimension` in order to create an index.')];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Throw error if unknown property is passed at top level', function () { return __awaiter(void 0, void 0, void 0, function () {
        var MIA, toThrow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    MIA = setupCreateIndexResponse(undefined, undefined);
                    toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                        // @ts-ignore
                                        dimensionlshgoiwe: 10,
                                        spec: {
                                            pod: {
                                                environment: 'us-west1',
                                                pods: 1,
                                                podType: 'p1.x1',
                                            },
                                        },
                                    })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError('Object contained invalid properties: dimensionlshgoiwe. Valid properties include spec, name, dimension, metric, deletionProtection, waitUntilReady, suppressConflicts.')];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Throw error if unknown property is passed at spec level', function () { return __awaiter(void 0, void 0, void 0, function () {
        var MIA, toThrow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    MIA = setupCreateIndexResponse(undefined, undefined);
                    toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                        name: 'index-name',
                                        dimension: 10,
                                        spec: {
                                            // @ts-ignore
                                            poddf: {
                                                environment: 'us-west1',
                                                pods: 1,
                                                podType: 'p1.x1',
                                            },
                                        },
                                    })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError('Object contained invalid properties: poddf. Valid properties include serverless, pod.')];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Throw error if unknown property is passed at spec/pod level', function () { return __awaiter(void 0, void 0, void 0, function () {
        var MIA, toThrow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    MIA = setupCreateIndexResponse(undefined, undefined);
                    toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                        name: 'index-name',
                                        dimension: 10,
                                        spec: {
                                            pod: {
                                                // @ts-ignore
                                                environmentsdf: 'us-west1',
                                                pods: 1,
                                                podType: 'p1.x1',
                                            },
                                        },
                                    })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError('Object contained invalid properties: environmentsdf. Valid properties include environment, replicas, shards, podType, pods, metadataConfig, sourceCollection.')];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Throw error if unknown property is passed at spec/serverless level', function () { return __awaiter(void 0, void 0, void 0, function () {
        var MIA, toThrow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    MIA = setupCreateIndexResponse(undefined, undefined);
                    toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                        name: 'index-name',
                                        dimension: 10,
                                        spec: {
                                            serverless: {
                                                // @ts-ignore
                                                cloudsdfd: 'wooo',
                                                region: 'us-west1',
                                            },
                                        },
                                    })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(toThrow).rejects.toThrowError('Object contained invalid properties: cloudsdfd. Valid properties include cloud, region.')];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    describe('waitUntilReady', function () {
        beforeEach(function () {
            jest.useFakeTimers();
        });
        afterEach(function () {
            jest.useRealTimers();
        });
        test('when passed waitUntilReady, calls the create index endpoint and begins polling describeIndex', function () { return __awaiter(void 0, void 0, void 0, function () {
            var MIA, returned;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        MIA = setupCreateIndexResponse(undefined, [
                            {
                                status: { ready: true, state: 'Ready' },
                            },
                        ]);
                        return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                name: 'index-name',
                                dimension: 10,
                                metric: 'cosine',
                                spec: {
                                    pod: {
                                        environment: 'us-west1',
                                        pods: 1,
                                        podType: 'p1.x1',
                                    },
                                },
                                waitUntilReady: true,
                            })];
                    case 1:
                        returned = _a.sent();
                        expect(returned).toEqual({ status: { ready: true, state: 'Ready' } });
                        expect(MIA.createIndex).toHaveBeenCalledWith({
                            createIndexRequest: {
                                name: 'index-name',
                                dimension: 10,
                                metric: 'cosine',
                                spec: {
                                    pod: {
                                        environment: 'us-west1',
                                        pods: 1,
                                        podType: 'p1.x1',
                                    },
                                },
                                waitUntilReady: true,
                            },
                        });
                        expect(MIA.describeIndex).toHaveBeenCalledWith({
                            indexName: 'index-name',
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        test('will continue polling describeIndex if the index is not yet ready', function () { return __awaiter(void 0, void 0, void 0, function () {
            var IOA, returned;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        IOA = setupCreateIndexResponse(undefined, [
                            {
                                status: { ready: false, state: 'Initializing' },
                            },
                            {
                                status: { ready: false, state: 'ScalingUp' },
                            },
                            {
                                status: { ready: false, state: 'ScalingUp' },
                            },
                            {
                                status: { ready: true, state: 'Ready' },
                            },
                        ]);
                        returned = (0, createIndex_1.createIndex)(IOA)({
                            name: 'index-name',
                            dimension: 10,
                            metric: 'cosine',
                            spec: {
                                pod: {
                                    environment: 'us-west1',
                                    pods: 1,
                                    podType: 'p1.x1',
                                },
                            },
                            waitUntilReady: true,
                        });
                        return [4 /*yield*/, jest.advanceTimersByTimeAsync(3000)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, returned.then(function (result) {
                                expect(result).toEqual({ status: { ready: true, state: 'Ready' } });
                                expect(IOA.describeIndex).toHaveBeenNthCalledWith(3, {
                                    indexName: 'index-name',
                                });
                            })];
                }
            });
        }); });
    });
});
//# sourceMappingURL=createIndex.test.js.map