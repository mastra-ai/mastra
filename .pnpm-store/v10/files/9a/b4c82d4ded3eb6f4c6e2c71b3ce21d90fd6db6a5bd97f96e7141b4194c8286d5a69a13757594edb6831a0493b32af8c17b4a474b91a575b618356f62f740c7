import { n as getSession } from "./session-CgfX4vv1.mjs";
import { t as getEndpointResponse } from "./plugin-helper-CA_Vvnl9.mjs";
import * as z from "zod";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";

//#region src/plugins/custom-session/index.ts
const getSessionQuerySchema = z.optional(z.object({
	disableCookieCache: z.boolean().meta({ description: "Disable cookie cache and fetch session from database" }).or(z.string().transform((v) => v === "true")).optional(),
	disableRefresh: z.boolean().meta({ description: "Disable session refresh. Useful for checking session status, without updating the session" }).optional()
}));
const customSession = (fn, options, pluginOptions) => {
	return {
		id: "custom-session",
		hooks: { after: [{
			matcher: (ctx) => ctx.path === "/multi-session/list-device-sessions" && (pluginOptions?.shouldMutateListDeviceSessionsEndpoint ?? false),
			handler: createAuthMiddleware(async (ctx) => {
				const response = await getEndpointResponse(ctx);
				if (!response) return;
				const newResponse = await Promise.all(response.map(async (v) => await fn(v, ctx)));
				return ctx.json(newResponse);
			})
		}] },
		endpoints: { getSession: createAuthEndpoint("/get-session", {
			method: "GET",
			query: getSessionQuerySchema,
			metadata: {
				CUSTOM_SESSION: true,
				openapi: {
					description: "Get custom session data",
					responses: { "200": {
						description: "Success",
						content: { "application/json": { schema: {
							type: "array",
							nullable: true,
							items: { $ref: "#/components/schemas/Session" }
						} } }
					} }
				}
			},
			requireHeaders: true
		}, async (ctx) => {
			const session = await getSession()({
				...ctx,
				asResponse: false,
				headers: ctx.headers,
				returnHeaders: true
			}).catch((e) => {
				return null;
			});
			if (!session?.response) return ctx.json(null);
			const fnResult = await fn(session.response, ctx);
			const setCookie = session.headers.get("set-cookie");
			if (setCookie) {
				ctx.setHeader("set-cookie", setCookie);
				session.headers.delete("set-cookie");
			}
			session.headers.forEach((value, key) => {
				ctx.setHeader(key, value);
			});
			return ctx.json(fnResult);
		}) },
		$Infer: { Session: {} }
	};
};

//#endregion
export { customSession as t };