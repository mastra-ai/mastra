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
describe('configure index', function () {
    var podIndexName, serverlessIndexName;
    var pinecone;
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pinecone = new index_1.Pinecone();
                    podIndexName = (0, test_helpers_1.randomIndexName)('configureIndex');
                    serverlessIndexName = (0, test_helpers_1.randomIndexName)('configureIndex');
                    // create pod index
                    return [4 /*yield*/, pinecone.createIndex({
                            name: podIndexName,
                            dimension: 5,
                            metric: 'cosine',
                            spec: {
                                pod: {
                                    environment: 'us-east1-gcp',
                                    podType: 'p1.x1',
                                    pods: 1,
                                },
                            },
                            waitUntilReady: true,
                        })];
                case 1:
                    // create pod index
                    _a.sent();
                    // create serverless index
                    return [4 /*yield*/, pinecone.createIndex({
                            name: serverlessIndexName,
                            dimension: 5,
                            metric: 'cosine',
                            spec: {
                                serverless: {
                                    cloud: 'aws',
                                    region: 'us-east-1',
                                },
                            },
                            waitUntilReady: true,
                        })];
                case 2:
                    // create serverless index
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // wait until indexes are done upgrading before deleting
                return [4 /*yield*/, (0, test_helpers_1.waitUntilReady)(podIndexName)];
                case 1:
                    // wait until indexes are done upgrading before deleting
                    _a.sent();
                    return [4 /*yield*/, (0, test_helpers_1.waitUntilReady)(serverlessIndexName)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, pinecone.deleteIndex(podIndexName)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, pinecone.deleteIndex(serverlessIndexName)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    describe('pod index', function () {
        test('scale replicas up', function () { return __awaiter(void 0, void 0, void 0, function () {
            var description, description2;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, pinecone.describeIndex(podIndexName)];
                    case 1:
                        description = _c.sent();
                        expect((_a = description.spec.pod) === null || _a === void 0 ? void 0 : _a.replicas).toEqual(1);
                        return [4 /*yield*/, pinecone.configureIndex(podIndexName, {
                                spec: { pod: { replicas: 2 } },
                            })];
                    case 2:
                        _c.sent();
                        return [4 /*yield*/, pinecone.describeIndex(podIndexName)];
                    case 3:
                        description2 = _c.sent();
                        expect((_b = description2.spec.pod) === null || _b === void 0 ? void 0 : _b.replicas).toEqual(2);
                        return [2 /*return*/];
                }
            });
        }); });
        test('scale podType up', function () { return __awaiter(void 0, void 0, void 0, function () {
            var description, description2;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, pinecone.describeIndex(podIndexName)];
                    case 1:
                        description = _c.sent();
                        expect((_a = description.spec.pod) === null || _a === void 0 ? void 0 : _a.podType).toEqual('p1.x1');
                        return [4 /*yield*/, pinecone.configureIndex(podIndexName, {
                                spec: { pod: { podType: 'p1.x2' } },
                            })];
                    case 2:
                        _c.sent();
                        return [4 /*yield*/, pinecone.describeIndex(podIndexName)];
                    case 3:
                        description2 = _c.sent();
                        expect((_b = description2.spec.pod) === null || _b === void 0 ? void 0 : _b.podType).toEqual('p1.x2');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('serverless index', function () {
        test('enable and disable deletionProtection', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, pinecone.configureIndex(serverlessIndexName, {
                            deletionProtection: 'enabled',
                        })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_helpers_1.waitUntilReady)(serverlessIndexName)];
                    case 2:
                        _a.sent();
                        // verify we cannot delete the index
                        return [4 /*yield*/, pinecone.deleteIndex(serverlessIndexName).catch(function (e) {
                                var err = e;
                                expect(err.name).toEqual('PineconeBadRequestError');
                                expect(err.message).toContain('Deletion protection is enabled for this index');
                            })];
                    case 3:
                        // verify we cannot delete the index
                        _a.sent();
                        // disable so we can clean the index up
                        return [4 /*yield*/, pinecone.configureIndex(serverlessIndexName, {
                                deletionProtection: 'disabled',
                            })];
                    case 4:
                        // disable so we can clean the index up
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('error cases', function () {
        test('cannot configure index with invalid index name', function () { return __awaiter(void 0, void 0, void 0, function () {
            var e_1, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, pinecone.configureIndex('non-existent-index', {
                                spec: { pod: { replicas: 2 } },
                            })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _a.sent();
                        err = e_1;
                        expect(err.name).toEqual('PineconeNotFoundError');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        test('cannot configure index when exceeding quota', function () { return __awaiter(void 0, void 0, void 0, function () {
            var e_2, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, pinecone.configureIndex(podIndexName, {
                                spec: { pod: { replicas: 20 } },
                            })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_2 = _a.sent();
                        err = e_2;
                        expect(err.name).toEqual('PineconeBadRequestError');
                        expect(err.message).toContain("You've reached the max pods allowed in project");
                        expect(err.message).toContain('To increase this limit, adjust your project settings in the console');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        test('cannot change base pod type', function () { return __awaiter(void 0, void 0, void 0, function () {
            var e_3, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // Try to change the base pod type
                        return [4 /*yield*/, pinecone.configureIndex(podIndexName, {
                                spec: { pod: { podType: 'p2.x1' } },
                            })];
                    case 1:
                        // Try to change the base pod type
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_3 = _a.sent();
                        err = e_3;
                        expect(err.name).toEqual('PineconeBadRequestError');
                        expect(err.message).toContain('Bad request: Cannot change pod type');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        test('cannot set deletionProtection value other than enabled / disabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var e_4, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, pinecone.configureIndex(serverlessIndexName, {
                                // @ts-expect-error
                                deletionProtection: 'bogus',
                            })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_4 = _a.sent();
                        err = e_4;
                        expect(err.name).toEqual('PineconeBadRequestError');
                        expect(err.message).toContain('Invalid deletion_protection, value should be either enabled or disabled');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        test('cannot configure pod spec for serverless', function () { return __awaiter(void 0, void 0, void 0, function () {
            var e_5, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, pinecone.configureIndex(serverlessIndexName, {
                                spec: { pod: { replicas: 2 } },
                            })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_5 = _a.sent();
                        err = e_5;
                        expect(err.name).toEqual('PineconeBadRequestError');
                        expect(err.message).toContain('Configuring replicas and pod type is not supported for serverless');
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=configureIndex.test.js.map