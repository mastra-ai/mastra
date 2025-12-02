import "../jwt-DzuIBp7t.mjs";
import "../schema-CSB7dlK0.mjs";
import "../json-_HMgPUVh.mjs";
import "../url-BLNRhCPO.mjs";
import { l as parseSetCookieHeader } from "../cookies-D_dksn7B.mjs";
import { createAuthMiddleware } from "@better-auth/core/api";

//#region src/integrations/next-js.ts
function toNextJsHandler(auth) {
	const handler = async (request) => {
		return "handler" in auth ? auth.handler(request) : auth(request);
	};
	return {
		GET: handler,
		POST: handler,
		PATCH: handler,
		PUT: handler,
		DELETE: handler
	};
}
const nextCookies = () => {
	return {
		id: "next-cookies",
		hooks: { after: [{
			matcher(ctx) {
				return true;
			},
			handler: createAuthMiddleware(async (ctx) => {
				const returned = ctx.context.responseHeaders;
				if ("_flag" in ctx && ctx._flag === "router") return;
				if (returned instanceof Headers) {
					const setCookies = returned?.get("set-cookie");
					if (!setCookies) return;
					const parsed = parseSetCookieHeader(setCookies);
					const { cookies } = await import("next/headers");
					let cookieHelper;
					try {
						cookieHelper = await cookies();
					} catch (error) {
						if (error instanceof Error && error.message.startsWith("`cookies` was called outside a request scope.")) return;
						throw error;
					}
					parsed.forEach((value, key) => {
						if (!key) return;
						const opts = {
							sameSite: value.samesite,
							secure: value.secure,
							maxAge: value["max-age"],
							httpOnly: value.httponly,
							domain: value.domain,
							path: value.path
						};
						try {
							cookieHelper.set(key, decodeURIComponent(value.value), opts);
						} catch (e) {}
					});
					return;
				}
			})
		}] }
	};
};

//#endregion
export { nextCookies, toNextJsHandler };