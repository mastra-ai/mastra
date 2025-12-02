import { env } from "@better-auth/core/env";
import { BetterAuthError } from "@better-auth/core/error";

//#region src/utils/url.ts
function checkHasPath(url) {
	try {
		return (new URL(url).pathname.replace(/\/+$/, "") || "/") !== "/";
	} catch (error) {
		throw new BetterAuthError(`Invalid base URL: ${url}. Please provide a valid base URL.`);
	}
}
function assertHasProtocol(url) {
	try {
		const parsedUrl = new URL(url);
		if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") throw new BetterAuthError(`Invalid base URL: ${url}. URL must include 'http://' or 'https://'`);
	} catch (error) {
		if (error instanceof BetterAuthError) throw error;
		throw new BetterAuthError(`Invalid base URL: ${url}. Please provide a valid base URL.`, String(error));
	}
}
function withPath(url, path = "/api/auth") {
	assertHasProtocol(url);
	if (checkHasPath(url)) return url;
	const trimmedUrl = url.replace(/\/+$/, "");
	if (!path || path === "/") return trimmedUrl;
	path = path.startsWith("/") ? path : `/${path}`;
	return `${trimmedUrl}${path}`;
}
function getBaseURL(url, path, request, loadEnv, trustedProxyHeaders) {
	if (url) return withPath(url, path);
	if (loadEnv !== false) {
		const fromEnv = env.BETTER_AUTH_URL || env.NEXT_PUBLIC_BETTER_AUTH_URL || env.PUBLIC_BETTER_AUTH_URL || env.NUXT_PUBLIC_BETTER_AUTH_URL || env.NUXT_PUBLIC_AUTH_URL || (env.BASE_URL !== "/" ? env.BASE_URL : void 0);
		if (fromEnv) return withPath(fromEnv, path);
	}
	const fromRequest = request?.headers.get("x-forwarded-host");
	const fromRequestProto = request?.headers.get("x-forwarded-proto");
	if (fromRequest && fromRequestProto && trustedProxyHeaders) return withPath(`${fromRequestProto}://${fromRequest}`, path);
	if (request) {
		const url$1 = getOrigin(request.url);
		if (!url$1) throw new BetterAuthError("Could not get origin from request. Please provide a valid base URL.");
		return withPath(url$1, path);
	}
	if (typeof window !== "undefined" && window.location) return withPath(window.location.origin, path);
}
function getOrigin(url) {
	try {
		const parsedUrl = new URL(url);
		return parsedUrl.origin === "null" ? null : parsedUrl.origin;
	} catch (error) {
		return null;
	}
}
function getProtocol(url) {
	try {
		return new URL(url).protocol;
	} catch (error) {
		return null;
	}
}
function getHost(url) {
	try {
		return new URL(url).host;
	} catch (error) {
		return null;
	}
}

//#endregion
export { getProtocol as i, getHost as n, getOrigin as r, getBaseURL as t };