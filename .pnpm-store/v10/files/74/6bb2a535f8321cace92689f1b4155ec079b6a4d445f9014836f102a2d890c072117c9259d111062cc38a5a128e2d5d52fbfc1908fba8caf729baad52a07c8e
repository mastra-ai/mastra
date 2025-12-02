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
var control_1 = require("../../pinecone-generated-ts-fetch/control");
describe('createIndex argument validations', function () {
    var MIA;
    beforeEach(function () {
        MIA = new control_1.ManageIndexesApi();
        MIA.createIndex = jest.fn();
    });
    describe('required configurations', function () {
        test('should throw no options are provided', function () { return __awaiter(void 0, void 0, void 0, function () {
            var toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)()];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        }); }); };
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass an object with required properties (`name`, `dimension`, `spec`) to create an index.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('should throw if index name is not provided', function () { return __awaiter(void 0, void 0, void 0, function () {
            var toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: 
                                    // @ts-ignore
                                    return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                            dimension: 10,
                                            metric: 'cosine',
                                            spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
                                        })];
                                    case 1: 
                                    // @ts-ignore
                                    return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); };
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass a non-empty string for `name` in order to create an index.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('should throw if index name is empty string', function () { return __awaiter(void 0, void 0, void 0, function () {
            var toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                            name: '',
                                            dimension: 10,
                                            metric: 'cosine',
                                            spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
                                        })];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); };
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass a non-empty string for `name` in order to create an index.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('should throw if dimension is not provided', function () { return __awaiter(void 0, void 0, void 0, function () {
            var toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: 
                                    // @ts-ignore
                                    return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                            name: 'index-name',
                                            metric: 'cosine',
                                            spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
                                        })];
                                    case 1: 
                                    // @ts-ignore
                                    return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); };
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass a positive integer for `dimension` in order to create an index.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('should throw if dimension is not a positive integer', function () { return __awaiter(void 0, void 0, void 0, function () {
            var toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                            name: 'index-name',
                                            dimension: -10,
                                            metric: 'cosine',
                                            spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
                                        })];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); };
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass a positive integer for `dimension` in order to create an index.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('should throw if region is not provided', function () {
            var toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                name: 'index-name',
                                dimension: 10,
                                metric: 'cosine',
                                spec: {
                                    // @ts-ignore
                                    serverless: {
                                        cloud: 'aws',
                                    },
                                },
                            })];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            }); };
            expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError);
            expect(toThrow).rejects.toThrowError('You must pass a `region` for the serverless `spec` object in order to create an index.');
        });
        test('should throw if cloud is not provided', function () {
            var toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                name: 'index-name',
                                dimension: 10,
                                metric: 'cosine',
                                spec: {
                                    serverless: {
                                        // @ts-ignore
                                        region: 111,
                                    },
                                },
                            })];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            }); };
            expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError);
            expect(toThrow).rejects.toThrowError('You must pass a `cloud` for the serverless `spec` object in order to create an index.');
        });
        test('should throw if cloud is not one of the expected strings', function () {
            var toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                name: 'index-name',
                                dimension: 10,
                                metric: 'cosine',
                                spec: {
                                    serverless: {
                                        region: 'us-east-1',
                                        // @ts-ignore
                                        cloud: 'gooosdf',
                                    },
                                },
                            })];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            }); };
            expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError);
            expect(toThrow).rejects.toThrowError('Invalid cloud value');
        });
    });
    describe('optional configurations', function () {
        test('metric: should throw if not one of the predefined literals', function () { return __awaiter(void 0, void 0, void 0, function () {
            var toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                            name: 'index-name',
                                            dimension: 10,
                                            // @ts-ignore
                                            metric: 'foo',
                                            spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
                                        })];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); };
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError("Invalid metric value: foo. Valid values are: 'cosine', 'euclidean', or 'dotproduct.'")];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('replicas: should throw if not a positive integer', function () { return __awaiter(void 0, void 0, void 0, function () {
            var toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                            name: 'index-name',
                                            dimension: 10,
                                            metric: 'cosine',
                                            spec: {
                                                pod: {
                                                    replicas: -10,
                                                    environment: 'us-east-1',
                                                    shards: 1,
                                                    podType: 'p1.x1',
                                                    pods: 1,
                                                },
                                            },
                                        })];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); };
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass a positive integer for `replicas` in order to create an index.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('podType: should throw if not a valid pod type', function () { return __awaiter(void 0, void 0, void 0, function () {
            var toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                            name: 'index-name',
                                            dimension: 10,
                                            metric: 'cosine',
                                            spec: {
                                                pod: {
                                                    replicas: 1,
                                                    environment: 'us-east-1',
                                                    shards: 1,
                                                    podType: 'gobblygook',
                                                    pods: 1,
                                                },
                                            },
                                        })];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); };
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('Invalid pod type: gobblygook. Valid values are: s1.x1, s1.x2, s1.x4, s1.x8, p1.x1, p1.x2, p1.x4, p1.x8, p2.x1, p2.x2, p2.x4, p2.x8.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test('pods: should throw if not a positive integer', function () { return __awaiter(void 0, void 0, void 0, function () {
            var toThrow;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, createIndex_1.createIndex)(MIA)({
                                            name: 'index-name',
                                            dimension: 10,
                                            metric: 'cosine',
                                            spec: {
                                                pod: {
                                                    replicas: 1,
                                                    environment: 'us-east-1',
                                                    shards: 1,
                                                    podType: 'p1.x1',
                                                    pods: -10,
                                                },
                                            },
                                        })];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); };
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError(errors_1.PineconeArgumentError)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(toThrow).rejects.toThrowError('You must pass a positive integer for `pods` in order to create an index.')];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=createIndex.validation.test.js.map