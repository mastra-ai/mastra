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
var index_1 = require("../index");
describe('Error handling', function () {
    describe('when API key is wrong', function () {
        test('calling control plane', function () { return __awaiter(void 0, void 0, void 0, function () {
            var p, e_1, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        p = new index_1.Pinecone({
                            apiKey: '123-456-789',
                        });
                        expect.assertions(2);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, p.listIndexes()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _a.sent();
                        err = e_1;
                        expect(err.name).toEqual('PineconeAuthorizationError');
                        expect(err.message).toEqual('The API key you provided was rejected while calling https://api.pinecone.io/indexes. Please check your configuration values and try again. You can find the configuration values for your project in the Pinecone developer console at https://app.pinecone.io');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        test('calling data plane', function () { return __awaiter(void 0, void 0, void 0, function () {
            var p, e_2, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        p = new index_1.Pinecone({
                            apiKey: '123-456-789',
                        });
                        expect.assertions(2);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, p.index('foo-index').query({ topK: 10, id: '1' })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        e_2 = _a.sent();
                        err = e_2;
                        expect(err.name).toEqual('PineconeAuthorizationError');
                        expect(err.message).toEqual('The API key you provided was rejected while calling https://api.pinecone.io/indexes/foo-index. Please check your configuration values and try again. You can find the configuration values for your project in the Pinecone developer console at https://app.pinecone.io');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        describe('when network error occurs', function () {
            var p;
            beforeEach(function () {
                p = new index_1.Pinecone({
                    apiKey: process.env.PINECONE_API_KEY || '',
                    fetchApi: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            throw new Error('network failure');
                        });
                    }); },
                });
            });
            test('calling control plane', function () { return __awaiter(void 0, void 0, void 0, function () {
                var e_3, err;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            expect.assertions(4);
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, p.listIndexes()];
                        case 2:
                            _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            e_3 = _a.sent();
                            err = e_3;
                            expect(err.name).toEqual('PineconeConnectionError');
                            expect(err.message).toEqual('Request failed to reach Pinecone. This can occur for reasons such as network problems that prevent the request from being completed, or a Pinecone API outage. Check your network connection, and visit https://status.pinecone.io/ to see whether any outages are ongoing.');
                            // @ts-ignore
                            expect(err.cause.name).toEqual('Error');
                            // @ts-ignore
                            expect(err.cause.message).toEqual('network failure');
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            test('calling data plane', function () { return __awaiter(void 0, void 0, void 0, function () {
                var e_4, err;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, p.index('foo-index').query({ topK: 10, id: '1' })];
                        case 1:
                            _a.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            e_4 = _a.sent();
                            err = e_4;
                            expect(err.name).toEqual('PineconeConnectionError');
                            expect(err.message).toEqual('Request failed to reach Pinecone. This can occur for reasons such as network problems that prevent the request from being completed, or a Pinecone API outage. Check your network connection, and visit https://status.pinecone.io/ to see whether any outages are ongoing.');
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
//# sourceMappingURL=errorHandling.test.js.map