import "../dialect-BvcuosDD.mjs";
import "../get-model-name-D4DUV7S2.mjs";
import { d as getBaseAdapter } from "../get-migration-6ewabxRC.mjs";
import "../utils-DBbaShi0.mjs";
import "../crypto-BQxYXGGX.mjs";
import "../jwt-DzuIBp7t.mjs";
import "../misc-D8A8FGv2.mjs";
import "../schema-CSB7dlK0.mjs";
import "../get-request-ip-RYTz2Uba.mjs";
import "../json-_HMgPUVh.mjs";
import "../url-BLNRhCPO.mjs";
import "../api-q2sbQ7PT.mjs";
import "../cookies-D_dksn7B.mjs";
import "../session-CgfX4vv1.mjs";
import { n as createAuthContext, t as createBetterAuth } from "../base-zB21ymNq.mjs";
import "../password-DBH2q5D6.mjs";
import { BetterAuthError } from "@better-auth/core/error";

//#region src/context/init-minimal.ts
const initMinimal = async (options) => {
	const adapter = await getBaseAdapter(options, async () => {
		throw new BetterAuthError("Direct database connection requires Kysely. Please use `better-auth` instead of `better-auth/minimal`, or provide an adapter (drizzleAdapter, prismaAdapter, etc.)");
	});
	const getDatabaseType = (_database) => "unknown";
	const ctx = await createAuthContext(adapter, options, getDatabaseType);
	ctx.runMigrations = async function() {
		throw new BetterAuthError("Migrations are not supported in 'better-auth/minimal'. Please use 'better-auth' for migration support.");
	};
	return ctx;
};

//#endregion
//#region src/auth/minimal.ts
/**
* Better Auth initializer for minimal mode (without Kysely)
*/
const betterAuth = (options) => {
	return createBetterAuth(options, initMinimal);
};

//#endregion
export { betterAuth };