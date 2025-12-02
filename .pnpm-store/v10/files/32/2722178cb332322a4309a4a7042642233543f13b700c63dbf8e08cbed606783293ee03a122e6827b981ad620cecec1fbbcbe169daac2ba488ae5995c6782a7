import { n as getKyselyDatabaseType } from "./dialect-BvcuosDD.mjs";
import { t as getMigrations, u as getAdapter } from "./get-migration-6ewabxRC.mjs";
import { n as createAuthContext, t as createBetterAuth } from "./base-zB21ymNq.mjs";
import { BetterAuthError } from "@better-auth/core/error";

//#region src/context/init.ts
const init = async (options) => {
	const adapter = await getAdapter(options);
	const getDatabaseType = (database) => getKyselyDatabaseType(database) || "unknown";
	const ctx = await createAuthContext(adapter, options, getDatabaseType);
	ctx.runMigrations = async function() {
		if (!options.database || "updateMany" in options.database) throw new BetterAuthError("Database is not provided or it's an adapter. Migrations are only supported with a database instance.");
		const { runMigrations } = await getMigrations(options);
		await runMigrations();
	};
	return ctx;
};

//#endregion
//#region src/auth/auth.ts
/**
* Better Auth initializer for full mode (with Kysely)
*
* Check `minimal.ts` for minimal mode (without Kysely)
*/
const betterAuth = (options) => {
	return createBetterAuth(options, init);
};

//#endregion
export { betterAuth as t };