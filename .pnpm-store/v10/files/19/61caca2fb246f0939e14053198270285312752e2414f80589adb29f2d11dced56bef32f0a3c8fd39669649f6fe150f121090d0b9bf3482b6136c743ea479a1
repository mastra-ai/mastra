"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveResponse = exports.fetchWithAuth = exports.resolveFetch = void 0;
const helpers_1 = require("./helpers");
const cross_fetch_1 = __importDefault(require("cross-fetch"));
/**
 * Resolves the appropriate fetch function to use, either a custom fetch function provided as an argument, or the global fetch function if available, or the cross-fetch library if the global fetch function is not available.
 *
 * @param customFetch - An optional custom fetch function to use instead of the global fetch function.
 * @returns A fetch function that can be used to make HTTP requests.
 */
const resolveFetch = (customFetch) => {
    let _fetch;
    if (customFetch) {
        _fetch = customFetch;
    }
    else if (typeof fetch === "undefined") {
        _fetch = cross_fetch_1.default;
    }
    else {
        _fetch = fetch;
    }
    return (...args) => _fetch(...args);
};
exports.resolveFetch = resolveFetch;
/**
 * Resolves a fetch function that includes an "Authorization" header with the provided API key.
 *
 * @param apiKey - The API key to include in the "Authorization" header.
 * @param customFetch - An optional custom fetch function to use instead of the global fetch function.
 * @returns A fetch function that can be used to make HTTP requests with the provided API key in the "Authorization" header.
 */
const fetchWithAuth = (apiKey, customFetch) => {
    const fetch = (0, exports.resolveFetch)(customFetch);
    const HeadersConstructor = (0, helpers_1.resolveHeadersConstructor)();
    return (input, init) => __awaiter(void 0, void 0, void 0, function* () {
        const headers = new HeadersConstructor(init === null || init === void 0 ? void 0 : init.headers);
        if (!headers.has("Authorization")) {
            headers.set("Authorization", `Token ${apiKey}`);
        }
        return fetch(input, Object.assign(Object.assign({}, init), { headers }));
    });
};
exports.fetchWithAuth = fetchWithAuth;
/**
 * Resolves the appropriate Response object to use, either the global Response object if available, or the Response object from the cross-fetch library if the global Response object is not available.
 *
 * @returns The appropriate Response object to use for making HTTP requests.
 */
const resolveResponse = () => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof Response === "undefined") {
        return (yield Promise.resolve().then(() => __importStar(require("cross-fetch")))).Response;
    }
    return Response;
});
exports.resolveResponse = resolveResponse;
//# sourceMappingURL=fetch.js.map