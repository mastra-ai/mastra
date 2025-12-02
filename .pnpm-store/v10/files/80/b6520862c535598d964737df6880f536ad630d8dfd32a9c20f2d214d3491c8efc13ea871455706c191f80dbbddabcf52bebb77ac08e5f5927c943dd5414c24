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
exports.assertWithRetries = exports.waitUntilRecordsReady = exports.waitUntilReady = exports.sleep = exports.randomIndexName = exports.generateMetadata = exports.generateSparseValues = exports.generateRecords = exports.randomString = exports.INDEX_NAME = void 0;
var index_1 = require("../index");
var metadataMap = {
    genre: ['action', 'comedy', 'drama', 'horror', 'romance', 'thriller'],
    year: [2010, 2011, 2012, 2013, 2014, 2015],
};
var metadataKeys = Object.keys(metadataMap);
exports.INDEX_NAME = 'ts-integration';
var randomString = function (length) {
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for (var i = 0; i < length; i++) {
        var randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }
    return result;
};
exports.randomString = randomString;
var generateRecords = function (_a) {
    var _b = _a.dimension, dimension = _b === void 0 ? 5 : _b, _c = _a.quantity, quantity = _c === void 0 ? 3 : _c, _d = _a.prefix, prefix = _d === void 0 ? null : _d, _e = _a.withSparseValues, withSparseValues = _e === void 0 ? false : _e, _f = _a.withMetadata, withMetadata = _f === void 0 ? false : _f;
    var records = [];
    for (var i = 0; i < quantity; i++) {
        var values = [];
        for (var j = 0; j < dimension; j++) {
            values.push(parseFloat(Math.random().toFixed(5)));
        }
        var id = prefix === null ? i.toString() : "".concat(prefix, "-").concat(i);
        var vector = {
            id: id,
            values: values,
        };
        if (withSparseValues) {
            vector = __assign(__assign({}, vector), { sparseValues: (0, exports.generateSparseValues)(dimension) });
        }
        if (withMetadata) {
            vector = __assign(__assign({}, vector), { metadata: (0, exports.generateMetadata)() });
        }
        records.push(vector);
    }
    return records;
};
exports.generateRecords = generateRecords;
var generateSparseValues = function (dimension) {
    var values = [];
    var indices = [];
    for (var j = 0; j < dimension; j++) {
        values.push(Math.random());
        indices.push(j);
    }
    var sparseValues = { indices: indices, values: values };
    return sparseValues;
};
exports.generateSparseValues = generateSparseValues;
var generateMetadata = function () {
    var _a;
    var metaKey = metadataKeys[Math.floor(Math.random() * metadataKeys.length)];
    var metaValue = metadataMap[metaKey][Math.floor(Math.random() * metadataMap[metaKey].length)];
    return _a = {}, _a[metaKey] = metaValue, _a;
};
exports.generateMetadata = generateMetadata;
var randomIndexName = function (testName) {
    return "".concat(process.env.TEST_ENV, "-").concat(testName, "-").concat((0, exports.randomString)(8))
        .toLowerCase()
        .slice(0, 45);
};
exports.randomIndexName = randomIndexName;
var sleep = function (ms) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new Promise(function (resolve) { return setTimeout(resolve, ms); })];
    });
}); };
exports.sleep = sleep;
var waitUntilReady = function (indexName) { return __awaiter(void 0, void 0, void 0, function () {
    var p, sleepIntervalMs, description;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                p = new index_1.Pinecone();
                sleepIntervalMs = 1000;
                return [4 /*yield*/, p.describeIndex(indexName)];
            case 1:
                description = _b.sent();
                _b.label = 2;
            case 2:
                if (!(((_a = description.status) === null || _a === void 0 ? void 0 : _a.state) !== 'Ready')) return [3 /*break*/, 5];
                return [4 /*yield*/, (0, exports.sleep)(sleepIntervalMs)];
            case 3:
                _b.sent();
                return [4 /*yield*/, p.describeIndex(indexName)];
            case 4:
                description = _b.sent();
                return [3 /*break*/, 2];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.waitUntilReady = waitUntilReady;
var waitUntilRecordsReady = function (index, namespace, recordIds) { return __awaiter(void 0, void 0, void 0, function () {
    var sleepIntervalMs, indexStats;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                sleepIntervalMs = 3000;
                return [4 /*yield*/, index.describeIndexStats()];
            case 1:
                indexStats = _b.sent();
                _b.label = 2;
            case 2:
                if (!(indexStats.namespaces &&
                    !indexStats.namespaces[namespace] &&
                    ((_a = indexStats.namespaces[namespace]) === null || _a === void 0 ? void 0 : _a.recordCount) !== recordIds.length)) return [3 /*break*/, 5];
                return [4 /*yield*/, (0, exports.sleep)(sleepIntervalMs)];
            case 3:
                _b.sent();
                return [4 /*yield*/, index.describeIndexStats()];
            case 4:
                indexStats = _b.sent();
                return [3 /*break*/, 2];
            case 5: 
            // Sleeping one final time before returning for a bit more breathing room for freshness
            return [4 /*yield*/, (0, exports.sleep)(sleepIntervalMs)];
            case 6:
                // Sleeping one final time before returning for a bit more breathing room for freshness
                _b.sent();
                return [2 /*return*/, indexStats];
        }
    });
}); };
exports.waitUntilRecordsReady = waitUntilRecordsReady;
var assertWithRetries = function (asyncFn, assertionsFn, maxRetries, delay) {
    if (maxRetries === void 0) { maxRetries = 5; }
    if (delay === void 0) { delay = 3000; }
    return __awaiter(void 0, void 0, void 0, function () {
        var attempts, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    attempts = 0;
                    _a.label = 1;
                case 1:
                    if (!(attempts < maxRetries)) return [3 /*break*/, 9];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 8]);
                    return [4 /*yield*/, asyncFn()];
                case 3:
                    result = _a.sent();
                    assertionsFn(result);
                    return [2 /*return*/];
                case 4:
                    error_1 = _a.sent();
                    attempts++;
                    if (!(attempts <= maxRetries)) return [3 /*break*/, 6];
                    return [4 /*yield*/, (0, exports.sleep)(delay)];
                case 5:
                    _a.sent();
                    // Double the delay for exponential backoff
                    delay *= 2;
                    return [3 /*break*/, 7];
                case 6: throw error_1;
                case 7: return [3 /*break*/, 8];
                case 8: return [3 /*break*/, 1];
                case 9: return [2 /*return*/];
            }
        });
    });
};
exports.assertWithRetries = assertWithRetries;
//# sourceMappingURL=test-helpers.js.map