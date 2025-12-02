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
var createCollection_1 = require("../createCollection");
var errors_1 = require("../../errors");
var setOpenAPIResponse = function (fakeCreateCollectionResponse) {
    var fakeCreateCollection = jest
        .fn()
        .mockImplementation(fakeCreateCollectionResponse);
    var fakeListIndexes = jest
        .fn()
        .mockImplementation(function () {
        return Promise.resolve({
            indexes: [
                {
                    name: 'index-1',
                    dimension: 1,
                    metric: 'cosine',
                    host: '123-345-abcd.io',
                    spec: {
                        pod: {
                            environment: 'us-west1',
                            replicas: 1,
                            shards: 1,
                            podType: 'p1.x1',
                            pods: 1,
                        },
                    },
                    status: { ready: true, state: 'Ready' },
                },
                {
                    name: 'index-2',
                    dimension: 3,
                    metric: 'cosine',
                    host: '321-543-bcda.io',
                    spec: {
                        pod: {
                            environment: 'us-west1',
                            replicas: 1,
                            shards: 1,
                            podType: 'p1.x1',
                            pods: 1,
                        },
                    },
                    status: { ready: true, state: 'Ready' },
                },
            ],
        });
    });
    var IOA = {
        createCollection: fakeCreateCollection,
        listIndexes: fakeListIndexes,
    };
    return IOA;
};
describe('createCollection', function () {
    describe('argument validations', function () {
        test('throws if no arguments are provided', function () { return __awaiter(void 0, void 0, void 0, function () {
            var IOA, toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        IOA = setOpenAPIResponse(function () { return Promise.resolve(''); });
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: 
                                    // @ts-ignore
                                    return [4 /*yield*/, (0, createCollection_1.createCollection)(IOA)()];
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
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass a non-empty object with `name` and `source` fields in order to create a collection.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('throws if empty object', function () { return __awaiter(void 0, void 0, void 0, function () {
            var IOA, toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        IOA = setOpenAPIResponse(function () { return Promise.resolve(''); });
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: 
                                    // @ts-ignore
                                    return [4 /*yield*/, (0, createCollection_1.createCollection)(IOA)({})];
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
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('The argument to createCollection must have required properties: `name`, `source`.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('throws if unknown property is added', function () { return __awaiter(void 0, void 0, void 0, function () {
            var IOA, toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        IOA = setOpenAPIResponse(function () { return Promise.resolve(''); });
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, createCollection_1.createCollection)(IOA)({
                                            name: 'collection-name',
                                            source: 'index-name',
                                            // @ts-ignore
                                            unknown: 'property',
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
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('Object contained invalid properties: unknown. Valid properties include source, name.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('throws if known property is misspelled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var IOA, toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        IOA = setOpenAPIResponse(function () { return Promise.resolve(''); });
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, createCollection_1.createCollection)(IOA)({
                                            name: 'collection-name',
                                            // @ts-ignore
                                            sourceeeee: 'index-name',
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
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('Object contained invalid properties: sourceeeee. Valid properties include source, name.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('throws if name is not provided', function () { return __awaiter(void 0, void 0, void 0, function () {
            var IOA, toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        IOA = setOpenAPIResponse(function () { return Promise.resolve(''); });
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, createCollection_1.createCollection)(IOA)({
                                            name: '',
                                            source: 'index-name',
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
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass a non-empty string for `name` in order to create a collection.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('throws if source is not provided', function () { return __awaiter(void 0, void 0, void 0, function () {
            var IOA, toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        IOA = setOpenAPIResponse(function () { return Promise.resolve(''); });
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: 
                                    // @ts-ignore
                                    return [4 /*yield*/, (0, createCollection_1.createCollection)(IOA)({ name: 'collection-name' })];
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
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass a non-empty string for `source` in order to create a collection.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('throws if source is blank', function () { return __awaiter(void 0, void 0, void 0, function () {
            var IOA, toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        IOA = setOpenAPIResponse(function () { return Promise.resolve(''); });
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, createCollection_1.createCollection)(IOA)({
                                            name: 'collection-name',
                                            source: '',
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
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass a non-empty string for `source` in order to create a collection.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    test('calls the openapi create collection endpoint', function () { return __awaiter(void 0, void 0, void 0, function () {
        var collectionModel, IOA, returned;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    collectionModel = {
                        name: 'collection-name',
                        size: 12346,
                        status: 'Initializing',
                        dimension: 5,
                        recordCount: 50,
                        environment: 'us-east1-gcp',
                    };
                    IOA = setOpenAPIResponse(function () { return Promise.resolve(collectionModel); });
                    return [4 /*yield*/, (0, createCollection_1.createCollection)(IOA)({
                            name: 'collection-name',
                            source: 'index-name',
                        })];
                case 1:
                    returned = _a.sent();
                    expect(returned).toEqual(collectionModel);
                    expect(IOA.createCollection).toHaveBeenCalledWith({
                        createCollectionRequest: {
                            name: 'collection-name',
                            source: 'index-name',
                        },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=createCollection.test.js.map