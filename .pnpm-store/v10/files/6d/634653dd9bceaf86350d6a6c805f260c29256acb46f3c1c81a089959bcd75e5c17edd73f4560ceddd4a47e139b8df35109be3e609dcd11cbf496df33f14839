import * as z from "zod";

//#region src/db/schema/shared.ts
const coreSchema = z.object({
	id: z.string(),
	createdAt: z.date().default(() => /* @__PURE__ */ new Date()),
	updatedAt: z.date().default(() => /* @__PURE__ */ new Date())
});

//#endregion
//#region src/db/schema/account.ts
const accountSchema = coreSchema.extend({
	providerId: z.string(),
	accountId: z.string(),
	userId: z.coerce.string(),
	accessToken: z.string().nullish(),
	refreshToken: z.string().nullish(),
	idToken: z.string().nullish(),
	accessTokenExpiresAt: z.date().nullish(),
	refreshTokenExpiresAt: z.date().nullish(),
	scope: z.string().nullish(),
	password: z.string().nullish()
});

//#endregion
//#region src/db/schema/rate-limit.ts
const rateLimitSchema = z.object({
	key: z.string(),
	count: z.number(),
	lastRequest: z.number()
});

//#endregion
//#region src/db/schema/session.ts
const sessionSchema = coreSchema.extend({
	userId: z.coerce.string(),
	expiresAt: z.date(),
	token: z.string(),
	ipAddress: z.string().nullish(),
	userAgent: z.string().nullish()
});

//#endregion
//#region src/db/schema/user.ts
const userSchema = coreSchema.extend({
	email: z.string().transform((val) => val.toLowerCase()),
	emailVerified: z.boolean().default(false),
	name: z.string(),
	image: z.string().nullish()
});

//#endregion
//#region src/db/schema/verification.ts
const verificationSchema = coreSchema.extend({
	value: z.string(),
	expiresAt: z.date(),
	identifier: z.string()
});

//#endregion
export { accountSchema, coreSchema, rateLimitSchema, sessionSchema, userSchema, verificationSchema };