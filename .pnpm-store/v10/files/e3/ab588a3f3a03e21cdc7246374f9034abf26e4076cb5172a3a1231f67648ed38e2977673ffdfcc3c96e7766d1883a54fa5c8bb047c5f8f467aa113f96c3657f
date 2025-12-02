//#region src/plugins/organization/permission.ts
const hasPermissionFn = (input, acRoles) => {
	if (!input.permissions && !input.permission) return false;
	const roles = input.role.split(",");
	const creatorRole = input.options.creatorRole || "owner";
	const isCreator = roles.includes(creatorRole);
	const allowCreatorsAllPermissions = input.allowCreatorAllPermissions || false;
	if (isCreator && allowCreatorsAllPermissions) return true;
	for (const role of roles) if ((acRoles[role]?.authorize(input.permissions ?? input.permission))?.success) return true;
	return false;
};
let cacheAllRoles = /* @__PURE__ */ new Map();

//#endregion
export { hasPermissionFn as n, cacheAllRoles as t };