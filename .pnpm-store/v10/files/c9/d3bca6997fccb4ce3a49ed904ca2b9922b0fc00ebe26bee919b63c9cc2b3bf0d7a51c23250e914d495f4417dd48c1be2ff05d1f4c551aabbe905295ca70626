var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { resolveHeadersConstructor } from "./helpers";
import crossFetch from "cross-fetch";
/**
 * Resolves the appropriate fetch function to use, either a custom fetch function provided as an argument, or the global fetch function if available, or the cross-fetch library if the global fetch function is not available.
 *
 * @param customFetch - An optional custom fetch function to use instead of the global fetch function.
 * @returns A fetch function that can be used to make HTTP requests.
 */
export const resolveFetch = (customFetch) => {
    let _fetch;
    if (customFetch) {
        _fetch = customFetch;
    }
    else if (typeof fetch === "undefined") {
        _fetch = crossFetch;
    }
    else {
        _fetch = fetch;
    }
    return (...args) => _fetch(...args);
};
/**
 * Resolves a fetch function that includes an "Authorization" header with the provided API key.
 *
 * @param apiKey - The API key to include in the "Authorization" header.
 * @param customFetch - An optional custom fetch function to use instead of the global fetch function.
 * @returns A fetch function that can be used to make HTTP requests with the provided API key in the "Authorization" header.
 */
export const fetchWithAuth = (apiKey, customFetch) => {
    const fetch = resolveFetch(customFetch);
    const HeadersConstructor = resolveHeadersConstructor();
    return (input, init) => __awaiter(void 0, void 0, void 0, function* () {
        const headers = new HeadersConstructor(init === null || init === void 0 ? void 0 : init.headers);
        if (!headers.has("Authorization")) {
            headers.set("Authorization", `Token ${apiKey}`);
        }
        return fetch(input, Object.assign(Object.assign({}, init), { headers }));
    });
};
/**
 * Resolves the appropriate Response object to use, either the global Response object if available, or the Response object from the cross-fetch library if the global Response object is not available.
 *
 * @returns The appropriate Response object to use for making HTTP requests.
 */
export const resolveResponse = () => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof Response === "undefined") {
        return (yield import("cross-fetch")).Response;
    }
    return Response;
});
//# sourceMappingURL=fetch.js.map