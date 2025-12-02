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
describe('delete', function () {
    var pinecone, index, ns, namespace, recordIds;
    beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
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
    test('verify delete with id', function () { return __awaiter(void 0, void 0, void 0, function () {
        var recordToUpsert, stats, fetchAssertions, deleteAssertions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    recordToUpsert = (0, test_helpers_1.generateRecords)({ dimension: 5, quantity: 1 });
                    recordIds = recordToUpsert.map(function (r) { return r.id; });
                    expect(recordToUpsert).toHaveLength(1);
                    expect(recordToUpsert[0].id).toEqual(recordIds[0]);
                    return [4 /*yield*/, ns.upsert(recordToUpsert)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_helpers_1.waitUntilRecordsReady)(ns, namespace, recordIds)];
                case 2:
                    stats = _a.sent();
                    if (stats.namespaces) {
                        expect(stats.namespaces[namespace].recordCount).toEqual(1);
                    }
                    else {
                        fail('Expected namespaces to be defined');
                    }
                    fetchAssertions = function (results) {
                        if (results.records) {
                            expect(results.records['0'].id).toEqual('0');
                            expect(results.records['0'].values.length).toEqual(5);
                        }
                        else {
                            fail('Did not find expected records. Fetch result was ' +
                                JSON.stringify(results));
                        }
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.fetch(['0']); }, fetchAssertions)];
                case 3:
                    _a.sent();
                    // Try deleting the record
                    return [4 /*yield*/, ns.deleteOne('0')];
                case 4:
                    // Try deleting the record
                    _a.sent();
                    deleteAssertions = function (stats) {
                        expect(stats.namespaces[namespace]).toBeUndefined();
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.describeIndexStats(); }, deleteAssertions)];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('verify deleteMany with ids', function () { return __awaiter(void 0, void 0, void 0, function () {
        var recordsToUpsert, stats, fetchAssertions, deleteAssertions, fetchAssertions2, deleteAssertions2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    recordsToUpsert = (0, test_helpers_1.generateRecords)({ dimension: 5, quantity: 3 });
                    recordIds = recordsToUpsert.map(function (r) { return r.id; });
                    expect(recordsToUpsert).toHaveLength(3);
                    expect(recordsToUpsert[0].id).toEqual('0');
                    expect(recordsToUpsert[1].id).toEqual('1');
                    expect(recordsToUpsert[2].id).toEqual('2');
                    return [4 /*yield*/, ns.upsert(recordsToUpsert)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_helpers_1.waitUntilRecordsReady)(ns, namespace, recordIds)];
                case 2:
                    stats = _a.sent();
                    if (stats.namespaces) {
                        expect(stats.namespaces[namespace].recordCount).toEqual(3);
                    }
                    else {
                        fail('Expected namespaces to be defined');
                    }
                    fetchAssertions = function (results) {
                        if (results.records) {
                            expect(results.records['0'].id).toEqual('0');
                            expect(results.records['0'].values.length).toEqual(5);
                        }
                        else {
                            fail('Did not find expected records. Fetch result was ' +
                                JSON.stringify(results));
                        }
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.fetch(['0']); }, fetchAssertions)];
                case 3:
                    _a.sent();
                    // Try deleting 2 of 3 records
                    return [4 /*yield*/, ns.deleteMany(['0', '2'])];
                case 4:
                    // Try deleting 2 of 3 records
                    _a.sent();
                    deleteAssertions = function (stats) {
                        if (stats.namespaces) {
                            expect(stats.namespaces[namespace].recordCount).toEqual(1);
                        }
                        else {
                            fail('Expected namespaces to be defined (second call). Stats were ' +
                                JSON.stringify(stats));
                        }
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.describeIndexStats(); }, deleteAssertions)];
                case 5:
                    _a.sent();
                    fetchAssertions2 = function (results) {
                        if (results.records2) {
                            expect(results.records2['1']).not.toBeUndefined();
                        }
                        else {
                            fail('Expected record 2 to be defined. Fetch result was ' +
                                JSON.stringify(results));
                        }
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.fetch(['1']); }, fetchAssertions2)];
                case 6:
                    _a.sent();
                    // deleting non-existent records should not throw
                    return [4 /*yield*/, ns.deleteMany(['0', '1', '2', '3'])];
                case 7:
                    // deleting non-existent records should not throw
                    _a.sent();
                    deleteAssertions2 = function (stats) {
                        if (stats.namespaces) {
                            expect(stats.namespaces[namespace]).toBeUndefined();
                        }
                        else {
                            // no-op. This shouldn't actually happen unless there
                            // are leftover namespaces from previous runs that
                            // failed or stopped without proper cleanup.
                        }
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.describeIndexStats(); }, deleteAssertions2)];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=delete.test.js.map