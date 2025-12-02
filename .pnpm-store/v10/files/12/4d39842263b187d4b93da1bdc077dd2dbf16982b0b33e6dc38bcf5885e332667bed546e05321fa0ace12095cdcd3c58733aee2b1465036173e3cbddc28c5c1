import { t as createAccessControl } from "./access-DXuPG0DH.mjs";

//#region src/plugins/admin/access/statement.ts
const defaultStatements = {
	user: [
		"create",
		"list",
		"set-role",
		"ban",
		"impersonate",
		"delete",
		"set-password",
		"get",
		"update"
	],
	session: [
		"list",
		"revoke",
		"delete"
	]
};
const defaultAc = createAccessControl(defaultStatements);
const adminAc = defaultAc.newRole({
	user: [
		"create",
		"list",
		"set-role",
		"ban",
		"impersonate",
		"delete",
		"set-password",
		"get",
		"update"
	],
	session: [
		"list",
		"revoke",
		"delete"
	]
});
const userAc = defaultAc.newRole({
	user: [],
	session: []
});
const defaultRoles = {
	admin: adminAc,
	user: userAc
};

//#endregion
export { userAc as a, defaultStatements as i, defaultAc as n, defaultRoles as r, adminAc as t };