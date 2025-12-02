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
exports.DataOperationsProvider = void 0;
var data_1 = require("../pinecone-generated-ts-fetch/data");
var utils_1 = require("../utils");
var indexHostSingleton_1 = require("./indexHostSingleton");
var middleware_1 = require("../utils/middleware");
var DataOperationsProvider = /** @class */ (function () {
    function DataOperationsProvider(config, indexName, indexHostUrl, additionalHeaders) {
        this.config = config;
        this.indexName = indexName;
        this.indexHostUrl = (0, utils_1.normalizeUrl)(indexHostUrl);
        this.additionalHeaders = additionalHeaders;
    }
    DataOperationsProvider.prototype.provide = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.dataOperations) {
                            return [2 /*return*/, this.dataOperations];
                        }
                        if (!this.indexHostUrl) return [3 /*break*/, 1];
                        this.dataOperations = this.buildDataOperationsConfig();
                        return [3 /*break*/, 3];
                    case 1:
                        _a = this;
                        return [4 /*yield*/, indexHostSingleton_1.IndexHostSingleton.getHostUrl(this.config, this.indexName)];
                    case 2:
                        _a.indexHostUrl = _b.sent();
                        this.dataOperations = this.buildDataOperationsConfig();
                        _b.label = 3;
                    case 3: return [2 /*return*/, this.dataOperations];
                }
            });
        });
    };
    DataOperationsProvider.prototype.buildDataOperationsConfig = function () {
        var headers = this.additionalHeaders || null;
        var indexConfigurationParameters = {
            basePath: this.indexHostUrl,
            apiKey: this.config.apiKey,
            queryParamsStringify: utils_1.queryParamsStringify,
            headers: __assign({ 'User-Agent': (0, utils_1.buildUserAgent)(this.config), 'X-Pinecone-Api-Version': data_1.X_PINECONE_API_VERSION }, headers),
            fetchApi: (0, utils_1.getFetch)(this.config),
            middleware: middleware_1.middleware,
        };
        var indexConfiguration = new data_1.Configuration(indexConfigurationParameters);
        var dataOperations = new data_1.DataPlaneApi(indexConfiguration);
        return dataOperations;
    };
    return DataOperationsProvider;
}());
exports.DataOperationsProvider = DataOperationsProvider;
//# sourceMappingURL=dataOperationsProvider.js.map