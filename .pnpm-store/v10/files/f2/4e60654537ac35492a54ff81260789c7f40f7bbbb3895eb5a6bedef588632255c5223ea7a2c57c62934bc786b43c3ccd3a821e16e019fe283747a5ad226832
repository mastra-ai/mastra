"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
describe('upsert and update', function () {
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
    afterEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ns.deleteMany(recordIds)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('verify upsert and update', function () { return __awaiter(void 0, void 0, void 0, function () {
        var recordToUpsert, oldMetadata, preUpdateAssertions, newValues, newMetadata, postUpdateAssertions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    recordToUpsert = (0, test_helpers_1.generateRecords)({
                        dimension: 5,
                        quantity: 1,
                        withSparseValues: false,
                        withMetadata: true,
                    });
                    recordIds = recordToUpsert.map(function (r) { return r.id; });
                    oldMetadata = recordToUpsert['0'].metadata;
                    expect(recordToUpsert).toHaveLength(1);
                    expect(recordToUpsert[0].id).toEqual('0');
                    return [4 /*yield*/, ns.upsert(recordToUpsert)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_helpers_1.waitUntilRecordsReady)(ns, namespace, recordIds)];
                case 2:
                    _a.sent();
                    preUpdateAssertions = function (response) {
                        expect(response.records['0']).toBeDefined();
                        expect(response.records['0'].values).toEqual(recordToUpsert[0].values);
                        expect(response.records['0'].metadata).toEqual(recordToUpsert[0].metadata);
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.fetch(recordIds); }, preUpdateAssertions)];
                case 3:
                    _a.sent();
                    newValues = [0.5, 0.4, 0.3, 0.2, 0.1];
                    newMetadata = { flavor: 'chocolate' };
                    return [4 /*yield*/, ns.update({
                            id: '0',
                            values: newValues,
                            metadata: newMetadata,
                        })];
                case 4:
                    _a.sent();
                    postUpdateAssertions = function (response) {
                        expect(response.records['0'].values).toEqual(newValues);
                        expect(response.records['0'].metadata).toEqual(__assign(__assign({}, oldMetadata), newMetadata));
                    };
                    return [4 /*yield*/, (0, test_helpers_1.assertWithRetries)(function () { return ns.fetch(['0']); }, postUpdateAssertions)];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=upsertAndUpdate.test.js.map