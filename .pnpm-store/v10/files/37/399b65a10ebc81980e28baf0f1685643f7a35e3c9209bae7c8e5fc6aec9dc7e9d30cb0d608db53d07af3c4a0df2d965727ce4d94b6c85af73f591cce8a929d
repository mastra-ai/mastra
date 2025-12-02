import { t as createAccessControl } from "./access-DXuPG0DH.mjs";

//#region src/plugins/organization/access/statement.ts
const defaultStatements = {
	organization: ["update", "delete"],
	member: [
		"create",
		"update",
		"delete"
	],
	invitation: ["create", "cancel"],
	team: [
		"create",
		"update",
		"delete"
	],
	ac: [
		"create",
		"read",
		"update",
		"delete"
	]
};
const defaultAc = createAccessControl(defaultStatements);
const adminAc = defaultAc.newRole({
	organization: ["update"],
	invitation: ["create", "cancel"],
	member: [
		"create",
		"update",
		"delete"
	],
	team: [
		"create",
		"update",
		"delete"
	],
	ac: [
		"create",
		"read",
		"update",
		"delete"
	]
});
const ownerAc = defaultAc.newRole({
	organization: ["update", "delete"],
	member: [
		"create",
		"update",
		"delete"
	],
	invitation: ["create", "cancel"],
	team: [
		"create",
		"update",
		"delete"
	],
	ac: [
		"create",
		"read",
		"update",
		"delete"
	]
});
const memberAc = defaultAc.newRole({
	organization: [],
	member: [],
	invitation: [],
	team: [],
	ac: ["read"]
});
const defaultRoles = {
	admin: adminAc,
	owner: ownerAc,
	member: memberAc
};

//#endregion
export { memberAc as a, defaultStatements as i, defaultAc as n, ownerAc as o, defaultRoles as r, adminAc as t };