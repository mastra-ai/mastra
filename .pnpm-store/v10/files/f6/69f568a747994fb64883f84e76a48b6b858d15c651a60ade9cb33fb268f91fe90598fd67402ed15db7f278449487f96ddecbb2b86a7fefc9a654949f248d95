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
var query_1 = require("../query");
var errors_1 = require("../../errors");
var dataOperationsProvider_1 = require("../dataOperationsProvider");
jest.mock('../dataOperationsProvider');
jest.mock('../types');
describe('Query command tests', function () {
    var apiProvider;
    var pineconeConfig;
    beforeEach(function () {
        apiProvider = new dataOperationsProvider_1.DataOperationsProvider(pineconeConfig, 'index-name');
        apiProvider.provide.mockResolvedValue({
            query: jest.fn().mockResolvedValue({ matches: [] }),
        });
    });
    test('should throw error when known property is misspelled', function () { return __awaiter(void 0, void 0, void 0, function () {
        var queryCommand;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queryCommand = new query_1.QueryCommand(apiProvider, 'test-namespace');
                    return [4 /*yield*/, expect(
                        // @ts-ignore
                        queryCommand.run({ id: 'abc', topK: 2, includeMetadataaaaa: true })).rejects.toThrow(errors_1.PineconeArgumentError)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(
                        // @ts-ignore
                        queryCommand.run({ id: 'abc', topK: 2, includeMetadataaaaa: true })).rejects.toThrow('Object contained invalid properties: includeMetadataaaaa. Valid properties include id, vector, sparseVector,' +
                            ' includeValues, includeMetadata, filter, topK.')];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('should throw error when no options obj is passed', function () { return __awaiter(void 0, void 0, void 0, function () {
        var queryCommand;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queryCommand = new query_1.QueryCommand(apiProvider, 'test-namespace');
                    // @ts-ignore
                    return [4 /*yield*/, expect(queryCommand.run()).rejects.toThrow(errors_1.PineconeArgumentError)];
                case 1:
                    // @ts-ignore
                    _a.sent();
                    // @ts-ignore
                    return [4 /*yield*/, expect(queryCommand.run()).rejects.toThrow('You must enter a query configuration object to query the index.')];
                case 2:
                    // @ts-ignore
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('should throw error when topK is not passed', function () { return __awaiter(void 0, void 0, void 0, function () {
        var queryCommand;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queryCommand = new query_1.QueryCommand(apiProvider, 'test-namespace');
                    // @ts-ignore
                    return [4 /*yield*/, expect(queryCommand.run({})).rejects.toThrow(errors_1.PineconeArgumentError)];
                case 1:
                    // @ts-ignore
                    _a.sent();
                    // @ts-ignore
                    return [4 /*yield*/, expect(queryCommand.run({})).rejects.toThrow('You must enter an integer for the `topK` search results to be returned.')];
                case 2:
                    // @ts-ignore
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('should throw error when topK is negative', function () { return __awaiter(void 0, void 0, void 0, function () {
        var queryCommand;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queryCommand = new query_1.QueryCommand(apiProvider, 'test-namespace');
                    return [4 /*yield*/, expect(queryCommand.run({ id: 'some-id', topK: -100 })).rejects.toThrow('`topK` property must be greater than 0.')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(queryCommand.run({ id: 'some-id', topK: -100 })).rejects.toThrow(errors_1.PineconeArgumentError)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('should throw error when filter is empty', function () { return __awaiter(void 0, void 0, void 0, function () {
        var queryCommand;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queryCommand = new query_1.QueryCommand(apiProvider, 'test-namespace');
                    return [4 /*yield*/, expect(queryCommand.run({ id: 'some-id', topK: 1, filter: {} })).rejects.toThrow('You must enter a `filter` object with at least one key-value pair.')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(queryCommand.run({ id: 'some-id', topK: 1, filter: {} })).rejects.toThrow(errors_1.PineconeArgumentError)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('should throw error when id is blank string', function () { return __awaiter(void 0, void 0, void 0, function () {
        var queryCommand;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queryCommand = new query_1.QueryCommand(apiProvider, 'test-namespace');
                    return [4 /*yield*/, expect(queryCommand.run({ id: '', topK: 1 })).rejects.toThrow('You must enter non-empty string for `id` to query by record ID.')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(queryCommand.run({ id: '', topK: 1 })).rejects.toThrow(errors_1.PineconeArgumentError)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('should throw error when vector is empty array', function () { return __awaiter(void 0, void 0, void 0, function () {
        var queryCommand;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queryCommand = new query_1.QueryCommand(apiProvider, 'test-namespace');
                    return [4 /*yield*/, expect(queryCommand.run({ vector: [], topK: 1 })).rejects.toThrow('You must enter an array of `RecordValues` in order to query by vector values.')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, expect(queryCommand.run({ vector: [], topK: 1 })).rejects.toThrow(errors_1.PineconeArgumentError)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('should throw error when sparseVector indices or values is empty array', function () { return __awaiter(void 0, void 0, void 0, function () {
        var queryCommand;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    queryCommand = new query_1.QueryCommand(apiProvider, 'test-namespace');
                    // Missing indices
                    return [4 /*yield*/, expect(queryCommand.run({
                            vector: [0.2, 0.1],
                            topK: 1,
                            sparseVector: { indices: [], values: [0.1, 0.2] },
                        })).rejects.toThrow('You must enter a `RecordSparseValues` object with `indices` and `values` properties in order to query by' +
                            ' sparse vector values.')];
                case 1:
                    // Missing indices
                    _a.sent();
                    return [4 /*yield*/, expect(queryCommand.run({
                            vector: [0.2, 0.1],
                            topK: 1,
                            sparseVector: { indices: [], values: [0.1, 0.2] },
                        })).rejects.toThrow(errors_1.PineconeArgumentError)];
                case 2:
                    _a.sent();
                    // Missing values
                    return [4 /*yield*/, expect(queryCommand.run({
                            vector: [0.2, 0.1],
                            topK: 1,
                            sparseVector: { indices: [0.1, 0.2], values: [] },
                        })).rejects.toThrow('You must enter a `RecordSparseValues` object with `indices` and `values` properties in order to query by' +
                            ' sparse vector values.')];
                case 3:
                    // Missing values
                    _a.sent();
                    return [4 /*yield*/, expect(queryCommand.run({
                            vector: [0.2, 0.1],
                            topK: 1,
                            sparseVector: { indices: [0.1, 0.2], values: [] },
                        })).rejects.toThrow(errors_1.PineconeArgumentError)];
                case 4:
                    _a.sent();
                    // Missing both indices and values
                    return [4 /*yield*/, expect(queryCommand.run({
                            vector: [0.2, 0.1],
                            topK: 1,
                            sparseVector: { indices: [], values: [] },
                        })).rejects.toThrow('You must enter a `RecordSparseValues` object with `indices` and `values` properties in order to query by' +
                            ' sparse vector values.')];
                case 5:
                    // Missing both indices and values
                    _a.sent();
                    return [4 /*yield*/, expect(queryCommand.run({
                            vector: [0.2, 0.1],
                            topK: 1,
                            sparseVector: { indices: [], values: [] },
                        })).rejects.toThrow(errors_1.PineconeArgumentError)];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=query.test.js.map