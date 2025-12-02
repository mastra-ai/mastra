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
var index_1 = require("../../index");
var test_helpers_1 = require("../test-helpers");
describe('query', function () {
    var pinecone, index, ns, namespace, recordIds, numberOfRecords;
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var recordsToUpsert;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pinecone = new index_1.Pinecone();
                    return [4 /*yield*/, pinecone.createIndex({
                            name: test_helpers_1.INDEX_NAME,
                            dimension: 5,
                            metric: 'cosine',
                            spec: {
                                serverless: {
                                    region: 'us-west-2',
                                    cloud: 'aws',
                                },
                            },
                            waitUntilReady: true,
                            suppressConflicts: true,
                        })];
                case 1:
                    _a.sent();
                    namespace = (0, test_helpers_1.randomString)(16);
                    index = pinecone.index(test_helpers_1.INDEX_NAME);
                    ns = index.namespace(namespace);
                    numberOfRecords = 3;
                    recordsToUpsert = (0, test_helpers_1.generateRecords)({
                        dimension: 5,
                        quantity: numberOfRecords,
                        withSparseValues: true,
                    });
                    expect(recordsToUpsert).toHaveLength(3);
                    expect(recordsToUpsert[0].id).toEqual('0');
                    expect(recordsToUpsert[1].id).toEqual('1');
                    expect(recordsToUpsert[2].id).toEqual('2');
                    return [4 /*yield*/, ns.upsert(recordsToUpsert)];
                case 2:
                    _a.sent();
                    recordIds = recordsToUpsert.map(function (r) { return r.id; });
                    return [4 /*yield*/, (0, test_helpers_1.waitUntilRecordsReady)(ns, namespace, recordIds)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ns.deleteMany(recordIds)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('query by id', function () { return __awaiter(void 0, void 0, void 0, function () {
        var topK, queryId, assertions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    topK = 2;
                    queryId = recordIds[0];
                    assertions = function (results) {
                        var _a;
                        expect(results.matches).toBeDefined();
                        expect((_a = results.matches) === null || _a === void 0 ? void 0 : _a.length).toEqual(topK);
                        expect(results.usage.readUnits).toBeDefined();
                        expect(results.matches).toEqual(expect.arrayContaining([expect.objectContaining({ id: queryId })]));
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.query({ id: queryId, topK: topK }); }, assertions)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('query when topK is greater than number of records', function () { return __awaiter(void 0, void 0, void 0, function () {
        var topK, queryId, assertions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    topK = numberOfRecords + 2;
                    queryId = recordIds[1];
                    assertions = function (results) {
                        var _a;
                        expect(results.matches).toBeDefined();
                        expect((_a = results.matches) === null || _a === void 0 ? void 0 : _a.length).toEqual(numberOfRecords);
                        expect(results.usage.readUnits).toBeDefined();
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.query({ id: queryId, topK: topK }); }, assertions)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('with invalid id, returns empty results', function () { return __awaiter(void 0, void 0, void 0, function () {
        var topK, assertions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    topK = 2;
                    assertions = function (results) {
                        var _a;
                        expect(results.matches).toBeDefined();
                        expect((_a = results.matches) === null || _a === void 0 ? void 0 : _a.length).toEqual(0);
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.query({ id: '12354523423', topK: topK }); }, assertions)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('query with vector and sparseVector values', function () { return __awaiter(void 0, void 0, void 0, function () {
        var topK, assertions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    topK = 1;
                    assertions = function (results) {
                        var _a;
                        expect(results.matches).toBeDefined();
                        expect((_a = results.matches) === null || _a === void 0 ? void 0 : _a.length).toEqual(topK);
                        expect(results.usage.readUnits).toBeDefined();
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () {
                            return ns.query({
                                vector: [0.11, 0.22, 0.33, 0.44, 0.55],
                                sparseVector: {
                                    indices: [32, 5, 3, 2, 1],
                                    values: [0.11, 0.22, 0.33, 0.44, 0.55],
                                },
                                topK: topK,
                            });
                        }, assertions)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('query with includeValues: true', function () { return __awaiter(void 0, void 0, void 0, function () {
        var queryVec, sparseVec, assertions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queryVec = Array.from({ length: 5 }, function () { return Math.random(); });
                    sparseVec = {
                        indices: [0, 1, 2, 3, 4],
                        values: Array.from({ length: 5 }, function () { return Math.random(); }),
                    };
                    assertions = function (results) {
                        var _a;
                        expect(results.matches).toBeDefined();
                        expect((_a = results.matches) === null || _a === void 0 ? void 0 : _a.length).toEqual(2);
                        expect(results.usage.readUnits).toBeDefined();
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () {
                            return ns.query({
                                vector: queryVec,
                                sparseVector: sparseVec,
                                topK: 2,
                                includeValues: true,
                                includeMetadata: true,
                            });
                        }, assertions)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=query.test.js.map