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
describe('create index', function () {
    var indexName;
    var pinecone;
    beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            indexName = (0, test_helpers_1.randomIndexName)('createIndex');
            pinecone = new index_1.Pinecone();
            return [2 /*return*/];
        });
    }); });
    describe('happy path', function () {
        afterEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, pinecone.deleteIndex(indexName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        // TODO: Add create test for pod index when supported
        test('simple create', function () { return __awaiter(void 0, void 0, void 0, function () {
            var description;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, pinecone.createIndex({
                            name: indexName,
                            dimension: 5,
                            spec: {
                                serverless: {
                                    cloud: 'aws',
                                    region: 'us-west-2',
                                },
                            },
                            waitUntilReady: true,
                        })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, pinecone.describeIndex(indexName)];
                    case 2:
                        description = _a.sent();
                        expect(description.name).toEqual(indexName);
                        expect(description.dimension).toEqual(5);
                        expect(description.metric).toEqual('cosine');
                        expect(description.host).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        test('create with metric', function () { return __awaiter(void 0, void 0, void 0, function () {
            var description;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, pinecone.createIndex({
                            name: indexName,
                            dimension: 5,
                            metric: 'euclidean',
                            spec: {
                                serverless: {
                                    cloud: 'aws',
                                    region: 'us-west-2',
                                },
                            },
                            waitUntilReady: true,
                        })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, pinecone.describeIndex(indexName)];
                    case 2:
                        description = _a.sent();
                        expect(description.name).toEqual(indexName);
                        expect(description.dimension).toEqual(5);
                        expect(description.metric).toEqual('euclidean');
                        expect(description.host).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        test('create with utility prop: waitUntilReady', function () { return __awaiter(void 0, void 0, void 0, function () {
            var description;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, pinecone.createIndex({
                            name: indexName,
                            dimension: 5,
                            metric: 'cosine',
                            spec: {
                                serverless: {
                                    cloud: 'aws',
                                    region: 'us-west-2',
                                },
                            },
                            waitUntilReady: true,
                        })];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, pinecone.describeIndex(indexName)];
                    case 2:
                        description = _b.sent();
                        expect(description.name).toEqual(indexName);
                        expect((_a = description.status) === null || _a === void 0 ? void 0 : _a.state).toEqual('Ready');
                        return [2 /*return*/];
                }
            });
        }); });
        test('create with utility prop: suppressConflicts', function () { return __awaiter(void 0, void 0, void 0, function () {
            var description;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, pinecone.createIndex({
                            name: indexName,
                            dimension: 5,
                            metric: 'cosine',
                            spec: {
                                serverless: {
                                    cloud: 'aws',
                                    region: 'us-west-2',
                                },
                            },
                            waitUntilReady: true,
                        })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, pinecone.createIndex({
                                name: indexName,
                                dimension: 5,
                                metric: 'cosine',
                                spec: {
                                    serverless: {
                                        cloud: 'aws',
                                        region: 'us-west-2',
                                    },
                                },
                                suppressConflicts: true,
                                waitUntilReady: true,
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, pinecone.describeIndex(indexName)];
                    case 3:
                        description = _a.sent();
                        expect(description.name).toEqual(indexName);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('error cases', function () {
        test('create index with invalid index name', function () { return __awaiter(void 0, void 0, void 0, function () {
            var e_1, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, pinecone.createIndex({
                                name: indexName + '-',
                                dimension: 5,
                                metric: 'cosine',
                                spec: {
                                    serverless: {
                                        cloud: 'aws',
                                        region: 'us-west-2',
                                    },
                                },
                            })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _a.sent();
                        err = e_1;
                        expect(err.name).toEqual('PineconeBadRequestError');
                        expect(err.message).toContain('alphanumeric character');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        test('insufficient quota', function () { return __awaiter(void 0, void 0, void 0, function () {
            var e_2, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, pinecone.createIndex({
                                name: indexName,
                                dimension: 5,
                                metric: 'cosine',
                                spec: {
                                    serverless: {
                                        cloud: 'aws',
                                        region: 'us-west-2',
                                    },
                                },
                            })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_2 = _a.sent();
                        err = e_2;
                        expect(err.name).toEqual('PineconeBadRequestError');
                        expect(err.message).toContain('exceeds the project quota');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        // TODO: Re-enable
        test.skip('create from non-existent collection', function () { return __awaiter(void 0, void 0, void 0, function () {
            var e_3, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, pinecone.createIndex({
                                name: indexName,
                                dimension: 5,
                                metric: 'cosine',
                                spec: {
                                    pod: {
                                        environment: 'us-east-1-aws',
                                        podType: 'p1.x1',
                                        pods: 1,
                                        sourceCollection: 'non-existent-collection',
                                    },
                                },
                            })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_3 = _a.sent();
                        err = e_3;
                        expect(err.name).toEqual('PineconeNotFoundError');
                        expect(err.message).toContain('A call to https://api.pinecone.io/indexes returned HTTP status 404.');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=createIndex.test.js.map