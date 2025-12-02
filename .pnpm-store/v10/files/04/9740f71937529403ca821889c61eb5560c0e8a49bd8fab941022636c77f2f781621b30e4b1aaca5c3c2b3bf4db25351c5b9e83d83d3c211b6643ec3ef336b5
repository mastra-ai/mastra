const require_rolldown_runtime = require('../_virtual/rolldown_runtime.cjs');
let hash_js = require("hash.js");
hash_js = require_rolldown_runtime.__toESM(hash_js);
let canonicalize = require("canonicalize");
canonicalize = require_rolldown_runtime.__toESM(canonicalize);

//#region src/helpers/net.ts
const { hmac, sha256 } = hash_js.default;
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
	const encoded = typeof data === "string" ? data : (0, canonicalize.default)(data);
	const key = signingKey.replace(/signkey-\w+-/, "");
	return hmac(sha256, key).update(encoded).update(ts).digest("hex");
}

//#endregion
exports.fetchWithAuthFallback = fetchWithAuthFallback;
exports.signDataWithKey = signDataWithKey;
//# sourceMappingURL=net.cjs.map