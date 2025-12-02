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
exports.IndexHostSingleton = void 0;
var control_1 = require("../control");
var errors_1 = require("../errors");
var utils_1 = require("../utils");
// We use describeIndex to retrieve the data plane url (host) for a given API key
// and index. We only ever want to call describeIndex a maximum of once per API key
// and index, so we cache them in a singleton for reuse.
exports.IndexHostSingleton = (function () {
    var _this = this;
    var hostUrls = {}; // map of apiKey-indexName to hostUrl
    var _describeIndex = function (config, indexName) { return __awaiter(_this, void 0, void 0, function () {
        var indexOperationsApi, describeResponse, host;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    indexOperationsApi = (0, control_1.indexOperationsBuilder)(config);
                    return [4 /*yield*/, (0, control_1.describeIndex)(indexOperationsApi)(indexName)];
                case 1:
                    describeResponse = _a.sent();
                    host = describeResponse.host;
                    if (!host) {
                        // Generally, middleware will handle most errors from the call itself such as index not found, etc
                        // However, we need to explicitly handle the optionality of status.host
                        throw new errors_1.PineconeUnableToResolveHostError('The HTTP call succeeded but the host URL could not be resolved. Please make sure the index exists and is in a ready state.');
                    }
                    else {
                        return [2 /*return*/, host];
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var _key = function (config, indexName) {
        return "".concat(config.apiKey, "-").concat(indexName);
    };
    var singleton = {
        getHostUrl: function (config, indexName) { return __awaiter(_this, void 0, void 0, function () {
            var cacheKey, hostUrl;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheKey = _key(config, indexName);
                        if (!(cacheKey in hostUrls)) return [3 /*break*/, 1];
                        return [2 /*return*/, hostUrls[cacheKey]];
                    case 1: return [4 /*yield*/, _describeIndex(config, indexName)];
                    case 2:
                        hostUrl = _a.sent();
                        singleton._set(config, indexName, hostUrl);
                        if (!hostUrls[cacheKey]) {
                            throw new errors_1.PineconeUnableToResolveHostError("Could not get host for index: ".concat(indexName, ". Call describeIndex('").concat(indexName, "') to check the current status."));
                        }
                        return [2 /*return*/, hostUrls[cacheKey]];
                }
            });
        }); },
        _reset: function () {
            for (var _i = 0, _a = Object.keys(hostUrls); _i < _a.length; _i++) {
                var key = _a[_i];
                delete hostUrls[key];
            }
        },
        _set: function (config, indexName, hostUrl) {
            var normalizedHostUrl = (0, utils_1.normalizeUrl)(hostUrl);
            // prevent adding an empty hostUrl to the cache
            if (!normalizedHostUrl) {
                return;
            }
            var cacheKey = _key(config, indexName);
            hostUrls[cacheKey] = normalizedHostUrl;
        },
        _delete: function (config, indexName) {
            var cacheKey = _key(config, indexName);
            delete hostUrls[cacheKey];
        },
    };
    return singleton;
})();
//# sourceMappingURL=indexHostSingleton.js.map