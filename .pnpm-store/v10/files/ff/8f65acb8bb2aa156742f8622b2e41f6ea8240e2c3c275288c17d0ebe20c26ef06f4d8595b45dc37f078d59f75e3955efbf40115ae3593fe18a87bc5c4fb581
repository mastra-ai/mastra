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
var indexHostSingleton_1 = require("../indexHostSingleton");
var mockDescribeIndex = jest.fn();
var mockIndexOperationsBuilder = jest.fn();
jest.mock('../../control', function () {
    var realControl = jest.requireActual('../../control');
    return __assign(__assign({}, realControl), { describeIndex: function () { return mockDescribeIndex; }, indexOperationsBuilder: function (config) { return mockIndexOperationsBuilder(config); } });
});
describe('IndexHostSingleton', function () {
    afterEach(function () {
        indexHostSingleton_1.IndexHostSingleton._reset();
        mockDescribeIndex.mockReset();
        mockIndexOperationsBuilder.mockReset();
    });
    test('calls describeIndex to resolve host for a specific apiKey and indexName, prepends protocol to host', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testHost, testIndex, pineconeConfig, hostUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testHost = '123-456.pinecone.io';
                    testIndex = 'index-1';
                    pineconeConfig = {
                        apiKey: 'api-key-1',
                    };
                    mockDescribeIndex.mockResolvedValue({
                        name: 'index-1',
                        dimensions: 10,
                        metric: 'cosine',
                        host: testHost,
                        spec: { pod: { pods: 1, replicas: 1, shards: 1, podType: 'p1.x1' } },
                        status: { ready: true, state: 'Ready' },
                    });
                    return [4 /*yield*/, indexHostSingleton_1.IndexHostSingleton.getHostUrl(pineconeConfig, testIndex)];
                case 1:
                    hostUrl = _a.sent();
                    expect(hostUrl).toEqual("https://".concat(testHost));
                    expect(mockDescribeIndex).toHaveBeenCalledWith(testIndex);
                    return [2 /*return*/];
            }
        });
    }); });
    test('calls describeIndex once per apiKey and indexName', function () { return __awaiter(void 0, void 0, void 0, function () {
        var testHost, testHost2, testIndex, testIndex2, pineconeConfig, hostUrl, hostUrl2, hostUrl3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    testHost = '123-456.pinecone.io';
                    testHost2 = '654-321.pinecone.io';
                    testIndex = 'index-1';
                    testIndex2 = 'index-2';
                    pineconeConfig = {
                        apiKey: 'api-key-1',
                    };
                    mockDescribeIndex
                        .mockResolvedValueOnce({
                        name: testIndex,
                        dimensions: 10,
                        metric: 'cosine',
                        host: testHost,
                        spec: { pod: { pods: 1, replicas: 1, shards: 1, podType: 'p1.x1' } },
                        status: { ready: true, state: 'Ready' },
                    })
                        .mockResolvedValueOnce({
                        name: testIndex2,
                        dimensions: 10,
                        metric: 'cosine',
                        host: testHost2,
                        spec: { pod: { pods: 1, replicas: 1, shards: 1, podType: 'p1.x1' } },
                        status: { ready: true, state: 'Ready' },
                    });
                    return [4 /*yield*/, indexHostSingleton_1.IndexHostSingleton.getHostUrl(pineconeConfig, testIndex)];
                case 1:
                    hostUrl = _a.sent();
                    expect(mockDescribeIndex).toHaveBeenCalledTimes(1);
                    expect(hostUrl).toEqual("https://".concat(testHost));
                    return [4 /*yield*/, indexHostSingleton_1.IndexHostSingleton.getHostUrl(pineconeConfig, testIndex)];
                case 2:
                    hostUrl2 = _a.sent();
                    expect(mockDescribeIndex).toHaveBeenCalledTimes(1);
                    expect(hostUrl2).toEqual("https://".concat(testHost));
                    return [4 /*yield*/, indexHostSingleton_1.IndexHostSingleton.getHostUrl(pineconeConfig, testIndex2)];
                case 3:
                    hostUrl3 = _a.sent();
                    expect(mockDescribeIndex).toHaveBeenCalledTimes(2);
                    expect(hostUrl3).toEqual("https://".concat(testHost2));
                    return [2 /*return*/];
            }
        });
    }); });
    test('_set, _delete, and _reset work as expected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var pineconeConfig, host1, host2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pineconeConfig = { apiKey: 'test-key' };
                    mockDescribeIndex.mockResolvedValue({
                        name: 'index-1',
                        dimensions: 10,
                        metric: 'cosine',
                        host: 'test-host',
                        spec: { pod: { pods: 1, replicas: 1, shards: 1, podType: 'p1.x1' } },
                        status: { ready: true, state: 'Ready' },
                    });
                    // _set test
                    indexHostSingleton_1.IndexHostSingleton._set(pineconeConfig, 'index-1', 'test-host');
                    return [4 /*yield*/, indexHostSingleton_1.IndexHostSingleton.getHostUrl(pineconeConfig, 'index-1')];
                case 1:
                    host1 = _a.sent();
                    expect(mockDescribeIndex).toHaveBeenCalledTimes(0);
                    expect(host1).toEqual('https://test-host');
                    // _delete test
                    indexHostSingleton_1.IndexHostSingleton._delete(pineconeConfig, 'index-1');
                    return [4 /*yield*/, indexHostSingleton_1.IndexHostSingleton.getHostUrl(pineconeConfig, 'index-1')];
                case 2:
                    host2 = _a.sent();
                    expect(mockDescribeIndex).toHaveBeenCalledTimes(1);
                    expect(host2).toBe('https://test-host');
                    return [2 /*return*/];
            }
        });
    }); });
    test('_set does not cache empty hostUrl values', function () { return __awaiter(void 0, void 0, void 0, function () {
        var pineconeConfig;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pineconeConfig = { apiKey: 'test-key' };
                    mockDescribeIndex.mockResolvedValue({
                        name: 'index-1',
                        dimensions: 10,
                        metric: 'cosine',
                        host: 'test-host',
                        spec: { pod: { pods: 1, replicas: 1, shards: 1, podType: 'p1.x1' } },
                        status: { ready: true, state: 'Ready' },
                    });
                    indexHostSingleton_1.IndexHostSingleton._set(pineconeConfig, 'test-index', '');
                    // the empty value was not cached so describeIndex should be called
                    return [4 /*yield*/, indexHostSingleton_1.IndexHostSingleton.getHostUrl(pineconeConfig, 'test-index')];
                case 1:
                    // the empty value was not cached so describeIndex should be called
                    _a.sent();
                    expect(mockDescribeIndex).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    test('calling getHostUrl with different apiKey configurations should instantiate new ManageIndexesApi classes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var pineconeConfig1, pineconeConfig2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pineconeConfig1 = { apiKey: 'test-key-1' };
                    pineconeConfig2 = { apiKey: 'test-key-2' };
                    mockDescribeIndex
                        .mockResolvedValueOnce({
                        name: 'index-1',
                        dimensions: 10,
                        metric: 'cosine',
                        host: 'test-host-1',
                        spec: { pod: { pods: 1, replicas: 1, shards: 1, podType: 'p1.x1' } },
                        status: { ready: true, state: 'Ready' },
                    })
                        .mockResolvedValueOnce({
                        name: 'index-2',
                        dimensions: 10,
                        metric: 'cosine',
                        host: 'test-host-2',
                        spec: { pod: { pods: 1, replicas: 1, shards: 1, podType: 'p1.x1' } },
                        status: { ready: true, state: 'Ready' },
                    });
                    mockIndexOperationsBuilder.mockReturnValue({ test: 'one', test2: 'two' });
                    return [4 /*yield*/, indexHostSingleton_1.IndexHostSingleton.getHostUrl(pineconeConfig1, 'index-1')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, indexHostSingleton_1.IndexHostSingleton.getHostUrl(pineconeConfig2, 'index-2')];
                case 2:
                    _a.sent();
                    expect(mockDescribeIndex).toHaveBeenCalledTimes(2);
                    expect(mockDescribeIndex).toHaveBeenNthCalledWith(1, 'index-1');
                    expect(mockDescribeIndex).toHaveBeenNthCalledWith(2, 'index-2');
                    expect(mockIndexOperationsBuilder).toHaveBeenCalledTimes(2);
                    expect(mockIndexOperationsBuilder).toHaveBeenNthCalledWith(1, pineconeConfig1);
                    expect(mockIndexOperationsBuilder).toHaveBeenNthCalledWith(2, pineconeConfig2);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=indexHostSingleton.test.js.map