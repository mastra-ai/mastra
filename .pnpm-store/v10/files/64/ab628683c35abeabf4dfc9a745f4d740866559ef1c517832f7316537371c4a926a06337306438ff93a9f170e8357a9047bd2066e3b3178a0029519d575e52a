import "../jwt-DzuIBp7t.mjs";
import "../schema-CSB7dlK0.mjs";
import "../json-_HMgPUVh.mjs";
import "../url-BLNRhCPO.mjs";
import { l as parseSetCookieHeader } from "../cookies-D_dksn7B.mjs";
import { createAuthMiddleware } from "@better-auth/core/api";

//#region src/integrations/tanstack-start.ts
const tanstackStartCookies = () => {
	return {
		id: "tanstack-start-cookies",
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
					const { setCookie } = await import("../server-Dtqyy0Rw.mjs");
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
							setCookie(key, decodeURIComponent(value.value), opts);
						} catch (e) {}
					});
					return;
				}
			})
		}] }
	};
};

//#endregion
export { tanstackStartCookies };