import hashjs from "hash.js";
import canonicalize from "canonicalize";

//#region src/helpers/net.ts
const { hmac, sha256 } = hashjs;
/**
* Send an HTTP request with the given signing key. If the response is a 401 or
* 403, then try again with the fallback signing key
*/
async function fetchWithAuthFallback({ authToken, authTokenFallback, fetch, options, url }) {
	let res = await fetch(url, {
		...options,
		headers: {
			...options?.headers,
			Authorization: `Bearer ${authToken}`
		}
	});
	if ([401, 403].includes(res.status) && authTokenFallback) res = await fetch(url, {
		...options,
		headers: {
			...options?.headers,
			Authorization: `Bearer ${authTokenFallback}`
		}
	});
	return res;
}
function signDataWithKey(data, signingKey, ts) {
	const encoded = typeof data === "string" ? data : canonicalize(data);
	const key = signingKey.replace(/signkey-\w+-/, "");
	return hmac(sha256, key).update(encoded).update(ts).digest("hex");
}

//#endregion
export { fetchWithAuthFallback, signDataWithKey };
//# sourceMappingURL=net.js.map