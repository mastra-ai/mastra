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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.middleware = void 0;
var control_1 = require("../pinecone-generated-ts-fetch/control");
var errors_1 = require("../errors");
var debugMiddleware = [];
var chalk = function (str, color) {
    var colors = {
        blue: '\x1b[34m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
    };
    return colors[color] + str + '\x1b[39m';
};
/**
 * Enable the `PINECONE_DEBUG` environment variable to print the request and
 * response bodies for each request.
 *
 * Api-Key headers will be redacted.
 */
if (typeof process !== 'undefined' &&
    process &&
    process.env &&
    process.env.PINECONE_DEBUG) {
    var debugLogMiddleware = {
        pre: function (context) { return __awaiter(void 0, void 0, void 0, function () {
            var headers;
            return __generator(this, function (_a) {
                console.debug(chalk(">>> Request: ".concat(context.init.method, " ").concat(context.url), 'blue'));
                headers = JSON.parse(JSON.stringify(context.init.headers));
                headers['Api-Key'] = '***REDACTED***';
                console.debug(chalk(">>> Headers: ".concat(JSON.stringify(headers)), 'blue'));
                if (context.init.body) {
                    console.debug(chalk(">>> Body: ".concat(context.init.body), 'blue'));
                }
                console.debug('');
                return [2 /*return*/];
            });
        }); },
        post: function (context) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        console.debug(chalk("<<< Status: ".concat(context.response.status), 'green'));
                        _b = (_a = console).debug;
                        _c = chalk;
                        _d = "<<< Body: ".concat;
                        return [4 /*yield*/, context.response.text()];
                    case 1:
                        _b.apply(_a, [_c.apply(void 0, [_d.apply("<<< Body: ", [_e.sent()]), 'green'])]);
                        console.debug('');
                        return [2 /*return*/];
                }
            });
        }); },
    };
    debugMiddleware.push(debugLogMiddleware);
}
/**
 * Enable the `PINECONE_DEBUG_CURL` environment variable to print the equivalent
 * curl commands for each request. These commands will include the API key and
 * other sensitive information, so be careful when using this option.
 */
if (typeof process !== 'undefined' &&
    process &&
    process.env &&
    process.env.PINECONE_DEBUG_CURL) {
    var debugCurlMiddleware = {
        post: function (context) { return __awaiter(void 0, void 0, void 0, function () {
            var headers, cmd;
            return __generator(this, function (_a) {
                headers = "-H \"Api-Key: ".concat((context.init.headers || {})['Api-Key'], "\"");
                if (context.init.headers && context.init.headers['Content-Type']) {
                    headers += " -H \"Content-Type: ".concat(context.init.headers['Content-Type'], "\"");
                }
                cmd = "curl -X ".concat(context.init.method, " ").concat(context.url, " ").concat(headers, " ").concat(context.init.body ? "-d '".concat(context.init.body, "'") : '');
                console.debug(chalk(cmd, 'red'));
                console.debug('');
                return [2 /*return*/];
            });
        }); },
    };
    debugMiddleware.push(debugCurlMiddleware);
}
exports.middleware = __spreadArray(__spreadArray([], debugMiddleware, true), [
    {
        onError: function (context) { return __awaiter(void 0, void 0, void 0, function () {
            var err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, errors_1.handleApiError)(context.error, undefined, context.url)];
                    case 1:
                        err = _a.sent();
                        throw err;
                }
            });
        }); },
        post: function (context) { return __awaiter(void 0, void 0, void 0, function () {
            var response, err;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        response = context.response;
                        if (!(response.status >= 200 && response.status < 300)) return [3 /*break*/, 1];
                        return [2 /*return*/, response];
                    case 1: return [4 /*yield*/, (0, errors_1.handleApiError)(new control_1.ResponseError(response, 'Response returned an error'), undefined, context.url)];
                    case 2:
                        err = _a.sent();
                        throw err;
                }
            });
        }); },
    },
], false);
//# sourceMappingURL=middleware.js.map