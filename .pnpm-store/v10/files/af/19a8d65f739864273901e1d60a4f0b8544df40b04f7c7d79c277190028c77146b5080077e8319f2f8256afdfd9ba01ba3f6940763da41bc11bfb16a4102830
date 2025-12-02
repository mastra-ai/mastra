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
describe('describe index', function () {
    var indexName;
    var pinecone;
    describe('happy path', function () {
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        indexName = (0, test_helpers_1.randomIndexName)('describeIndex');
                        pinecone = new index_1.Pinecone();
                        return [4 /*yield*/, pinecone.createIndex({
                                name: indexName,
                                dimension: 5,
                                metric: 'cosine',
                                spec: {
                                    serverless: {
                                        region: 'us-west-2',
                                        cloud: 'aws',
                                    },
                                },
                                waitUntilReady: true,
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
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
        test('describe index', function () { return __awaiter(void 0, void 0, void 0, function () {
            var description;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, pinecone.describeIndex(indexName)];
                    case 1:
                        description = _c.sent();
                        expect(description.name).toEqual(indexName);
                        expect(description.dimension).toEqual(5);
                        expect(description.metric).toEqual('cosine');
                        expect(description.host).toBeDefined();
                        expect(description.spec.serverless).toBeDefined();
                        expect((_a = description.spec.serverless) === null || _a === void 0 ? void 0 : _a.cloud).toEqual('aws');
                        expect((_b = description.spec.serverless) === null || _b === void 0 ? void 0 : _b.region).toEqual('us-west-2');
                        expect(description.status.ready).toEqual(true);
                        expect(description.status.state).toEqual('Ready');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('error case', function () {
        test('describe index with invalid index name', function () { return __awaiter(void 0, void 0, void 0, function () {
            var e_1, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        expect.assertions(1);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, pinecone.describeIndex('non-existent-index')];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        e_1 = _a.sent();
                        err = e_1;
                        expect(err.name).toEqual('PineconeNotFoundError');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=describeIndex.test.js.map