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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
var pinecone_1 = require("../pinecone");
var indexHostSingleton_1 = require("../data/indexHostSingleton");
var utils = __importStar(require("../utils"));
var fakeFetch = jest.fn();
var fakeHost = '123-456.pinecone.io';
jest.mock('../utils', function () {
    var realUtils = jest.requireActual('../utils');
    return __assign(__assign({}, realUtils), { getFetch: function () { return fakeFetch; } });
});
jest.mock('../data/fetch');
jest.mock('../data/upsert');
jest.mock('../data/indexHostSingleton');
jest.mock('../control', function () {
    var realControl = jest.requireActual('../control');
    return __assign(__assign({}, realControl), { describeIndex: function () {
            return jest.fn().mockResolvedValue({
                name: 'fake-index',
                dimension: 1,
                metric: 'cosine',
                host: fakeHost,
                spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
                status: { ready: true, state: 'Ready' },
            });
        }, deleteIndex: function () { return jest.fn().mockResolvedValue(undefined); }, listIndexes: function () {
            return jest.fn().mockResolvedValue({
                indexes: [
                    {
                        name: 'fake-index1',
                        dimension: 1,
                        metric: 'cosine',
                        host: fakeHost,
                        spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
                        status: { ready: true, state: 'Ready' },
                    },
                    {
                        name: 'fake-index2',
                        dimension: 1,
                        metric: 'cosine',
                        host: fakeHost,
                        spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
                        status: { ready: true, state: 'Ready' },
                    },
                    {
                        name: 'fake-index3',
                        dimension: 1,
                        metric: 'cosine',
                        host: fakeHost,
                        spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
                        status: { ready: true, state: 'Ready' },
                    },
                ],
            });
        } });
});
describe('Pinecone', function () {
    describe('constructor', function () {
        describe('required properties', function () {
            test('should throw an error if apiKey is not provided', function () {
                expect(function () {
                    new pinecone_1.Pinecone({});
                }).toThrow('The client configuration must have required property: apiKey. You can find the configuration values for' +
                    ' your project in the Pinecone developer console at https://app.pinecone.io.');
            });
            test('should throw an error if apiKey is blank', function () {
                expect(function () {
                    var config = {
                        apiKey: '',
                    };
                    new pinecone_1.Pinecone(config);
                }).toThrow('The client configuration must have required property: apiKey. You can find the configuration values for' +
                    ' your project in the Pinecone developer console at https://app.pinecone.io.');
            });
        });
        describe('unknown properties', function () {
            test('should throw an error if unknown property provided', function () {
                expect(function () {
                    new pinecone_1.Pinecone({
                        apiKey: 'test-key',
                        unknownProp: 'banana',
                    });
                }).toThrow('Object contained invalid properties: unknownProp. Valid properties include apiKey, controllerHostUrl,' +
                    ' fetchApi, additionalHeaders, sourceTag.');
            });
        });
        describe('optional properties', function () {
            test('should not throw when optional properties provided: fetchAPI, controllerHostUrl, sourceTag', function () {
                expect(function () {
                    new pinecone_1.Pinecone({
                        apiKey: 'test-key',
                        fetchApi: utils.getFetch({}),
                        controllerHostUrl: 'https://foo-bar.io',
                        sourceTag: 'test-tag-123',
                    });
                }).not.toThrow();
            });
        });
        describe('configuration with environment variables', function () {
            beforeEach(function () {
                delete process.env.PINECONE_API_KEY;
            });
            test('should read required properties from environment variables if no config object provided', function () {
                process.env.PINECONE_API_KEY = 'test-api';
                var client = new pinecone_1.Pinecone();
                expect(client).toBeDefined();
                expect(client.getConfig().apiKey).toEqual('test-api');
            });
            test('config object should take precedence when both config object and environment variables are provided', function () {
                process.env.PINECONE_API_KEY = 'test';
                var client = new pinecone_1.Pinecone({
                    apiKey: 'test2',
                });
                expect(client).toBeDefined();
                expect(client.getConfig().apiKey).toEqual('test2');
            });
            test('should throw an error if required environment variable is not set', function () {
                expect(function () { return new pinecone_1.Pinecone(); }).toThrow("Since you called 'new Pinecone()' with no configuration object, we attempted to find client configuration in environment variables but the required environment variables were not set. Missing variables: PINECONE_API_KEY. You can find the configuration values for your project in the Pinecone developer console at https://app.pinecone.io");
            });
        });
        test('should log a warning if the SDK is used in a browser context', function () {
            // Mock window simulate browser context
            var mockWindow = {};
            global.window = mockWindow;
            var warnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation(function () { return null; });
            new pinecone_1.Pinecone({ apiKey: 'test-api-key' });
            expect(warnSpy).toHaveBeenCalledWith('The Pinecone SDK is intended for server-side use only. Using the SDK within a browser context can expose your API key(s). If you have deployed the SDK to production in a browser, please rotate your API keys.');
            // Clean up: remove the mock window object
            // @ts-ignore
            delete global.window;
        });
    });
    describe('typescript: generic types for index metadata', function () {
        test('passes generic types from index()', function () { return __awaiter(void 0, void 0, void 0, function () {
            var p, i, result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        p = new pinecone_1.Pinecone({ apiKey: 'foo' });
                        i = p.index('product-embeddings');
                        return [4 /*yield*/, i.fetch(['1'])];
                    case 1:
                        result = _b.sent();
                        if (result && result.records) {
                            // No ts error
                            console.log((_a = result.records['1'].metadata) === null || _a === void 0 ? void 0 : _a.color);
                            // @ts-expect-error because colour not in ProductMetadata
                            console.log(result.records['1'].metadata.colour);
                        }
                        // No ts errors when passing ProductMetadata
                        return [4 /*yield*/, i.upsert([
                                {
                                    id: 'party-shirt',
                                    values: [0.1, 0.1, 0.1],
                                    metadata: { color: 'black', description: 'sexy black dress' },
                                },
                            ])];
                    case 2:
                        // No ts errors when passing ProductMetadata
                        _b.sent();
                        return [4 /*yield*/, i.upsert([
                                {
                                    id: 'pink-shirt',
                                    values: [0.1, 0.1, 0.1],
                                    // @ts-expect-error becuase 'pink' not a valid value for ProductMeta color field
                                    metadata: { color: 'pink', description: 'pink shirt' },
                                },
                            ])];
                    case 3:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('control plane operations', function () {
        test('describeIndex triggers calling IndexHostSingleton._set', function () { return __awaiter(void 0, void 0, void 0, function () {
            var p;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        p = new pinecone_1.Pinecone({ apiKey: 'foo' });
                        return [4 /*yield*/, p.describeIndex('test-index')];
                    case 1:
                        _a.sent();
                        expect(indexHostSingleton_1.IndexHostSingleton._set).toHaveBeenCalledWith({ apiKey: 'foo' }, 'test-index', fakeHost);
                        return [2 /*return*/];
                }
            });
        }); });
        test('listIndexes triggers calling IndexHostSingleton._set', function () { return __awaiter(void 0, void 0, void 0, function () {
            var p;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        p = new pinecone_1.Pinecone({ apiKey: 'foo' });
                        return [4 /*yield*/, p.listIndexes()];
                    case 1:
                        _a.sent();
                        expect(indexHostSingleton_1.IndexHostSingleton._set).toHaveBeenNthCalledWith(1, { apiKey: 'foo' }, 'fake-index1', fakeHost);
                        expect(indexHostSingleton_1.IndexHostSingleton._set).toHaveBeenNthCalledWith(2, { apiKey: 'foo' }, 'fake-index2', fakeHost);
                        expect(indexHostSingleton_1.IndexHostSingleton._set).toHaveBeenNthCalledWith(3, { apiKey: 'foo' }, 'fake-index3', fakeHost);
                        return [2 /*return*/];
                }
            });
        }); });
        test('deleteIndex trigger calling IndexHostSingleton._delete', function () { return __awaiter(void 0, void 0, void 0, function () {
            var p;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        p = new pinecone_1.Pinecone({ apiKey: 'foo' });
                        return [4 /*yield*/, p.deleteIndex('test-index')];
                    case 1:
                        _a.sent();
                        expect(indexHostSingleton_1.IndexHostSingleton._delete).toHaveBeenCalledWith({ apiKey: 'foo' }, 'test-index');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=pinecone.test.js.map