// @ts-ignore
import nodeFetch, { Headers as NodeFetchHeaders } from '@supabase/node-fetch';
export const resolveFetch = (customFetch) => {
    let _fetch;
    if (customFetch) {
        _fetch = customFetch;
    }
    else if (typeof fetch === 'undefined') {
        _fetch = nodeFetch;
    }
    else {
        _fetch = fetch;
    }
    return (...args) => _fetch(...args);
};
export const resolveHeadersConstructor = () => {
    if (typeof Headers === 'undefined') {
        return NodeFetchHeaders;
    }
    return Headers;
};
export const fetchWithAuth = (supabaseKey, getAccessToken, customFetch) => {
    const fetch = resolveFetch(customFetch);
    const HeadersConstructor = resolveHeadersConstructor();
    return async (input, init) => {
        var _a;
        const accessToken = (_a = (await getAccessToken())) !== null && _a !== void 0 ? _a : supabaseKey;
        let headers = new HeadersConstructor(init === null || init === void 0 ? void 0 : init.headers);
        if (!headers.has('apikey')) {
            headers.set('apikey', supabaseKey);
        }
        if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${accessToken}`);
        }
        return fetch(input, Object.assign(Object.assign({}, init), { headers }));
    };
};
//# sourceMappingURL=fetch.js.map