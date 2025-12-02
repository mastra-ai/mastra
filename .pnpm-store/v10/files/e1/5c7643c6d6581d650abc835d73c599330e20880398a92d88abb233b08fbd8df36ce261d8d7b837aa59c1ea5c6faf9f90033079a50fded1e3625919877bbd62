import { APIError } from "better-call";

//#region src/utils/password.ts
async function validatePassword(ctx, data) {
	const credentialAccount = (await ctx.context.internalAdapter.findAccounts(data.userId))?.find((account) => account.providerId === "credential");
	const currentPassword = credentialAccount?.password;
	if (!credentialAccount || !currentPassword) return false;
	return await ctx.context.password.verify({
		hash: currentPassword,
		password: data.password
	});
}
async function checkPassword(userId, c) {
	const credentialAccount = (await c.context.internalAdapter.findAccounts(userId))?.find((account) => account.providerId === "credential");
	const currentPassword = credentialAccount?.password;
	if (!credentialAccount || !currentPassword || !c.body.password) throw new APIError("BAD_REQUEST", { message: "No password credential found" });
	if (!await c.context.password.verify({
		hash: currentPassword,
		password: c.body.password
	})) throw new APIError("BAD_REQUEST", { message: "Invalid password" });
	return true;
}

//#endregion
export { validatePassword as n, checkPassword as t };