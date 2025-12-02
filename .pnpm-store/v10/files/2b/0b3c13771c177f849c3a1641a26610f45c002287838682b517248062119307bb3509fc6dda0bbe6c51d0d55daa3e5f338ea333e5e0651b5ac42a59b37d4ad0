import { n as symmetricEncrypt, t as symmetricDecrypt } from "./crypto-BQxYXGGX.mjs";
import { t as mergeSchema } from "./schema-CSB7dlK0.mjs";
import { t as APIError } from "./api-q2sbQ7PT.mjs";
import { u as sessionMiddleware } from "./session-CgfX4vv1.mjs";
import { getCurrentAuthContext } from "@better-auth/core/context";
import { BetterAuthError } from "@better-auth/core/error";
import * as z from "zod";
import { SignJWT, exportJWK, generateKeyPair, importJWK, jwtVerify } from "jose";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";
import { base64 } from "@better-auth/utils/base64";
import { getWebcryptoSubtle } from "@better-auth/utils";

//#region src/plugins/jwt/adapter.ts
const getJwksAdapter = (adapter, options) => {
	return {
		getAllKeys: async (ctx) => {
			if (options?.adapter?.getJwks) return await options.adapter.getJwks(ctx);
			return await adapter.findMany({ model: "jwks" });
		},
		getLatestKey: async (ctx) => {
			if (options?.adapter?.getJwks) return (await options.adapter.getJwks(ctx))?.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
			return (await adapter.findMany({ model: "jwks" }))?.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
		},
		createJwk: async (ctx, webKey) => {
			if (options?.adapter?.createJwk) return await options.adapter.createJwk(webKey, ctx);
			return await adapter.create({
				model: "jwks",
				data: {
					...webKey,
					createdAt: /* @__PURE__ */ new Date()
				}
			});
		}
	};
};

//#endregion
//#region src/plugins/jwt/schema.ts
const schema = { jwks: { fields: {
	publicKey: {
		type: "string",
		required: true
	},
	privateKey: {
		type: "string",
		required: true
	},
	createdAt: {
		type: "date",
		required: true
	},
	expiresAt: {
		type: "date",
		required: false
	}
} } };

//#endregion
//#region src/utils/time.ts
const minute = 60;
const hour = minute * 60;
const day = hour * 24;
const week = day * 7;
const year = day * 365.25;
const REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
/**
* https://github.com/panva/jose/blob/723ee6152d7ee2fc81852d2d26777e86df6fce01/src/lib/secs.ts
*/
function joseSecs(str) {
	const matched = REGEX.exec(str);
	if (!matched || matched[4] && matched[1]) throw new TypeError("Invalid time period format");
	const value = parseFloat(matched[2]);
	const unit = matched[3].toLowerCase();
	let numericDate;
	switch (unit) {
		case "sec":
		case "secs":
		case "second":
		case "seconds":
		case "s":
			numericDate = Math.round(value);
			break;
		case "minute":
		case "minutes":
		case "min":
		case "mins":
		case "m":
			numericDate = Math.round(value * minute);
			break;
		case "hour":
		case "hours":
		case "hr":
		case "hrs":
		case "h":
			numericDate = Math.round(value * hour);
			break;
		case "day":
		case "days":
		case "d":
			numericDate = Math.round(value * day);
			break;
		case "week":
		case "weeks":
		case "w":
			numericDate = Math.round(value * week);
			break;
		default:
			numericDate = Math.round(value * year);
			break;
	}
	if (matched[1] === "-" || matched[4] === "ago") return -numericDate;
	return numericDate;
}

//#endregion
//#region src/plugins/jwt/utils.ts
/**
* Converts an expirationTime to ISO seconds expiration time (the format of JWT exp)
*
* See https://github.com/panva/jose/blob/main/src/lib/jwt_claims_set.ts#L245
*
* @param expirationTime - see options.jwt.expirationTime
* @param iat - the iat time to consolidate on
* @returns
*/
function toExpJWT(expirationTime, iat) {
	if (typeof expirationTime === "number") return expirationTime;
	else if (expirationTime instanceof Date) return Math.floor(expirationTime.getTime() / 1e3);
	else return iat + joseSecs(expirationTime);
}
async function generateExportedKeyPair(options) {
	const { alg, ...cfg } = options?.jwks?.keyPairConfig ?? {
		alg: "EdDSA",
		crv: "Ed25519"
	};
	const { publicKey, privateKey } = await generateKeyPair(alg, {
		...cfg,
		extractable: true
	});
	return {
		publicWebKey: await exportJWK(publicKey),
		privateWebKey: await exportJWK(privateKey),
		alg,
		cfg
	};
}
/**
* Creates a Jwk on the database
*
* @param ctx
* @param options
* @returns
*/
async function createJwk(ctx, options) {
	const { publicWebKey, privateWebKey, alg, cfg } = await generateExportedKeyPair(options);
	const stringifiedPrivateWebKey = JSON.stringify(privateWebKey);
	const privateKeyEncryptionEnabled = !options?.jwks?.disablePrivateKeyEncryption;
	let jwk = {
		alg,
		...cfg && "crv" in cfg ? { crv: cfg.crv } : {},
		publicKey: JSON.stringify(publicWebKey),
		privateKey: privateKeyEncryptionEnabled ? JSON.stringify(await symmetricEncrypt({
			key: ctx.context.secret,
			data: stringifiedPrivateWebKey
		})) : stringifiedPrivateWebKey,
		createdAt: /* @__PURE__ */ new Date(),
		...options?.jwks?.rotationInterval ? { expiresAt: new Date(Date.now() + options.jwks.rotationInterval * 1e3) } : {}
	};
	return await getJwksAdapter(ctx.context.adapter, options).createJwk(ctx, jwk);
}

//#endregion
//#region src/plugins/jwt/sign.ts
async function signJWT(ctx, config) {
	const { options, payload } = config;
	const nowSeconds = Math.floor(Date.now() / 1e3);
	const iat = payload.iat;
	let exp = payload.exp;
	const defaultExp = toExpJWT(options?.jwt?.expirationTime ?? "15m", iat ?? nowSeconds);
	exp = exp ?? defaultExp;
	const nbf = payload.nbf;
	const iss = payload.iss;
	const defaultIss = options?.jwt?.issuer ?? ctx.context.options.baseURL;
	const aud = payload.aud;
	const defaultAud = options?.jwt?.audience ?? ctx.context.options.baseURL;
	if (options?.jwt?.sign) {
		const jwtPayload = {
			...payload,
			iat,
			exp,
			nbf,
			iss: iss ?? defaultIss,
			aud: aud ?? defaultAud
		};
		return options.jwt.sign(jwtPayload);
	}
	let key = await getJwksAdapter(ctx.context.adapter, options).getLatestKey(ctx);
	if (!key || key.expiresAt && key.expiresAt < /* @__PURE__ */ new Date()) key = await createJwk(ctx, options);
	let privateWebKey = !options?.jwks?.disablePrivateKeyEncryption ? await symmetricDecrypt({
		key: ctx.context.secret,
		data: JSON.parse(key.privateKey)
	}).catch(() => {
		throw new BetterAuthError("Failed to decrypt private key. Make sure the secret currently in use is the same as the one used to encrypt the private key. If you are using a different secret, either clean up your JWKS or disable private key encryption.");
	}) : key.privateKey;
	const alg = key.alg ?? options?.jwks?.keyPairConfig?.alg ?? "EdDSA";
	const privateKey = await importJWK(JSON.parse(privateWebKey), alg);
	const jwt$1 = new SignJWT(payload).setProtectedHeader({
		alg,
		kid: key.id
	}).setExpirationTime(exp).setIssuer(iss ?? defaultIss).setAudience(aud ?? defaultAud);
	if (iat) jwt$1.setIssuedAt(iat);
	if (payload.sub) jwt$1.setSubject(payload.sub);
	if (payload.nbf) jwt$1.setNotBefore(payload.nbf);
	if (payload.jti) jwt$1.setJti(payload.jti);
	return await jwt$1.sign(privateKey);
}
async function getJwtToken(ctx, options) {
	const payload = !options?.jwt?.definePayload ? ctx.context.session.user : await options?.jwt.definePayload(ctx.context.session);
	return await signJWT(ctx, {
		options,
		payload: {
			iat: Math.floor(Date.now() / 1e3),
			...payload,
			sub: await options?.jwt?.getSubject?.(ctx.context.session) ?? ctx.context.session.user.id
		}
	});
}

//#endregion
//#region src/plugins/jwt/verify.ts
/**
* Verify a JWT token using the JWKS public keys
* Returns the payload if valid, null otherwise
*/
async function verifyJWT(token, options) {
	const ctx = await getCurrentAuthContext();
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		const headerStr = new TextDecoder().decode(base64.decode(parts[0]));
		const kid = JSON.parse(headerStr).kid;
		if (!kid) {
			ctx.context.logger.debug("JWT missing kid in header");
			return null;
		}
		const keys = await getJwksAdapter(ctx.context.adapter, options).getAllKeys(ctx);
		if (!keys || keys.length === 0) {
			ctx.context.logger.debug("No JWKS keys available");
			return null;
		}
		const key = keys.find((k) => k.id === kid);
		if (!key) {
			ctx.context.logger.debug(`No JWKS key found for kid: ${kid}`);
			return null;
		}
		const { payload } = await jwtVerify(token, await importJWK(JSON.parse(key.publicKey), key.alg ?? options?.jwks?.keyPairConfig?.alg ?? "EdDSA"), { issuer: options?.jwt?.issuer ?? ctx.context.options.baseURL });
		if (!payload.sub || !payload.aud) return null;
		return payload;
	} catch (error) {
		ctx.context.logger.debug("JWT verification failed", error);
		return null;
	}
}

//#endregion
//#region src/plugins/jwt/index.ts
const jwt = (options) => {
	if (options?.jwt?.sign && !options.jwks?.remoteUrl) throw new BetterAuthError("jwks_config", "jwks.remoteUrl must be set when using jwt.sign");
	if (options?.jwks?.remoteUrl && !options.jwks?.keyPairConfig?.alg) throw new BetterAuthError("jwks_config", "must specify alg when using the oidc plugin and jwks.remoteUrl");
	const jwksPath = options?.jwks?.jwksPath ?? "/jwks";
	if (typeof jwksPath !== "string" || jwksPath.length === 0 || !jwksPath.startsWith("/") || jwksPath.includes("..")) throw new BetterAuthError("jwks_config", "jwksPath must be a non-empty string starting with '/' and not contain '..'");
	return {
		id: "jwt",
		options,
		endpoints: {
			getJwks: createAuthEndpoint(jwksPath, {
				method: "GET",
				metadata: { openapi: {
					operationId: "getJSONWebKeySet",
					description: "Get the JSON Web Key Set",
					responses: { "200": {
						description: "JSON Web Key Set retrieved successfully",
						content: { "application/json": { schema: {
							type: "object",
							properties: { keys: {
								type: "array",
								description: "Array of public JSON Web Keys",
								items: {
									type: "object",
									properties: {
										kid: {
											type: "string",
											description: "Key ID uniquely identifying the key, corresponds to the 'id' from the stored Jwk"
										},
										kty: {
											type: "string",
											description: "Key type (e.g., 'RSA', 'EC', 'OKP')"
										},
										alg: {
											type: "string",
											description: "Algorithm intended for use with the key (e.g., 'EdDSA', 'RS256')"
										},
										use: {
											type: "string",
											description: "Intended use of the public key (e.g., 'sig' for signature)",
											enum: ["sig"],
											nullable: true
										},
										n: {
											type: "string",
											description: "Modulus for RSA keys (base64url-encoded)",
											nullable: true
										},
										e: {
											type: "string",
											description: "Exponent for RSA keys (base64url-encoded)",
											nullable: true
										},
										crv: {
											type: "string",
											description: "Curve name for elliptic curve keys (e.g., 'Ed25519', 'P-256')",
											nullable: true
										},
										x: {
											type: "string",
											description: "X coordinate for elliptic curve keys (base64url-encoded)",
											nullable: true
										},
										y: {
											type: "string",
											description: "Y coordinate for elliptic curve keys (base64url-encoded)",
											nullable: true
										}
									},
									required: [
										"kid",
										"kty",
										"alg"
									]
								}
							} },
							required: ["keys"]
						} } }
					} }
				} }
			}, async (ctx) => {
				if (options?.jwks?.remoteUrl) throw new APIError("NOT_FOUND");
				const adapter = getJwksAdapter(ctx.context.adapter, options);
				let keySets = await adapter.getAllKeys(ctx);
				if (!keySets || keySets?.length === 0) {
					await createJwk(ctx, options);
					keySets = await adapter.getAllKeys(ctx);
				}
				if (!keySets?.length) throw new BetterAuthError("No key sets found. Make sure you have a key in your database.");
				const now = Date.now();
				const gracePeriod = (options?.jwks?.gracePeriod ?? 3600 * 24 * 30) * 1e3;
				const keys = keySets.filter((key) => {
					if (!key.expiresAt) return true;
					return key.expiresAt.getTime() + gracePeriod > now;
				});
				const keyPairConfig = options?.jwks?.keyPairConfig;
				const defaultCrv = keyPairConfig ? "crv" in keyPairConfig ? keyPairConfig.crv : void 0 : void 0;
				return ctx.json({ keys: keys.map((keySet) => {
					return {
						alg: keySet.alg ?? options?.jwks?.keyPairConfig?.alg ?? "EdDSA",
						crv: keySet.crv ?? defaultCrv,
						...JSON.parse(keySet.publicKey),
						kid: keySet.id
					};
				}) });
			}),
			getToken: createAuthEndpoint("/token", {
				method: "GET",
				requireHeaders: true,
				use: [sessionMiddleware],
				metadata: { openapi: {
					operationId: "getJSONWebToken",
					description: "Get a JWT token",
					responses: { 200: {
						description: "Success",
						content: { "application/json": { schema: {
							type: "object",
							properties: { token: { type: "string" } }
						} } }
					} }
				} }
			}, async (ctx) => {
				const jwt$1 = await getJwtToken(ctx, options);
				return ctx.json({ token: jwt$1 });
			}),
			signJWT: createAuthEndpoint("/sign-jwt", {
				method: "POST",
				metadata: {
					SERVER_ONLY: true,
					$Infer: { body: {} }
				},
				body: z.object({
					payload: z.record(z.string(), z.any()),
					overrideOptions: z.record(z.string(), z.any()).optional()
				})
			}, async (c) => {
				const jwt$1 = await signJWT(c, {
					options: {
						...options,
						...c.body.overrideOptions
					},
					payload: c.body.payload
				});
				return c.json({ token: jwt$1 });
			}),
			verifyJWT: createAuthEndpoint("/verify-jwt", {
				method: "POST",
				metadata: {
					SERVER_ONLY: true,
					$Infer: {
						body: {},
						response: {}
					}
				},
				body: z.object({
					token: z.string(),
					issuer: z.string().optional()
				})
			}, async (ctx) => {
				const overrideOptions = ctx.body.issuer ? {
					...options,
					jwt: {
						...options?.jwt,
						issuer: ctx.body.issuer
					}
				} : options;
				const payload = await verifyJWT(ctx.body.token, overrideOptions);
				return ctx.json({ payload });
			})
		},
		hooks: { after: [{
			matcher(context) {
				return context.path === "/get-session";
			},
			handler: createAuthMiddleware(async (ctx) => {
				if (options?.disableSettingJwtHeader) return;
				const session = ctx.context.session || ctx.context.newSession;
				if (session && session.session) {
					const jwt$1 = await getJwtToken(ctx, options);
					const exposedHeaders = ctx.context.responseHeaders?.get("access-control-expose-headers") || "";
					const headersSet = new Set(exposedHeaders.split(",").map((header) => header.trim()).filter(Boolean));
					headersSet.add("set-auth-jwt");
					ctx.setHeader("set-auth-jwt", jwt$1);
					ctx.setHeader("Access-Control-Expose-Headers", Array.from(headersSet).join(", "));
				}
			})
		}] },
		schema: mergeSchema(schema, options?.schema)
	};
};

//#endregion
export { generateExportedKeyPair as a, createJwk as i, verifyJWT as n, getJwtToken as r, jwt as t };