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
var list_1 = require("../list");
var setupListResponse = function (response, isSuccess) {
    if (isSuccess === void 0) { isSuccess = true; }
    var fakeList = jest
        .fn()
        .mockImplementation(function () {
        return isSuccess ? Promise.resolve(response) : Promise.reject(response);
    });
    var DPA = { list: fakeList };
    var VoaProvider = { provide: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, DPA];
        }); }); } };
    return { DPA: DPA, VoaProvider: VoaProvider };
};
describe('list', function () {
    test('listPaginated calls the openapi list endpoint, passing target namespace with ListOptions', function () { return __awaiter(void 0, void 0, void 0, function () {
        var listResponse, _a, VoaProvider, DPA, listPaginatedFn, returned;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    listResponse = {
                        vectors: [
                            { id: 'prefix-1', values: [0.2, 0.4] },
                            { id: 'prefix-2', values: [0.3, 0.5] },
                            { id: 'prefix-3', values: [0.4, 0.6] },
                        ],
                        pagination: { next: 'fake-pagination-token-123123123' },
                        namespace: 'list-namespace',
                        usage: { readUnits: 1 },
                    };
                    _a = setupListResponse(listResponse), VoaProvider = _a.VoaProvider, DPA = _a.DPA;
                    listPaginatedFn = (0, list_1.listPaginated)(VoaProvider, 'list-namespace');
                    return [4 /*yield*/, listPaginatedFn({ prefix: 'prefix-' })];
                case 1:
                    returned = _b.sent();
                    expect(returned).toBe(listResponse);
                    expect(DPA.list).toHaveBeenCalledWith({
                        prefix: 'prefix-',
                        namespace: 'list-namespace',
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    test('Throw error if pass in empty prefix', function () { return __awaiter(void 0, void 0, void 0, function () {
        var VoaProvider, listPaginatedFn, toThrow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    VoaProvider = setupListResponse({}).VoaProvider;
                    listPaginatedFn = (0, list_1.listPaginated)(VoaProvider, 'list-namespace');
                    toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, listPaginatedFn({ limit: -3 })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, expect(toThrow()).rejects.toThrowError('`limit` property must be greater than 0')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Throw error if misspell property', function () { return __awaiter(void 0, void 0, void 0, function () {
        var VoaProvider, listPaginatedFn, toThrow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    VoaProvider = setupListResponse({}).VoaProvider;
                    listPaginatedFn = (0, list_1.listPaginated)(VoaProvider, 'list-namespace');
                    toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // @ts-ignore
                                return [4 /*yield*/, listPaginatedFn({ limitgadsf: -3 })];
                                case 1:
                                    // @ts-ignore
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, expect(toThrow()).rejects.toThrowError('Object contained invalid properties: limitgadsf. Valid properties include prefix, limit, paginationToken.')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Throw error if add unknown property', function () { return __awaiter(void 0, void 0, void 0, function () {
        var VoaProvider, listPaginatedFn, toThrow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    VoaProvider = setupListResponse({}).VoaProvider;
                    listPaginatedFn = (0, list_1.listPaginated)(VoaProvider, 'list-namespace');
                    toThrow = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // @ts-ignore
                                return [4 /*yield*/, listPaginatedFn({ limit: 3, testy: 'test' })];
                                case 1:
                                    // @ts-ignore
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, expect(toThrow()).rejects.toThrowError('Object contained invalid properties: testy. Valid properties include prefix, limit, paginationToken.')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=list.test.js.map