"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchBody = exports.fetchMethod = exports.fetchHeaders = exports.fetchSearchParams = exports.fetchURL = exports.fetchOnce = void 0;
const jest_fetch_mock_1 = __importDefault(require("jest-fetch-mock"));
function fetchOnce(response = {}, _a = {}) {
    var { status = 200, headers } = _a, rest = __rest(_a, ["status", "headers"]);
    return jest_fetch_mock_1.default.once(JSON.stringify(response), Object.assign({ status, headers: Object.assign({ 'content-type': 'application/json;charset=UTF-8' }, headers) }, rest));
}
exports.fetchOnce = fetchOnce;
function fetchURL() {
    return jest_fetch_mock_1.default.mock.calls[0][0];
}
exports.fetchURL = fetchURL;
function fetchSearchParams() {
    return Object.fromEntries(new URL(String(fetchURL())).searchParams);
}
exports.fetchSearchParams = fetchSearchParams;
function fetchHeaders() {
    var _a;
    return (_a = jest_fetch_mock_1.default.mock.calls[0][1]) === null || _a === void 0 ? void 0 : _a.headers;
}
exports.fetchHeaders = fetchHeaders;
function fetchMethod() {
    var _a;
    return (_a = jest_fetch_mock_1.default.mock.calls[0][1]) === null || _a === void 0 ? void 0 : _a.method;
}
exports.fetchMethod = fetchMethod;
function fetchBody({ raw = false } = {}) {
    var _a;
    const body = (_a = jest_fetch_mock_1.default.mock.calls[0][1]) === null || _a === void 0 ? void 0 : _a.body;
    if (body instanceof URLSearchParams) {
        return body.toString();
    }
    if (raw) {
        return body;
    }
    return JSON.parse(String(body));
}
exports.fetchBody = fetchBody;
