import { t as getIp } from "./get-request-ip-RYTz2Uba.mjs";
import { defineErrorCodes } from "@better-auth/core/utils";
import { betterFetch } from "@better-fetch/fetch";

//#region src/utils/middleware-response.ts
const middlewareResponse = ({ message, status }) => ({ response: new Response(JSON.stringify({ message }), { status }) });

//#endregion
//#region src/plugins/captcha/constants.ts
const defaultEndpoints = [
	"/sign-up/email",
	"/sign-in/email",
	"/request-password-reset"
];
const Providers = {
	CLOUDFLARE_TURNSTILE: "cloudflare-turnstile",
	GOOGLE_RECAPTCHA: "google-recaptcha",
	HCAPTCHA: "hcaptcha",
	CAPTCHAFOX: "captchafox"
};
const siteVerifyMap = {
	[Providers.CLOUDFLARE_TURNSTILE]: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
	[Providers.GOOGLE_RECAPTCHA]: "https://www.google.com/recaptcha/api/siteverify",
	[Providers.HCAPTCHA]: "https://api.hcaptcha.com/siteverify",
	[Providers.CAPTCHAFOX]: "https://api.captchafox.com/siteverify"
};

//#endregion
//#region src/plugins/captcha/error-codes.ts
const EXTERNAL_ERROR_CODES = defineErrorCodes({
	VERIFICATION_FAILED: "Captcha verification failed",
	MISSING_RESPONSE: "Missing CAPTCHA response",
	UNKNOWN_ERROR: "Something went wrong"
});
const INTERNAL_ERROR_CODES = defineErrorCodes({
	MISSING_SECRET_KEY: "Missing secret key",
	SERVICE_UNAVAILABLE: "CAPTCHA service unavailable"
});

//#endregion
//#region src/plugins/captcha/utils.ts
const encodeToURLParams = (obj) => {
	if (typeof obj !== "object" || obj === null || Array.isArray(obj)) throw new Error("Input must be a non-null object.");
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(obj)) if (value !== void 0 && value !== null) params.append(key, String(value));
	return params.toString();
};

//#endregion
//#region src/plugins/captcha/verify-handlers/captchafox.ts
const captchaFox = async ({ siteVerifyURL, captchaResponse, secretKey, siteKey, remoteIP }) => {
	const response = await betterFetch(siteVerifyURL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: encodeToURLParams({
			secret: secretKey,
			response: captchaResponse,
			...siteKey && { sitekey: siteKey },
			...remoteIP && { remoteIp: remoteIP }
		})
	});
	if (!response.data || response.error) throw new Error(INTERNAL_ERROR_CODES.SERVICE_UNAVAILABLE);
	if (!response.data.success) return middlewareResponse({
		message: EXTERNAL_ERROR_CODES.VERIFICATION_FAILED,
		status: 403
	});
};

//#endregion
//#region src/plugins/captcha/verify-handlers/cloudflare-turnstile.ts
const cloudflareTurnstile = async ({ siteVerifyURL, captchaResponse, secretKey, remoteIP }) => {
	const response = await betterFetch(siteVerifyURL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			secret: secretKey,
			response: captchaResponse,
			...remoteIP && { remoteip: remoteIP }
		})
	});
	if (!response.data || response.error) throw new Error(INTERNAL_ERROR_CODES.SERVICE_UNAVAILABLE);
	if (!response.data.success) return middlewareResponse({
		message: EXTERNAL_ERROR_CODES.VERIFICATION_FAILED,
		status: 403
	});
};

//#endregion
//#region src/plugins/captcha/verify-handlers/google-recaptcha.ts
const isV3 = (response) => {
	return "score" in response && typeof response.score === "number";
};
const googleRecaptcha = async ({ siteVerifyURL, captchaResponse, secretKey, minScore = .5, remoteIP }) => {
	const response = await betterFetch(siteVerifyURL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: encodeToURLParams({
			secret: secretKey,
			response: captchaResponse,
			...remoteIP && { remoteip: remoteIP }
		})
	});
	if (!response.data || response.error) throw new Error(INTERNAL_ERROR_CODES.SERVICE_UNAVAILABLE);
	if (!response.data.success || isV3(response.data) && response.data.score < minScore) return middlewareResponse({
		message: EXTERNAL_ERROR_CODES.VERIFICATION_FAILED,
		status: 403
	});
};

//#endregion
//#region src/plugins/captcha/verify-handlers/h-captcha.ts
const hCaptcha = async ({ siteVerifyURL, captchaResponse, secretKey, siteKey, remoteIP }) => {
	const response = await betterFetch(siteVerifyURL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: encodeToURLParams({
			secret: secretKey,
			response: captchaResponse,
			...siteKey && { sitekey: siteKey },
			...remoteIP && { remoteip: remoteIP }
		})
	});
	if (!response.data || response.error) throw new Error(INTERNAL_ERROR_CODES.SERVICE_UNAVAILABLE);
	if (!response.data.success) return middlewareResponse({
		message: EXTERNAL_ERROR_CODES.VERIFICATION_FAILED,
		status: 403
	});
};

//#endregion
//#region src/plugins/captcha/index.ts
const captcha = (options) => ({
	id: "captcha",
	onRequest: async (request, ctx) => {
		try {
			if (!(options.endpoints?.length ? options.endpoints : defaultEndpoints).some((endpoint) => request.url.includes(endpoint))) return void 0;
			if (!options.secretKey) throw new Error(INTERNAL_ERROR_CODES.MISSING_SECRET_KEY);
			const captchaResponse = request.headers.get("x-captcha-response");
			const remoteUserIP = getIp(request, ctx.options) ?? void 0;
			if (!captchaResponse) return middlewareResponse({
				message: EXTERNAL_ERROR_CODES.MISSING_RESPONSE,
				status: 400
			});
			const handlerParams = {
				siteVerifyURL: options.siteVerifyURLOverride || siteVerifyMap[options.provider],
				captchaResponse,
				secretKey: options.secretKey,
				remoteIP: remoteUserIP
			};
			if (options.provider === Providers.CLOUDFLARE_TURNSTILE) return await cloudflareTurnstile(handlerParams);
			if (options.provider === Providers.GOOGLE_RECAPTCHA) return await googleRecaptcha({
				...handlerParams,
				minScore: options.minScore
			});
			if (options.provider === Providers.HCAPTCHA) return await hCaptcha({
				...handlerParams,
				siteKey: options.siteKey
			});
			if (options.provider === Providers.CAPTCHAFOX) return await captchaFox({
				...handlerParams,
				siteKey: options.siteKey
			});
		} catch (_error) {
			const errorMessage = _error instanceof Error ? _error.message : void 0;
			ctx.logger.error(errorMessage ?? "Unknown error", {
				endpoint: request.url,
				message: _error
			});
			return middlewareResponse({
				message: EXTERNAL_ERROR_CODES.UNKNOWN_ERROR,
				status: 500
			});
		}
	}
});

//#endregion
export { captcha as t };