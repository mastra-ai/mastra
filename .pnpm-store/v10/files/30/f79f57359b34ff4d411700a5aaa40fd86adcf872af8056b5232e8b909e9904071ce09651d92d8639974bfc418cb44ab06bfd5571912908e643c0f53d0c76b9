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
var fetch_1 = require("../fetch");
var query_1 = require("../query");
var update_1 = require("../update");
var upsert_1 = require("../upsert");
var dataOperationsProvider_1 = require("../dataOperationsProvider");
var index_1 = require("../index");
jest.mock('../fetch');
jest.mock('../query');
jest.mock('../update');
jest.mock('../upsert');
jest.mock('../dataOperationsProvider');
describe('Index', function () {
    var config;
    beforeEach(function () {
        config = {
            apiKey: 'test-api-key',
        };
    });
    describe('index initialization', function () {
        test('passes config, indexName, indexHostUrl, and additionalHeaders to DataOperationsProvider', function () {
            var indexHostUrl = 'https://test-api-pinecone.io';
            var additionalHeaders = { 'x-custom-header': 'custom-value' };
            new index_1.Index('index-name', config, undefined, indexHostUrl, additionalHeaders);
            expect(dataOperationsProvider_1.DataOperationsProvider).toHaveBeenCalledTimes(1);
            expect(dataOperationsProvider_1.DataOperationsProvider).toHaveBeenCalledWith(config, 'index-name', indexHostUrl, additionalHeaders);
        });
    });
    describe('metadata', function () {
        test('can write functions that take types with generic params', function () {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var fn1 = function (record) {
                // no type errors on this because typescript doesn't know anything about what keys are defined
                // ScoredPineconeRecord without specifying the generic type param
                console.log(record.metadata && record.metadata.yolo);
            };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            var fn2 = function (record) {
                console.log(record.metadata && record.metadata.name);
                // @ts-expect-error because bogus not in MyMeta
                console.log(record.metadata && record.metadata.bogus);
            };
        });
        test('can be used without generic types param', function () { return __awaiter(void 0, void 0, void 0, function () {
            var index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        index = new index_1.Index('index-name', config, 'namespace');
                        // You can use the index class without passing the generic type for metadata,
                        // but you lose type safety in that case.
                        return [4 /*yield*/, index.update({ id: '1', metadata: { foo: 'bar' } })];
                    case 1:
                        // You can use the index class without passing the generic type for metadata,
                        // but you lose type safety in that case.
                        _a.sent();
                        return [4 /*yield*/, index.update({ id: '1', metadata: { baz: 'quux' } })];
                    case 2:
                        _a.sent();
                        // Same thing with upsert. You can upsert anything in metadata field without type.
                        return [4 /*yield*/, index.upsert([
                                { id: '2', values: [0.1, 0.2], metadata: { hello: 'world' } },
                            ])];
                    case 3:
                        // Same thing with upsert. You can upsert anything in metadata field without type.
                        _a.sent();
                        // @ts-expect-error even when you haven't passed a generic type, it enforces the expected shape of RecordMetadata
                        return [4 /*yield*/, index.upsert([{ id: '2', values: [0.1, 0.2], metadata: 2 }])];
                    case 4:
                        // @ts-expect-error even when you haven't passed a generic type, it enforces the expected shape of RecordMetadata
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('preserves metadata typing through chained namespace calls', function () { return __awaiter(void 0, void 0, void 0, function () {
            var index, ns1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        index = new index_1.Index('index-name', config, 'namespace');
                        ns1 = index.namespace('ns1');
                        // @ts-expect-error because MovieMetadata metadata still expected after chained namespace call
                        return [4 /*yield*/, ns1.update({ id: '1', metadata: { title: 'Vertigo', rating: 5 } })];
                    case 1:
                        // @ts-expect-error because MovieMetadata metadata still expected after chained namespace call
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('upsert: has type errors when passing malformed metadata', function () { return __awaiter(void 0, void 0, void 0, function () {
            var index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        index = new index_1.Index('index-name', config, 'namespace');
                        expect(upsert_1.UpsertCommand).toHaveBeenCalledTimes(1);
                        // No ts errors when upserting with proper MovieMetadata
                        return [4 /*yield*/, index.upsert([
                                {
                                    id: '1',
                                    values: [0.1, 0.1, 0.1],
                                    metadata: {
                                        genre: 'romance',
                                        runtime: 120,
                                    },
                                },
                            ])];
                    case 1:
                        // No ts errors when upserting with proper MovieMetadata
                        _a.sent();
                        // No ts errors when upserting with no metadata
                        return [4 /*yield*/, index.upsert([
                                {
                                    id: '2',
                                    values: [0.1, 0.1, 0.1],
                                },
                            ])];
                    case 2:
                        // No ts errors when upserting with no metadata
                        _a.sent();
                        // ts error expected when passing metadata that doesn't match MovieMetadata
                        return [4 /*yield*/, index.upsert([
                                {
                                    id: '3',
                                    values: [0.1, 0.1, 0.1],
                                    metadata: {
                                        // @ts-expect-error
                                        somethingElse: 'foo',
                                    },
                                },
                            ])];
                    case 3:
                        // ts error expected when passing metadata that doesn't match MovieMetadata
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('fetch: response is typed with generic metadata type', function () { return __awaiter(void 0, void 0, void 0, function () {
            var index, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        index = new index_1.Index('index-name', config, 'namespace');
                        expect(fetch_1.FetchCommand).toHaveBeenCalledTimes(1);
                        return [4 /*yield*/, index.fetch(['1'])];
                    case 1:
                        response = _a.sent();
                        if (response && response.records) {
                            // eslint-disable-next-line
                            Object.entries(response.records).forEach(function (_a) {
                                var _b, _c, _d;
                                var key = _a[0], value = _a[1];
                                // No errors on these because they are properties from MovieMetadata
                                console.log((_b = value.metadata) === null || _b === void 0 ? void 0 : _b.genre);
                                console.log((_c = value.metadata) === null || _c === void 0 ? void 0 : _c.runtime);
                                // @ts-expect-error because result is expecting metadata to be MovieMetadata
                                console.log((_d = value.metadata) === null || _d === void 0 ? void 0 : _d.bogus);
                            });
                        }
                        return [2 /*return*/];
                }
            });
        }); });
        test('query: returns typed results', function () { return __awaiter(void 0, void 0, void 0, function () {
            var index, results, firstResult;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        index = new index_1.Index('index-name', config, 'namespace');
                        expect(query_1.QueryCommand).toHaveBeenCalledTimes(1);
                        return [4 /*yield*/, index.query({ id: '1', topK: 5 })];
                    case 1:
                        results = _d.sent();
                        if (results && results.matches) {
                            if (results.matches.length > 0) {
                                firstResult = results.matches[0];
                                // no ts error because score is part of ScoredPineconeRecord
                                console.log(firstResult.score);
                                // no ts error because genre and runtime part of MovieMetadata
                                console.log((_a = firstResult.metadata) === null || _a === void 0 ? void 0 : _a.genre);
                                console.log((_b = firstResult.metadata) === null || _b === void 0 ? void 0 : _b.runtime);
                                // @ts-expect-error because bogus not part of MovieMetadata
                                console.log((_c = firstResult.metadata) === null || _c === void 0 ? void 0 : _c.bogus);
                            }
                        }
                        return [2 /*return*/];
                }
            });
        }); });
        test('update: has typed arguments', function () { return __awaiter(void 0, void 0, void 0, function () {
            var index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        index = new index_1.Index('index-name', config, 'namespace');
                        expect(update_1.UpdateCommand).toHaveBeenCalledTimes(1);
                        // Can update metadata only without ts errors
                        return [4 /*yield*/, index.update({
                                id: '1',
                                metadata: { genre: 'romance', runtime: 90 },
                            })];
                    case 1:
                        // Can update metadata only without ts errors
                        _a.sent();
                        // Can update values only without ts errors
                        return [4 /*yield*/, index.update({ id: '2', values: [0.1, 0.2, 0.3] })];
                    case 2:
                        // Can update values only without ts errors
                        _a.sent();
                        // Can update sparseValues only without ts errors
                        return [4 /*yield*/, index.update({
                                id: '3',
                                sparseValues: { indices: [0, 3], values: [0.2, 0.5] },
                            })];
                    case 3:
                        // Can update sparseValues only without ts errors
                        _a.sent();
                        // Can update all fields without ts errors
                        return [4 /*yield*/, index.update({
                                id: '4',
                                values: [0.1, 0.2, 0.3],
                                sparseValues: { indices: [0], values: [0.789] },
                                metadata: { genre: 'horror', runtime: 10 },
                            })];
                    case 4:
                        // Can update all fields without ts errors
                        _a.sent();
                        // @ts-expect-error when id is missing
                        return [4 /*yield*/, index.update({ metadata: { genre: 'drama', runtime: 97 } })];
                    case 5:
                        // @ts-expect-error when id is missing
                        _a.sent();
                        // @ts-expect-error when metadata has unexpected fields
                        return [4 /*yield*/, index.update({ id: '5', metadata: { title: 'Vertigo' } })];
                    case 6:
                        // @ts-expect-error when metadata has unexpected fields
                        _a.sent();
                        return [4 /*yield*/, index.update({
                                id: '6',
                                // @ts-expect-error when metadata has extra properties
                                metadata: { genre: 'comedy', runtime: 80, title: 'Miss Congeniality' },
                            })];
                    case 7:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=index.test.js.map