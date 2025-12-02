import { i as toZodSchema } from "./get-migration-6ewabxRC.mjs";
import { t as generateId } from "./utils-DBbaShi0.mjs";
import { u as getDate } from "./schema-CSB7dlK0.mjs";
import { t as APIError$1 } from "./api-q2sbQ7PT.mjs";
import { c as setSessionCookie } from "./cookies-D_dksn7B.mjs";
import { a as requestOnlySessionMiddleware, r as getSessionFromCtx, u as sessionMiddleware } from "./session-CgfX4vv1.mjs";
import { n as parser_default } from "./parser-kwbb5q_C.mjs";
import { r as defaultRoles } from "./access-Cr_p-YVH.mjs";
import { n as hasPermissionFn, t as cacheAllRoles } from "./permission-ouQCO-51.mjs";
import { getCurrentAdapter } from "@better-auth/core/context";
import { BASE_ERROR_CODES, BetterAuthError } from "@better-auth/core/error";
import { defineErrorCodes } from "@better-auth/core/utils";
import { APIError } from "better-call";
import * as z from "zod";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";

//#region src/utils/shim.ts
const shimContext = (originalObject, newContext) => {
	const shimmedObj = {};
	for (const [key, value] of Object.entries(originalObject)) {
		shimmedObj[key] = (ctx) => {
			return value({
				...ctx,
				context: {
					...newContext,
					...ctx.context
				}
			});
		};
		shimmedObj[key].path = value.path;
		shimmedObj[key].method = value.method;
		shimmedObj[key].options = value.options;
		shimmedObj[key].headers = value.headers;
	}
	return shimmedObj;
};

//#endregion
//#region src/plugins/organization/adapter.ts
const getOrgAdapter = (context, options) => {
	const baseAdapter = context.adapter;
	return {
		findOrganizationBySlug: async (slug) => {
			return await (await getCurrentAdapter(baseAdapter)).findOne({
				model: "organization",
				where: [{
					field: "slug",
					value: slug
				}]
			});
		},
		createOrganization: async (data) => {
			const organization$1 = await (await getCurrentAdapter(baseAdapter)).create({
				model: "organization",
				data: {
					...data.organization,
					metadata: data.organization.metadata ? JSON.stringify(data.organization.metadata) : void 0
				},
				forceAllowId: true
			});
			return {
				...organization$1,
				metadata: organization$1.metadata && typeof organization$1.metadata === "string" ? JSON.parse(organization$1.metadata) : void 0
			};
		},
		findMemberByEmail: async (data) => {
			const adapter = await getCurrentAdapter(baseAdapter);
			const user = await adapter.findOne({
				model: "user",
				where: [{
					field: "email",
					value: data.email.toLowerCase()
				}]
			});
			if (!user) return null;
			const member = await adapter.findOne({
				model: "member",
				where: [{
					field: "organizationId",
					value: data.organizationId
				}, {
					field: "userId",
					value: user.id
				}]
			});
			if (!member) return null;
			return {
				...member,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image
				}
			};
		},
		listMembers: async (data) => {
			const adapter = await getCurrentAdapter(baseAdapter);
			const members = await Promise.all([adapter.findMany({
				model: "member",
				where: [{
					field: "organizationId",
					value: data.organizationId
				}, ...data.filter?.field ? [{
					field: data.filter?.field,
					value: data.filter?.value
				}] : []],
				limit: data.limit || options?.membershipLimit || 100,
				offset: data.offset || 0,
				sortBy: data.sortBy ? {
					field: data.sortBy,
					direction: data.sortOrder || "asc"
				} : void 0
			}), adapter.count({
				model: "member",
				where: [{
					field: "organizationId",
					value: data.organizationId
				}, ...data.filter?.field ? [{
					field: data.filter?.field,
					value: data.filter?.value
				}] : []]
			})]);
			const users = await adapter.findMany({
				model: "user",
				where: [{
					field: "id",
					value: members[0].map((member) => member.userId),
					operator: "in"
				}]
			});
			return {
				members: members[0].map((member) => {
					const user = users.find((user$1) => user$1.id === member.userId);
					if (!user) throw new BetterAuthError("Unexpected error: User not found for member");
					return {
						...member,
						user: {
							id: user.id,
							name: user.name,
							email: user.email,
							image: user.image
						}
					};
				}),
				total: members[1]
			};
		},
		findMemberByOrgId: async (data) => {
			const result = await (await getCurrentAdapter(baseAdapter)).findOne({
				model: "member",
				where: [{
					field: "userId",
					value: data.userId
				}, {
					field: "organizationId",
					value: data.organizationId
				}],
				join: { user: true }
			});
			if (!result || !result.user) return null;
			const { user, ...member } = result;
			return {
				...member,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image
				}
			};
		},
		findMemberById: async (memberId) => {
			const result = await (await getCurrentAdapter(baseAdapter)).findOne({
				model: "member",
				where: [{
					field: "id",
					value: memberId
				}],
				join: { user: true }
			});
			if (!result) return null;
			const { user, ...member } = result;
			return {
				...member,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image
				}
			};
		},
		createMember: async (data) => {
			return await (await getCurrentAdapter(baseAdapter)).create({
				model: "member",
				data: {
					...data,
					createdAt: /* @__PURE__ */ new Date()
				}
			});
		},
		updateMember: async (memberId, role) => {
			return await (await getCurrentAdapter(baseAdapter)).update({
				model: "member",
				where: [{
					field: "id",
					value: memberId
				}],
				update: { role }
			});
		},
		deleteMember: async ({ memberId, organizationId, userId: _userId }) => {
			const adapter = await getCurrentAdapter(baseAdapter);
			let userId;
			if (!_userId) {
				const member$1 = await adapter.findOne({
					model: "member",
					where: [{
						field: "id",
						value: memberId
					}]
				});
				if (!member$1) throw new BetterAuthError("Member not found");
				userId = member$1.userId;
			} else userId = _userId;
			const member = await adapter.delete({
				model: "member",
				where: [{
					field: "id",
					value: memberId
				}]
			});
			if (options?.teams?.enabled) {
				const teams = await adapter.findMany({
					model: "team",
					where: [{
						field: "organizationId",
						value: organizationId
					}]
				});
				await Promise.all(teams.map((team) => adapter.deleteMany({
					model: "teamMember",
					where: [{
						field: "teamId",
						value: team.id
					}, {
						field: "userId",
						value: userId
					}]
				})));
			}
			return member;
		},
		updateOrganization: async (organizationId, data) => {
			const organization$1 = await (await getCurrentAdapter(baseAdapter)).update({
				model: "organization",
				where: [{
					field: "id",
					value: organizationId
				}],
				update: {
					...data,
					metadata: typeof data.metadata === "object" ? JSON.stringify(data.metadata) : data.metadata
				}
			});
			if (!organization$1) return null;
			return {
				...organization$1,
				metadata: organization$1.metadata ? parser_default(organization$1.metadata) : void 0
			};
		},
		deleteOrganization: async (organizationId) => {
			const adapter = await getCurrentAdapter(baseAdapter);
			await adapter.deleteMany({
				model: "member",
				where: [{
					field: "organizationId",
					value: organizationId
				}]
			});
			await adapter.deleteMany({
				model: "invitation",
				where: [{
					field: "organizationId",
					value: organizationId
				}]
			});
			await adapter.delete({
				model: "organization",
				where: [{
					field: "id",
					value: organizationId
				}]
			});
			return organizationId;
		},
		setActiveOrganization: async (sessionToken, organizationId, ctx) => {
			return await context.internalAdapter.updateSession(sessionToken, { activeOrganizationId: organizationId });
		},
		findOrganizationById: async (organizationId) => {
			return await (await getCurrentAdapter(baseAdapter)).findOne({
				model: "organization",
				where: [{
					field: "id",
					value: organizationId
				}]
			});
		},
		checkMembership: async ({ userId, organizationId }) => {
			return await (await getCurrentAdapter(baseAdapter)).findOne({
				model: "member",
				where: [{
					field: "userId",
					value: userId
				}, {
					field: "organizationId",
					value: organizationId
				}]
			});
		},
		findFullOrganization: async ({ organizationId, isSlug, includeTeams, membersLimit }) => {
			const adapter = await getCurrentAdapter(baseAdapter);
			const result = await adapter.findOne({
				model: "organization",
				where: [{
					field: isSlug ? "slug" : "id",
					value: organizationId
				}],
				join: {
					invitation: true,
					member: membersLimit ? { limit: membersLimit } : true,
					...includeTeams ? { team: true } : {}
				}
			});
			if (!result) return null;
			const { invitation: invitations, member: members, team: teams, ...org } = result;
			const userIds = members.map((member) => member.userId);
			const users = userIds.length > 0 ? await adapter.findMany({
				model: "user",
				where: [{
					field: "id",
					value: userIds,
					operator: "in"
				}],
				limit: options?.membershipLimit || 100
			}) : [];
			const userMap = new Map(users.map((user) => [user.id, user]));
			const membersWithUsers = members.map((member) => {
				const user = userMap.get(member.userId);
				if (!user) throw new BetterAuthError("Unexpected error: User not found for member");
				return {
					...member,
					user: {
						id: user.id,
						name: user.name,
						email: user.email,
						image: user.image
					}
				};
			});
			return {
				...org,
				invitations,
				members: membersWithUsers,
				teams
			};
		},
		listOrganizations: async (userId) => {
			const result = await (await getCurrentAdapter(baseAdapter)).findMany({
				model: "member",
				where: [{
					field: "userId",
					value: userId
				}],
				join: { organization: true }
			});
			if (!result || result.length === 0) return [];
			return result.map((member) => member.organization);
		},
		createTeam: async (data) => {
			return await (await getCurrentAdapter(baseAdapter)).create({
				model: "team",
				data
			});
		},
		findTeamById: async ({ teamId, organizationId, includeTeamMembers }) => {
			const result = await (await getCurrentAdapter(baseAdapter)).findOne({
				model: "team",
				where: [{
					field: "id",
					value: teamId
				}, ...organizationId ? [{
					field: "organizationId",
					value: organizationId
				}] : []],
				join: { ...includeTeamMembers ? { teamMember: true } : {} }
			});
			if (!result) return null;
			const { teamMember, ...team } = result;
			return {
				...team,
				...includeTeamMembers ? { members: teamMember } : {}
			};
		},
		updateTeam: async (teamId, data) => {
			const adapter = await getCurrentAdapter(baseAdapter);
			if ("id" in data) data.id = void 0;
			return await adapter.update({
				model: "team",
				where: [{
					field: "id",
					value: teamId
				}],
				update: { ...data }
			});
		},
		deleteTeam: async (teamId) => {
			const adapter = await getCurrentAdapter(baseAdapter);
			await adapter.deleteMany({
				model: "teamMember",
				where: [{
					field: "teamId",
					value: teamId
				}]
			});
			return await adapter.delete({
				model: "team",
				where: [{
					field: "id",
					value: teamId
				}]
			});
		},
		listTeams: async (organizationId) => {
			return await (await getCurrentAdapter(baseAdapter)).findMany({
				model: "team",
				where: [{
					field: "organizationId",
					value: organizationId
				}]
			});
		},
		createTeamInvitation: async ({ email, role, teamId, organizationId, inviterId, expiresIn = 1e3 * 60 * 60 * 48 }) => {
			const adapter = await getCurrentAdapter(baseAdapter);
			const expiresAt = getDate(expiresIn);
			return await adapter.create({
				model: "invitation",
				data: {
					email,
					role,
					organizationId,
					teamId,
					inviterId,
					status: "pending",
					expiresAt
				}
			});
		},
		setActiveTeam: async (sessionToken, teamId, ctx) => {
			return await context.internalAdapter.updateSession(sessionToken, { activeTeamId: teamId });
		},
		listTeamMembers: async (data) => {
			return await (await getCurrentAdapter(baseAdapter)).findMany({
				model: "teamMember",
				where: [{
					field: "teamId",
					value: data.teamId
				}]
			});
		},
		countTeamMembers: async (data) => {
			return await (await getCurrentAdapter(baseAdapter)).count({
				model: "teamMember",
				where: [{
					field: "teamId",
					value: data.teamId
				}]
			});
		},
		countMembers: async (data) => {
			return await (await getCurrentAdapter(baseAdapter)).count({
				model: "member",
				where: [{
					field: "organizationId",
					value: data.organizationId
				}]
			});
		},
		listTeamsByUser: async (data) => {
			return (await (await getCurrentAdapter(baseAdapter)).findMany({
				model: "teamMember",
				where: [{
					field: "userId",
					value: data.userId
				}],
				join: { team: true }
			})).map((result) => result.team);
		},
		findTeamMember: async (data) => {
			return await (await getCurrentAdapter(baseAdapter)).findOne({
				model: "teamMember",
				where: [{
					field: "teamId",
					value: data.teamId
				}, {
					field: "userId",
					value: data.userId
				}]
			});
		},
		findOrCreateTeamMember: async (data) => {
			const adapter = await getCurrentAdapter(baseAdapter);
			const member = await adapter.findOne({
				model: "teamMember",
				where: [{
					field: "teamId",
					value: data.teamId
				}, {
					field: "userId",
					value: data.userId
				}]
			});
			if (member) return member;
			return await adapter.create({
				model: "teamMember",
				data: {
					teamId: data.teamId,
					userId: data.userId,
					createdAt: /* @__PURE__ */ new Date()
				}
			});
		},
		removeTeamMember: async (data) => {
			await (await getCurrentAdapter(baseAdapter)).deleteMany({
				model: "teamMember",
				where: [{
					field: "teamId",
					value: data.teamId
				}, {
					field: "userId",
					value: data.userId
				}]
			});
		},
		findInvitationsByTeamId: async (teamId) => {
			return await (await getCurrentAdapter(baseAdapter)).findMany({
				model: "invitation",
				where: [{
					field: "teamId",
					value: teamId
				}]
			});
		},
		listUserInvitations: async (email) => {
			return await (await getCurrentAdapter(baseAdapter)).findMany({
				model: "invitation",
				where: [{
					field: "email",
					value: email.toLowerCase()
				}]
			});
		},
		createInvitation: async ({ invitation, user }) => {
			const adapter = await getCurrentAdapter(baseAdapter);
			const expiresAt = getDate(options?.invitationExpiresIn || 3600 * 48, "sec");
			return await adapter.create({
				model: "invitation",
				data: {
					status: "pending",
					expiresAt,
					createdAt: /* @__PURE__ */ new Date(),
					inviterId: user.id,
					...invitation,
					teamId: invitation.teamIds.length > 0 ? invitation.teamIds.join(",") : null
				}
			});
		},
		findInvitationById: async (id) => {
			return await (await getCurrentAdapter(baseAdapter)).findOne({
				model: "invitation",
				where: [{
					field: "id",
					value: id
				}]
			});
		},
		findPendingInvitation: async (data) => {
			return (await (await getCurrentAdapter(baseAdapter)).findMany({
				model: "invitation",
				where: [
					{
						field: "email",
						value: data.email.toLowerCase()
					},
					{
						field: "organizationId",
						value: data.organizationId
					},
					{
						field: "status",
						value: "pending"
					}
				]
			})).filter((invite) => new Date(invite.expiresAt) > /* @__PURE__ */ new Date());
		},
		findPendingInvitations: async (data) => {
			return (await (await getCurrentAdapter(baseAdapter)).findMany({
				model: "invitation",
				where: [{
					field: "organizationId",
					value: data.organizationId
				}, {
					field: "status",
					value: "pending"
				}]
			})).filter((invite) => new Date(invite.expiresAt) > /* @__PURE__ */ new Date());
		},
		listInvitations: async (data) => {
			return await (await getCurrentAdapter(baseAdapter)).findMany({
				model: "invitation",
				where: [{
					field: "organizationId",
					value: data.organizationId
				}]
			});
		},
		updateInvitation: async (data) => {
			return await (await getCurrentAdapter(baseAdapter)).update({
				model: "invitation",
				where: [{
					field: "id",
					value: data.invitationId
				}],
				update: { status: data.status }
			});
		}
	};
};

//#endregion
//#region src/plugins/organization/call.ts
const orgMiddleware = createAuthMiddleware(async () => {
	return {};
});
/**
* The middleware forces the endpoint to require a valid session by utilizing the `sessionMiddleware`.
* It also appends additional types to the session type regarding organizations.
*/
const orgSessionMiddleware = createAuthMiddleware({ use: [sessionMiddleware] }, async (ctx) => {
	return { session: ctx.context.session };
});

//#endregion
//#region src/plugins/organization/error-codes.ts
const ORGANIZATION_ERROR_CODES = defineErrorCodes({
	YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION: "You are not allowed to create a new organization",
	YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: "You have reached the maximum number of organizations",
	ORGANIZATION_ALREADY_EXISTS: "Organization already exists",
	ORGANIZATION_SLUG_ALREADY_TAKEN: "Organization slug already taken",
	ORGANIZATION_NOT_FOUND: "Organization not found",
	USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: "User is not a member of the organization",
	YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION: "You are not allowed to update this organization",
	YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION: "You are not allowed to delete this organization",
	NO_ACTIVE_ORGANIZATION: "No active organization",
	USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "User is already a member of this organization",
	MEMBER_NOT_FOUND: "Member not found",
	ROLE_NOT_FOUND: "Role not found",
	YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM: "You are not allowed to create a new team",
	TEAM_ALREADY_EXISTS: "Team already exists",
	TEAM_NOT_FOUND: "Team not found",
	YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: "You cannot leave the organization as the only owner",
	YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: "You cannot leave the organization without an owner",
	YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: "You are not allowed to delete this member",
	YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: "You are not allowed to invite users to this organization",
	USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "User is already invited to this organization",
	INVITATION_NOT_FOUND: "Invitation not found",
	YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: "You are not the recipient of the invitation",
	EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: "Email verification required before accepting or rejecting invitation",
	YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION: "You are not allowed to cancel this invitation",
	INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION: "Inviter is no longer a member of the organization",
	YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE: "You are not allowed to invite a user with this role",
	FAILED_TO_RETRIEVE_INVITATION: "Failed to retrieve invitation",
	YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS: "You have reached the maximum number of teams",
	UNABLE_TO_REMOVE_LAST_TEAM: "Unable to remove last team",
	YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER: "You are not allowed to update this member",
	ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: "Organization membership limit reached",
	YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION: "You are not allowed to create teams in this organization",
	YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION: "You are not allowed to delete teams in this organization",
	YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM: "You are not allowed to update this team",
	YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM: "You are not allowed to delete this team",
	INVITATION_LIMIT_REACHED: "Invitation limit reached",
	TEAM_MEMBER_LIMIT_REACHED: "Team member limit reached",
	USER_IS_NOT_A_MEMBER_OF_THE_TEAM: "User is not a member of the team",
	YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM: "You are not allowed to list the members of this team",
	YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM: "You do not have an active team",
	YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER: "You are not allowed to create a new member",
	YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER: "You are not allowed to remove a team member",
	YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION: "You are not allowed to access this organization as an owner",
	YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION: "You are not a member of this organization",
	MISSING_AC_INSTANCE: "Dynamic Access Control requires a pre-defined ac instance on the server auth plugin. Read server logs for more information",
	YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE: "You must be in an organization to create a role",
	YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE: "You are not allowed to create a role",
	YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE: "You are not allowed to update a role",
	YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE: "You are not allowed to delete a role",
	YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE: "You are not allowed to read a role",
	YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE: "You are not allowed to list a role",
	YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE: "You are not allowed to get a role",
	TOO_MANY_ROLES: "This organization has too many roles",
	INVALID_RESOURCE: "The provided permission includes an invalid resource",
	ROLE_NAME_IS_ALREADY_TAKEN: "That role name is already taken",
	CANNOT_DELETE_A_PRE_DEFINED_ROLE: "Cannot delete a pre-defined role"
});

//#endregion
//#region src/plugins/organization/has-permission.ts
const hasPermission = async (input, ctx) => {
	let acRoles = { ...input.options.roles || defaultRoles };
	if (ctx && input.organizationId && input.options.dynamicAccessControl?.enabled && input.options.ac && !input.useMemoryCache) {
		const roles = await ctx.context.adapter.findMany({
			model: "organizationRole",
			where: [{
				field: "organizationId",
				value: input.organizationId
			}]
		});
		for (const { role, permission: permissionsString } of roles) {
			if (role in acRoles) continue;
			const result = z.record(z.string(), z.array(z.string())).safeParse(JSON.parse(permissionsString));
			if (!result.success) {
				ctx.context.logger.error("[hasPermission] Invalid permissions for role " + role, { permissions: JSON.parse(permissionsString) });
				throw new APIError$1("INTERNAL_SERVER_ERROR", { message: "Invalid permissions for role " + role });
			}
			acRoles[role] = input.options.ac.newRole(result.data);
		}
	}
	if (input.useMemoryCache) acRoles = cacheAllRoles.get(input.organizationId) || acRoles;
	cacheAllRoles.set(input.organizationId, acRoles);
	return hasPermissionFn(input, acRoles);
};

//#endregion
//#region src/plugins/organization/routes/crud-access-control.ts
const normalizeRoleName = (role) => role.toLowerCase();
const DEFAULT_MAXIMUM_ROLES_PER_ORGANIZATION = Number.POSITIVE_INFINITY;
const getAdditionalFields = (options, shouldBePartial = false) => {
	let additionalFields = options?.schema?.organizationRole?.additionalFields || {};
	if (shouldBePartial) for (const key in additionalFields) additionalFields[key].required = false;
	return {
		additionalFieldsSchema: toZodSchema({
			fields: additionalFields,
			isClientSide: true
		}),
		$AdditionalFields: {},
		$ReturnAdditionalFields: {}
	};
};
const createOrgRole = (options) => {
	const { additionalFieldsSchema, $AdditionalFields, $ReturnAdditionalFields } = getAdditionalFields(options, false);
	return createAuthEndpoint("/organization/create-role", {
		method: "POST",
		body: z.object({
			organizationId: z.string().optional().meta({ description: "The id of the organization to create the role in. If not provided, the user's active organization will be used." }),
			role: z.string().meta({ description: "The name of the role to create" }),
			permission: z.record(z.string(), z.array(z.string())).meta({ description: "The permission to assign to the role" }),
			additionalFields: z.object({ ...additionalFieldsSchema.shape }).optional()
		}),
		metadata: { $Infer: { body: {} } },
		requireHeaders: true,
		use: [orgSessionMiddleware]
	}, async (ctx) => {
		const { session, user } = ctx.context.session;
		let roleName = ctx.body.role;
		const permission = ctx.body.permission;
		const additionalFields = ctx.body.additionalFields;
		const ac = options.ac;
		if (!ac) {
			ctx.context.logger.error(`[Dynamic Access Control] The organization plugin is missing a pre-defined ac instance.`, `\nPlease refer to the documentation here: https://better-auth.com/docs/plugins/organization#dynamic-access-control`);
			throw new APIError$1("NOT_IMPLEMENTED", { message: ORGANIZATION_ERROR_CODES.MISSING_AC_INSTANCE });
		}
		const organizationId = ctx.body.organizationId ?? session.activeOrganizationId;
		if (!organizationId) {
			ctx.context.logger.error(`[Dynamic Access Control] The session is missing an active organization id to create a role. Either set an active org id, or pass an organizationId in the request body.`);
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE });
		}
		roleName = normalizeRoleName(roleName);
		await checkIfRoleNameIsTakenByPreDefinedRole({
			role: roleName,
			organizationId,
			options,
			ctx
		});
		const member = await ctx.context.adapter.findOne({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}, {
				field: "userId",
				value: user.id,
				operator: "eq",
				connector: "AND"
			}]
		});
		if (!member) {
			ctx.context.logger.error(`[Dynamic Access Control] The user is not a member of the organization to create a role.`, {
				userId: user.id,
				organizationId
			});
			throw new APIError$1("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION });
		}
		if (!await hasPermission({
			options,
			organizationId,
			permissions: { ac: ["create"] },
			role: member.role
		}, ctx)) {
			ctx.context.logger.error(`[Dynamic Access Control] The user is not permitted to create a role. If this is unexpected, please make sure the role associated to that member has the "ac" resource with the "create" permission.`, {
				userId: user.id,
				organizationId,
				role: member.role
			});
			throw new APIError$1("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE });
		}
		const maximumRolesPerOrganization = typeof options.dynamicAccessControl?.maximumRolesPerOrganization === "function" ? await options.dynamicAccessControl.maximumRolesPerOrganization(organizationId) : options.dynamicAccessControl?.maximumRolesPerOrganization ?? DEFAULT_MAXIMUM_ROLES_PER_ORGANIZATION;
		const rolesInDB = await ctx.context.adapter.count({
			model: "organizationRole",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}]
		});
		if (rolesInDB >= maximumRolesPerOrganization) {
			ctx.context.logger.error(`[Dynamic Access Control] Failed to create a new role, the organization has too many roles. Maximum allowed roles is ${maximumRolesPerOrganization}.`, {
				organizationId,
				maximumRolesPerOrganization,
				rolesInDB
			});
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.TOO_MANY_ROLES });
		}
		await checkForInvalidResources({
			ac,
			ctx,
			permission
		});
		await checkIfMemberHasPermission({
			ctx,
			member,
			options,
			organizationId,
			permissionRequired: permission,
			user,
			action: "create"
		});
		await checkIfRoleNameIsTakenByRoleInDB({
			ctx,
			organizationId,
			role: roleName
		});
		const newRole = ac.newRole(permission);
		const data = {
			...await ctx.context.adapter.create({
				model: "organizationRole",
				data: {
					createdAt: /* @__PURE__ */ new Date(),
					organizationId,
					permission: JSON.stringify(permission),
					role: roleName,
					...additionalFields
				}
			}),
			permission
		};
		return ctx.json({
			success: true,
			roleData: data,
			statements: newRole.statements
		});
	});
};
const deleteOrgRole = (options) => {
	return createAuthEndpoint("/organization/delete-role", {
		method: "POST",
		body: z.object({ organizationId: z.string().optional().meta({ description: "The id of the organization to create the role in. If not provided, the user's active organization will be used." }) }).and(z.union([z.object({ roleName: z.string().nonempty().meta({ description: "The name of the role to delete" }) }), z.object({ roleId: z.string().nonempty().meta({ description: "The id of the role to delete" }) })])),
		requireHeaders: true,
		use: [orgSessionMiddleware],
		metadata: { $Infer: { body: {} } }
	}, async (ctx) => {
		const { session, user } = ctx.context.session;
		const organizationId = ctx.body.organizationId ?? session.activeOrganizationId;
		if (!organizationId) {
			ctx.context.logger.error(`[Dynamic Access Control] The session is missing an active organization id to delete a role. Either set an active org id, or pass an organizationId in the request body.`);
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
		}
		const member = await ctx.context.adapter.findOne({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}, {
				field: "userId",
				value: user.id,
				operator: "eq",
				connector: "AND"
			}]
		});
		if (!member) {
			ctx.context.logger.error(`[Dynamic Access Control] The user is not a member of the organization to delete a role.`, {
				userId: user.id,
				organizationId
			});
			throw new APIError$1("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION });
		}
		if (!await hasPermission({
			options,
			organizationId,
			permissions: { ac: ["delete"] },
			role: member.role
		}, ctx)) {
			ctx.context.logger.error(`[Dynamic Access Control] The user is not permitted to delete a role. If this is unexpected, please make sure the role associated to that member has the "ac" resource with the "delete" permission.`, {
				userId: user.id,
				organizationId,
				role: member.role
			});
			throw new APIError$1("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE });
		}
		if (ctx.body.roleName) {
			const roleName = ctx.body.roleName;
			const defaultRoles$2 = options.roles ? Object.keys(options.roles) : [
				"owner",
				"admin",
				"member"
			];
			if (defaultRoles$2.includes(roleName)) {
				ctx.context.logger.error(`[Dynamic Access Control] Cannot delete a pre-defined role.`, {
					roleName,
					organizationId,
					defaultRoles: defaultRoles$2
				});
				throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.CANNOT_DELETE_A_PRE_DEFINED_ROLE });
			}
		}
		let condition;
		if (ctx.body.roleName) condition = {
			field: "role",
			value: ctx.body.roleName,
			operator: "eq",
			connector: "AND"
		};
		else if (ctx.body.roleId) condition = {
			field: "id",
			value: ctx.body.roleId,
			operator: "eq",
			connector: "AND"
		};
		else {
			ctx.context.logger.error(`[Dynamic Access Control] The role name/id is not provided in the request body.`);
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ROLE_NOT_FOUND });
		}
		const existingRoleInDB = await ctx.context.adapter.findOne({
			model: "organizationRole",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}, condition]
		});
		if (!existingRoleInDB) {
			ctx.context.logger.error(`[Dynamic Access Control] The role name/id does not exist in the database.`, {
				..."roleName" in ctx.body ? { roleName: ctx.body.roleName } : { roleId: ctx.body.roleId },
				organizationId
			});
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ROLE_NOT_FOUND });
		}
		existingRoleInDB.permission = JSON.parse(existingRoleInDB.permission);
		await ctx.context.adapter.delete({
			model: "organizationRole",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}, condition]
		});
		return ctx.json({ success: true });
	});
};
const listOrgRoles = (options) => {
	const { $ReturnAdditionalFields } = getAdditionalFields(options, false);
	return createAuthEndpoint("/organization/list-roles", {
		method: "GET",
		use: [orgSessionMiddleware],
		query: z.object({ organizationId: z.string().optional().meta({ description: "The id of the organization to list roles for. If not provided, the user's active organization will be used." }) }).optional()
	}, async (ctx) => {
		const { session, user } = ctx.context.session;
		const organizationId = ctx.query?.organizationId ?? session.activeOrganizationId;
		if (!organizationId) {
			ctx.context.logger.error(`[Dynamic Access Control] The session is missing an active organization id to list roles. Either set an active org id, or pass an organizationId in the request query.`);
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
		}
		const member = await ctx.context.adapter.findOne({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}, {
				field: "userId",
				value: user.id,
				operator: "eq",
				connector: "AND"
			}]
		});
		if (!member) {
			ctx.context.logger.error(`[Dynamic Access Control] The user is not a member of the organization to list roles.`, {
				userId: user.id,
				organizationId
			});
			throw new APIError$1("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION });
		}
		if (!await hasPermission({
			options,
			organizationId,
			permissions: { ac: ["read"] },
			role: member.role
		}, ctx)) {
			ctx.context.logger.error(`[Dynamic Access Control] The user is not permitted to list roles.`, {
				userId: user.id,
				organizationId,
				role: member.role
			});
			throw new APIError$1("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE });
		}
		let roles = await ctx.context.adapter.findMany({
			model: "organizationRole",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}]
		});
		roles = roles.map((x) => ({
			...x,
			permission: JSON.parse(x.permission)
		}));
		return ctx.json(roles);
	});
};
const getOrgRole = (options) => {
	const { $ReturnAdditionalFields } = getAdditionalFields(options, false);
	return createAuthEndpoint("/organization/get-role", {
		method: "GET",
		use: [orgSessionMiddleware],
		query: z.object({ organizationId: z.string().optional().meta({ description: "The id of the organization to read a role for. If not provided, the user's active organization will be used." }) }).and(z.union([z.object({ roleName: z.string().nonempty().meta({ description: "The name of the role to read" }) }), z.object({ roleId: z.string().nonempty().meta({ description: "The id of the role to read" }) })])).optional(),
		metadata: { $Infer: { query: {} } }
	}, async (ctx) => {
		const { session, user } = ctx.context.session;
		const organizationId = ctx.query?.organizationId ?? session.activeOrganizationId;
		if (!organizationId) {
			ctx.context.logger.error(`[Dynamic Access Control] The session is missing an active organization id to read a role. Either set an active org id, or pass an organizationId in the request query.`);
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
		}
		const member = await ctx.context.adapter.findOne({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}, {
				field: "userId",
				value: user.id,
				operator: "eq",
				connector: "AND"
			}]
		});
		if (!member) {
			ctx.context.logger.error(`[Dynamic Access Control] The user is not a member of the organization to read a role.`, {
				userId: user.id,
				organizationId
			});
			throw new APIError$1("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION });
		}
		if (!await hasPermission({
			options,
			organizationId,
			permissions: { ac: ["read"] },
			role: member.role
		}, ctx)) {
			ctx.context.logger.error(`[Dynamic Access Control] The user is not permitted to read a role.`, {
				userId: user.id,
				organizationId,
				role: member.role
			});
			throw new APIError$1("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE });
		}
		let condition;
		if (ctx.query.roleName) condition = {
			field: "role",
			value: ctx.query.roleName,
			operator: "eq",
			connector: "AND"
		};
		else if (ctx.query.roleId) condition = {
			field: "id",
			value: ctx.query.roleId,
			operator: "eq",
			connector: "AND"
		};
		else {
			ctx.context.logger.error(`[Dynamic Access Control] The role name/id is not provided in the request query.`);
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ROLE_NOT_FOUND });
		}
		let role = await ctx.context.adapter.findOne({
			model: "organizationRole",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}, condition]
		});
		if (!role) {
			ctx.context.logger.error(`[Dynamic Access Control] The role name/id does not exist in the database.`, {
				..."roleName" in ctx.query ? { roleName: ctx.query.roleName } : { roleId: ctx.query.roleId },
				organizationId
			});
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ROLE_NOT_FOUND });
		}
		role.permission = JSON.parse(role.permission);
		return ctx.json(role);
	});
};
const updateOrgRole = (options) => {
	const { additionalFieldsSchema, $AdditionalFields, $ReturnAdditionalFields } = getAdditionalFields(options, true);
	return createAuthEndpoint("/organization/update-role", {
		method: "POST",
		body: z.object({
			organizationId: z.string().optional().meta({ description: "The id of the organization to update the role in. If not provided, the user's active organization will be used." }),
			data: z.object({
				permission: z.record(z.string(), z.array(z.string())).optional().meta({ description: "The permission to update the role with" }),
				roleName: z.string().optional().meta({ description: "The name of the role to update" }),
				...additionalFieldsSchema.shape
			})
		}).and(z.union([z.object({ roleName: z.string().nonempty().meta({ description: "The name of the role to update" }) }), z.object({ roleId: z.string().nonempty().meta({ description: "The id of the role to update" }) })])),
		metadata: { $Infer: { body: {} } },
		use: [orgSessionMiddleware]
	}, async (ctx) => {
		const { session, user } = ctx.context.session;
		const ac = options.ac;
		if (!ac) {
			ctx.context.logger.error(`[Dynamic Access Control] The organization plugin is missing a pre-defined ac instance.`, `\nPlease refer to the documentation here: https://better-auth.com/docs/plugins/organization#dynamic-access-control`);
			throw new APIError$1("NOT_IMPLEMENTED", { message: ORGANIZATION_ERROR_CODES.MISSING_AC_INSTANCE });
		}
		const organizationId = ctx.body.organizationId ?? session.activeOrganizationId;
		if (!organizationId) {
			ctx.context.logger.error(`[Dynamic Access Control] The session is missing an active organization id to update a role. Either set an active org id, or pass an organizationId in the request body.`);
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
		}
		const member = await ctx.context.adapter.findOne({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}, {
				field: "userId",
				value: user.id,
				operator: "eq",
				connector: "AND"
			}]
		});
		if (!member) {
			ctx.context.logger.error(`[Dynamic Access Control] The user is not a member of the organization to update a role.`, {
				userId: user.id,
				organizationId
			});
			throw new APIError$1("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION });
		}
		if (!await hasPermission({
			options,
			organizationId,
			role: member.role,
			permissions: { ac: ["update"] }
		}, ctx)) {
			ctx.context.logger.error(`[Dynamic Access Control] The user is not permitted to update a role.`);
			throw new APIError$1("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE });
		}
		let condition;
		if (ctx.body.roleName) condition = {
			field: "role",
			value: ctx.body.roleName,
			operator: "eq",
			connector: "AND"
		};
		else if (ctx.body.roleId) condition = {
			field: "id",
			value: ctx.body.roleId,
			operator: "eq",
			connector: "AND"
		};
		else {
			ctx.context.logger.error(`[Dynamic Access Control] The role name/id is not provided in the request body.`);
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ROLE_NOT_FOUND });
		}
		let role = await ctx.context.adapter.findOne({
			model: "organizationRole",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}, condition]
		});
		if (!role) {
			ctx.context.logger.error(`[Dynamic Access Control] The role name/id does not exist in the database.`, {
				..."roleName" in ctx.body ? { roleName: ctx.body.roleName } : { roleId: ctx.body.roleId },
				organizationId
			});
			throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ROLE_NOT_FOUND });
		}
		role.permission = role.permission ? JSON.parse(role.permission) : void 0;
		const { permission: _, roleName: __, ...additionalFields } = ctx.body.data;
		let updateData = { ...additionalFields };
		if (ctx.body.data.permission) {
			let newPermission = ctx.body.data.permission;
			await checkForInvalidResources({
				ac,
				ctx,
				permission: newPermission
			});
			await checkIfMemberHasPermission({
				ctx,
				member,
				options,
				organizationId,
				permissionRequired: newPermission,
				user,
				action: "update"
			});
			updateData.permission = newPermission;
		}
		if (ctx.body.data.roleName) {
			let newRoleName = ctx.body.data.roleName;
			newRoleName = normalizeRoleName(newRoleName);
			await checkIfRoleNameIsTakenByPreDefinedRole({
				role: newRoleName,
				organizationId,
				options,
				ctx
			});
			await checkIfRoleNameIsTakenByRoleInDB({
				role: newRoleName,
				organizationId,
				ctx
			});
			updateData.role = newRoleName;
		}
		const update = {
			...updateData,
			...updateData.permission ? { permission: JSON.stringify(updateData.permission) } : {}
		};
		await ctx.context.adapter.update({
			model: "organizationRole",
			where: [{
				field: "organizationId",
				value: organizationId,
				operator: "eq",
				connector: "AND"
			}, condition],
			update
		});
		return ctx.json({
			success: true,
			roleData: {
				...role,
				...update,
				permission: updateData.permission || role.permission || null
			}
		});
	});
};
async function checkForInvalidResources({ ac, ctx, permission }) {
	const validResources = Object.keys(ac.statements);
	const providedResources = Object.keys(permission);
	if (providedResources.some((r) => !validResources.includes(r))) {
		ctx.context.logger.error(`[Dynamic Access Control] The provided permission includes an invalid resource.`, {
			providedResources,
			validResources
		});
		throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.INVALID_RESOURCE });
	}
}
async function checkIfMemberHasPermission({ ctx, permissionRequired: permission, options, organizationId, member, user, action }) {
	const hasNecessaryPermissions = [];
	const permissionEntries = Object.entries(permission);
	for await (const [resource, permissions] of permissionEntries) for await (const perm of permissions) hasNecessaryPermissions.push({
		resource: { [resource]: [perm] },
		hasPermission: await hasPermission({
			options,
			organizationId,
			permissions: { [resource]: [perm] },
			useMemoryCache: true,
			role: member.role
		}, ctx)
	});
	const missingPermissions = hasNecessaryPermissions.filter((x) => x.hasPermission === false).map((x) => {
		const key = Object.keys(x.resource)[0];
		return `${key}:${x.resource[key][0]}`;
	});
	if (missingPermissions.length > 0) {
		ctx.context.logger.error(`[Dynamic Access Control] The user is missing permissions nessesary to ${action} a role with those set of permissions.\n`, {
			userId: user.id,
			organizationId,
			role: member.role,
			missingPermissions
		});
		let errorMessage;
		if (action === "create") errorMessage = ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE;
		else if (action === "update") errorMessage = ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE;
		else if (action === "delete") errorMessage = ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE;
		else if (action === "read") errorMessage = ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE;
		else if (action === "list") errorMessage = ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE;
		else errorMessage = ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE;
		throw new APIError$1("FORBIDDEN", {
			message: errorMessage,
			missingPermissions
		});
	}
}
async function checkIfRoleNameIsTakenByPreDefinedRole({ options, organizationId, role, ctx }) {
	const defaultRoles$2 = options.roles ? Object.keys(options.roles) : [
		"owner",
		"admin",
		"member"
	];
	if (defaultRoles$2.includes(role)) {
		ctx.context.logger.error(`[Dynamic Access Control] The role name "${role}" is already taken by a pre-defined role.`, {
			role,
			organizationId,
			defaultRoles: defaultRoles$2
		});
		throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ROLE_NAME_IS_ALREADY_TAKEN });
	}
}
async function checkIfRoleNameIsTakenByRoleInDB({ organizationId, role, ctx }) {
	if (await ctx.context.adapter.findOne({
		model: "organizationRole",
		where: [{
			field: "organizationId",
			value: organizationId,
			operator: "eq",
			connector: "AND"
		}, {
			field: "role",
			value: role,
			operator: "eq",
			connector: "AND"
		}]
	})) {
		ctx.context.logger.error(`[Dynamic Access Control] The role name "${role}" is already taken by a role in the database.`, {
			role,
			organizationId
		});
		throw new APIError$1("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ROLE_NAME_IS_ALREADY_TAKEN });
	}
}

//#endregion
//#region src/plugins/organization/routes/crud-invites.ts
const createInvitation = (option) => {
	const additionalFieldsSchema = toZodSchema({
		fields: option?.schema?.invitation?.additionalFields || {},
		isClientSide: true
	});
	const baseSchema = z.object({
		email: z.string().meta({ description: "The email address of the user to invite" }),
		role: z.union([z.string().meta({ description: "The role to assign to the user" }), z.array(z.string().meta({ description: "The roles to assign to the user" }))]).meta({ description: "The role(s) to assign to the user. It can be `admin`, `member`, owner. Eg: \"member\"" }),
		organizationId: z.string().meta({ description: "The organization ID to invite the user to" }).optional(),
		resend: z.boolean().meta({ description: "Resend the invitation email, if the user is already invited. Eg: true" }).optional(),
		teamId: z.union([z.string().meta({ description: "The team ID to invite the user to" }).optional(), z.array(z.string()).meta({ description: "The team IDs to invite the user to" }).optional()])
	});
	return createAuthEndpoint("/organization/invite-member", {
		method: "POST",
		use: [orgMiddleware, orgSessionMiddleware],
		body: z.object({
			...baseSchema.shape,
			...additionalFieldsSchema.shape
		}),
		metadata: {
			$Infer: { body: {} },
			openapi: {
				operationId: "createOrganizationInvitation",
				description: "Create an invitation to an organization",
				responses: { "200": {
					description: "Success",
					content: { "application/json": { schema: {
						type: "object",
						properties: {
							id: { type: "string" },
							email: { type: "string" },
							role: { type: "string" },
							organizationId: { type: "string" },
							inviterId: { type: "string" },
							status: { type: "string" },
							expiresAt: { type: "string" },
							createdAt: { type: "string" }
						},
						required: [
							"id",
							"email",
							"role",
							"organizationId",
							"inviterId",
							"status",
							"expiresAt",
							"createdAt"
						]
					} } }
				} }
			}
		}
	}, async (ctx) => {
		const session = ctx.context.session;
		const organizationId = ctx.body.organizationId || session.session.activeOrganizationId;
		if (!organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
		const email = ctx.body.email.toLowerCase();
		if (!z.email().safeParse(email).success) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_EMAIL });
		const adapter = getOrgAdapter(ctx.context, option);
		const member = await adapter.findMemberByOrgId({
			userId: session.user.id,
			organizationId
		});
		if (!member) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND });
		if (!await hasPermission({
			role: member.role,
			options: ctx.context.orgOptions,
			permissions: { invitation: ["create"] },
			organizationId
		}, ctx)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION });
		const creatorRole = ctx.context.orgOptions.creatorRole || "owner";
		const roles = parseRoles(ctx.body.role);
		if (member.role !== creatorRole && roles.split(",").includes(creatorRole)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE });
		if (await adapter.findMemberByEmail({
			email,
			organizationId
		})) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION });
		const alreadyInvited = await adapter.findPendingInvitation({
			email,
			organizationId
		});
		if (alreadyInvited.length && !ctx.body.resend) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION });
		const organization$1 = await adapter.findOrganizationById(organizationId);
		if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
		if (alreadyInvited.length && ctx.body.resend) {
			const existingInvitation = alreadyInvited[0];
			const newExpiresAt = getDate(ctx.context.orgOptions.invitationExpiresIn || 3600 * 48, "sec");
			await ctx.context.adapter.update({
				model: "invitation",
				where: [{
					field: "id",
					value: existingInvitation.id
				}],
				update: { expiresAt: newExpiresAt }
			});
			const updatedInvitation = {
				...existingInvitation,
				expiresAt: newExpiresAt
			};
			await ctx.context.orgOptions.sendInvitationEmail?.({
				id: updatedInvitation.id,
				role: updatedInvitation.role,
				email: updatedInvitation.email.toLowerCase(),
				organization: organization$1,
				inviter: {
					...member,
					user: session.user
				},
				invitation: updatedInvitation
			}, ctx.request);
			return ctx.json(updatedInvitation);
		}
		if (alreadyInvited.length && ctx.context.orgOptions.cancelPendingInvitationsOnReInvite) await adapter.updateInvitation({
			invitationId: alreadyInvited[0].id,
			status: "canceled"
		});
		const invitationLimit = typeof ctx.context.orgOptions.invitationLimit === "function" ? await ctx.context.orgOptions.invitationLimit({
			user: session.user,
			organization: organization$1,
			member
		}, ctx.context) : ctx.context.orgOptions.invitationLimit ?? 100;
		if ((await adapter.findPendingInvitations({ organizationId })).length >= invitationLimit) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.INVITATION_LIMIT_REACHED });
		if (ctx.context.orgOptions.teams && ctx.context.orgOptions.teams.enabled && typeof ctx.context.orgOptions.teams.maximumMembersPerTeam !== "undefined" && "teamId" in ctx.body && ctx.body.teamId) {
			const teamIds$1 = typeof ctx.body.teamId === "string" ? [ctx.body.teamId] : ctx.body.teamId;
			for (const teamId of teamIds$1) {
				const team = await adapter.findTeamById({
					teamId,
					organizationId,
					includeTeamMembers: true
				});
				if (!team) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND });
				const maximumMembersPerTeam = typeof ctx.context.orgOptions.teams.maximumMembersPerTeam === "function" ? await ctx.context.orgOptions.teams.maximumMembersPerTeam({
					teamId,
					session,
					organizationId
				}) : ctx.context.orgOptions.teams.maximumMembersPerTeam;
				if (team.members.length >= maximumMembersPerTeam) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.TEAM_MEMBER_LIMIT_REACHED });
			}
		}
		const teamIds = "teamId" in ctx.body ? typeof ctx.body.teamId === "string" ? [ctx.body.teamId] : ctx.body.teamId ?? [] : [];
		const { email: _, role: __, organizationId: ___, resend: ____, ...additionalFields } = ctx.body;
		let invitationData = {
			role: roles,
			email,
			organizationId,
			teamIds,
			...additionalFields ? additionalFields : {}
		};
		if (option?.organizationHooks?.beforeCreateInvitation) {
			const response = await option?.organizationHooks.beforeCreateInvitation({
				invitation: {
					...invitationData,
					inviterId: session.user.id,
					teamId: teamIds.length > 0 ? teamIds[0] : void 0
				},
				inviter: session.user,
				organization: organization$1
			});
			if (response && typeof response === "object" && "data" in response) invitationData = {
				...invitationData,
				...response.data
			};
		}
		const invitation = await adapter.createInvitation({
			invitation: invitationData,
			user: session.user
		});
		await ctx.context.orgOptions.sendInvitationEmail?.({
			id: invitation.id,
			role: invitation.role,
			email: invitation.email.toLowerCase(),
			organization: organization$1,
			inviter: {
				...member,
				user: session.user
			},
			invitation
		}, ctx.request);
		if (option?.organizationHooks?.afterCreateInvitation) await option?.organizationHooks.afterCreateInvitation({
			invitation,
			inviter: session.user,
			organization: organization$1
		});
		return ctx.json(invitation);
	});
};
const acceptInvitation = (options) => createAuthEndpoint("/organization/accept-invitation", {
	method: "POST",
	body: z.object({ invitationId: z.string().meta({ description: "The ID of the invitation to accept" }) }),
	use: [orgMiddleware, orgSessionMiddleware],
	metadata: { openapi: {
		description: "Accept an invitation to an organization",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					invitation: { type: "object" },
					member: { type: "object" }
				}
			} } }
		} }
	} }
}, async (ctx) => {
	const session = ctx.context.session;
	const adapter = getOrgAdapter(ctx.context, options);
	const invitation = await adapter.findInvitationById(ctx.body.invitationId);
	if (!invitation || invitation.expiresAt < /* @__PURE__ */ new Date() || invitation.status !== "pending") throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.INVITATION_NOT_FOUND });
	if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION });
	if (ctx.context.orgOptions.requireEmailVerificationOnInvitation && !session.user.emailVerified) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION });
	const membershipLimit = ctx.context.orgOptions?.membershipLimit || 100;
	if (await adapter.countMembers({ organizationId: invitation.organizationId }) >= membershipLimit) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_MEMBERSHIP_LIMIT_REACHED });
	const organization$1 = await adapter.findOrganizationById(invitation.organizationId);
	if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
	if (options?.organizationHooks?.beforeAcceptInvitation) await options?.organizationHooks.beforeAcceptInvitation({
		invitation,
		user: session.user,
		organization: organization$1
	});
	const acceptedI = await adapter.updateInvitation({
		invitationId: ctx.body.invitationId,
		status: "accepted"
	});
	if (!acceptedI) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.FAILED_TO_RETRIEVE_INVITATION });
	if (ctx.context.orgOptions.teams && ctx.context.orgOptions.teams.enabled && "teamId" in acceptedI && acceptedI.teamId) {
		const teamIds = acceptedI.teamId.split(",");
		const onlyOne = teamIds.length === 1;
		for (const teamId of teamIds) {
			await adapter.findOrCreateTeamMember({
				teamId,
				userId: session.user.id
			});
			if (typeof ctx.context.orgOptions.teams.maximumMembersPerTeam !== "undefined") {
				if (await adapter.countTeamMembers({ teamId }) >= (typeof ctx.context.orgOptions.teams.maximumMembersPerTeam === "function" ? await ctx.context.orgOptions.teams.maximumMembersPerTeam({
					teamId,
					session,
					organizationId: invitation.organizationId
				}) : ctx.context.orgOptions.teams.maximumMembersPerTeam)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.TEAM_MEMBER_LIMIT_REACHED });
			}
		}
		if (onlyOne) {
			const teamId = teamIds[0];
			await setSessionCookie(ctx, {
				session: await adapter.setActiveTeam(session.session.token, teamId, ctx),
				user: session.user
			});
		}
	}
	const member = await adapter.createMember({
		organizationId: invitation.organizationId,
		userId: session.user.id,
		role: invitation.role,
		createdAt: /* @__PURE__ */ new Date()
	});
	await adapter.setActiveOrganization(session.session.token, invitation.organizationId, ctx);
	if (!acceptedI) return ctx.json(null, {
		status: 400,
		body: { message: ORGANIZATION_ERROR_CODES.INVITATION_NOT_FOUND }
	});
	if (options?.organizationHooks?.afterAcceptInvitation) await options?.organizationHooks.afterAcceptInvitation({
		invitation: acceptedI,
		member,
		user: session.user,
		organization: organization$1
	});
	return ctx.json({
		invitation: acceptedI,
		member
	});
});
const rejectInvitation = (options) => createAuthEndpoint("/organization/reject-invitation", {
	method: "POST",
	body: z.object({ invitationId: z.string().meta({ description: "The ID of the invitation to reject" }) }),
	use: [orgMiddleware, orgSessionMiddleware],
	metadata: { openapi: {
		description: "Reject an invitation to an organization",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					invitation: { type: "object" },
					member: {
						type: "object",
						nullable: true
					}
				}
			} } }
		} }
	} }
}, async (ctx) => {
	const session = ctx.context.session;
	const adapter = getOrgAdapter(ctx.context, ctx.context.orgOptions);
	const invitation = await adapter.findInvitationById(ctx.body.invitationId);
	if (!invitation || invitation.expiresAt < /* @__PURE__ */ new Date() || invitation.status !== "pending") throw new APIError("BAD_REQUEST", { message: "Invitation not found!" });
	if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION });
	if (ctx.context.orgOptions.requireEmailVerificationOnInvitation && !session.user.emailVerified) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION });
	const organization$1 = await adapter.findOrganizationById(invitation.organizationId);
	if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
	if (options?.organizationHooks?.beforeRejectInvitation) await options?.organizationHooks.beforeRejectInvitation({
		invitation,
		user: session.user,
		organization: organization$1
	});
	const rejectedI = await adapter.updateInvitation({
		invitationId: ctx.body.invitationId,
		status: "rejected"
	});
	if (options?.organizationHooks?.afterRejectInvitation) await options?.organizationHooks.afterRejectInvitation({
		invitation: rejectedI || invitation,
		user: session.user,
		organization: organization$1
	});
	return ctx.json({
		invitation: rejectedI,
		member: null
	});
});
const cancelInvitation = (options) => createAuthEndpoint("/organization/cancel-invitation", {
	method: "POST",
	body: z.object({ invitationId: z.string().meta({ description: "The ID of the invitation to cancel" }) }),
	use: [orgMiddleware, orgSessionMiddleware],
	openapi: {
		operationId: "cancelOrganizationInvitation",
		description: "Cancel an invitation to an organization",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: { invitation: { type: "object" } }
			} } }
		} }
	}
}, async (ctx) => {
	const session = ctx.context.session;
	const adapter = getOrgAdapter(ctx.context, options);
	const invitation = await adapter.findInvitationById(ctx.body.invitationId);
	if (!invitation) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.INVITATION_NOT_FOUND });
	const member = await adapter.findMemberByOrgId({
		userId: session.user.id,
		organizationId: invitation.organizationId
	});
	if (!member) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND });
	if (!await hasPermission({
		role: member.role,
		options: ctx.context.orgOptions,
		permissions: { invitation: ["cancel"] },
		organizationId: invitation.organizationId
	}, ctx)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION });
	const organization$1 = await adapter.findOrganizationById(invitation.organizationId);
	if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
	if (options?.organizationHooks?.beforeCancelInvitation) await options?.organizationHooks.beforeCancelInvitation({
		invitation,
		cancelledBy: session.user,
		organization: organization$1
	});
	const canceledI = await adapter.updateInvitation({
		invitationId: ctx.body.invitationId,
		status: "canceled"
	});
	if (options?.organizationHooks?.afterCancelInvitation) await options?.organizationHooks.afterCancelInvitation({
		invitation: canceledI || invitation,
		cancelledBy: session.user,
		organization: organization$1
	});
	return ctx.json(canceledI);
});
const getInvitation = (options) => createAuthEndpoint("/organization/get-invitation", {
	method: "GET",
	use: [orgMiddleware],
	requireHeaders: true,
	query: z.object({ id: z.string().meta({ description: "The ID of the invitation to get" }) }),
	metadata: { openapi: {
		description: "Get an invitation by ID",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					id: { type: "string" },
					email: { type: "string" },
					role: { type: "string" },
					organizationId: { type: "string" },
					inviterId: { type: "string" },
					status: { type: "string" },
					expiresAt: { type: "string" },
					organizationName: { type: "string" },
					organizationSlug: { type: "string" },
					inviterEmail: { type: "string" }
				},
				required: [
					"id",
					"email",
					"role",
					"organizationId",
					"inviterId",
					"status",
					"expiresAt",
					"organizationName",
					"organizationSlug",
					"inviterEmail"
				]
			} } }
		} }
	} }
}, async (ctx) => {
	const session = await getSessionFromCtx(ctx);
	if (!session) throw new APIError("UNAUTHORIZED", { message: "Not authenticated" });
	const adapter = getOrgAdapter(ctx.context, options);
	const invitation = await adapter.findInvitationById(ctx.query.id);
	if (!invitation || invitation.status !== "pending" || invitation.expiresAt < /* @__PURE__ */ new Date()) throw new APIError("BAD_REQUEST", { message: "Invitation not found!" });
	if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION });
	const organization$1 = await adapter.findOrganizationById(invitation.organizationId);
	if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
	const member = await adapter.findMemberByOrgId({
		userId: invitation.inviterId,
		organizationId: invitation.organizationId
	});
	if (!member) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION });
	return ctx.json({
		...invitation,
		organizationName: organization$1.name,
		organizationSlug: organization$1.slug,
		inviterEmail: member.user.email
	});
});
const listInvitations = (options) => createAuthEndpoint("/organization/list-invitations", {
	method: "GET",
	use: [orgMiddleware, orgSessionMiddleware],
	query: z.object({ organizationId: z.string().meta({ description: "The ID of the organization to list invitations for" }).optional() }).optional()
}, async (ctx) => {
	const session = await getSessionFromCtx(ctx);
	if (!session) throw new APIError("UNAUTHORIZED", { message: "Not authenticated" });
	const orgId = ctx.query?.organizationId || session.session.activeOrganizationId;
	if (!orgId) throw new APIError("BAD_REQUEST", { message: "Organization ID is required" });
	const adapter = getOrgAdapter(ctx.context, options);
	if (!await adapter.findMemberByOrgId({
		userId: session.user.id,
		organizationId: orgId
	})) throw new APIError("FORBIDDEN", { message: "You are not a member of this organization" });
	const invitations = await adapter.listInvitations({ organizationId: orgId });
	return ctx.json(invitations);
});
/**
* List all invitations a user has received
*/
const listUserInvitations = (options) => createAuthEndpoint("/organization/list-user-invitations", {
	method: "GET",
	use: [orgMiddleware],
	query: z.object({ email: z.string().meta({ description: "The email of the user to list invitations for. This only works for server side API calls." }).optional() }).optional()
}, async (ctx) => {
	const session = await getSessionFromCtx(ctx);
	if (ctx.request && ctx.query?.email) throw new APIError("BAD_REQUEST", { message: "User email cannot be passed for client side API calls." });
	const userEmail = session?.user.email || ctx.query?.email;
	if (!userEmail) throw new APIError("BAD_REQUEST", { message: "Missing session headers, or email query parameter." });
	const invitations = await getOrgAdapter(ctx.context, options).listUserInvitations(userEmail);
	return ctx.json(invitations);
});

//#endregion
//#region src/plugins/organization/routes/crud-members.ts
const addMember = (option) => {
	const additionalFieldsSchema = toZodSchema({
		fields: option?.schema?.member?.additionalFields || {},
		isClientSide: true
	});
	const baseSchema = z.object({
		userId: z.coerce.string().meta({ description: "The user Id which represents the user to be added as a member. If `null` is provided, then it's expected to provide session headers. Eg: \"user-id\"" }),
		role: z.union([z.string(), z.array(z.string())]).meta({ description: "The role(s) to assign to the new member. Eg: [\"admin\", \"sale\"]" }),
		organizationId: z.string().meta({ description: "An optional organization ID to pass. If not provided, will default to the user's active organization. Eg: \"org-id\"" }).optional(),
		teamId: z.string().meta({ description: "An optional team ID to add the member to. Eg: \"team-id\"" }).optional()
	});
	return createAuthEndpoint("/organization/add-member", {
		method: "POST",
		body: z.object({
			...baseSchema.shape,
			...additionalFieldsSchema.shape
		}),
		use: [orgMiddleware],
		metadata: {
			SERVER_ONLY: true,
			$Infer: { body: {} },
			openapi: {
				operationId: "addOrganizationMember",
				description: "Add a member to an organization"
			}
		}
	}, async (ctx) => {
		const session = ctx.body.userId ? await getSessionFromCtx(ctx).catch((e) => null) : null;
		const orgId = ctx.body.organizationId || session?.session.activeOrganizationId;
		if (!orgId) return ctx.json(null, {
			status: 400,
			body: { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION }
		});
		const teamId = "teamId" in ctx.body ? ctx.body.teamId : void 0;
		if (teamId && !ctx.context.orgOptions.teams?.enabled) {
			ctx.context.logger.error("Teams are not enabled");
			throw new APIError("BAD_REQUEST", { message: "Teams are not enabled" });
		}
		const adapter = getOrgAdapter(ctx.context, option);
		const user = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
		if (!user) throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.USER_NOT_FOUND });
		if (await adapter.findMemberByEmail({
			email: user.email,
			organizationId: orgId
		})) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION });
		if (teamId) {
			const team = await adapter.findTeamById({
				teamId,
				organizationId: orgId
			});
			if (!team || team.organizationId !== orgId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND });
		}
		const membershipLimit = ctx.context.orgOptions?.membershipLimit || 100;
		if (await adapter.countMembers({ organizationId: orgId }) >= membershipLimit) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_MEMBERSHIP_LIMIT_REACHED });
		const { role: _, userId: __, organizationId: ___, ...additionalFields } = ctx.body;
		const organization$1 = await adapter.findOrganizationById(orgId);
		if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
		let memberData = {
			organizationId: orgId,
			userId: user.id,
			role: parseRoles(ctx.body.role),
			createdAt: /* @__PURE__ */ new Date(),
			...additionalFields ? additionalFields : {}
		};
		if (option?.organizationHooks?.beforeAddMember) {
			const response = await option?.organizationHooks.beforeAddMember({
				member: {
					userId: user.id,
					organizationId: orgId,
					role: parseRoles(ctx.body.role),
					...additionalFields
				},
				user,
				organization: organization$1
			});
			if (response && typeof response === "object" && "data" in response) memberData = {
				...memberData,
				...response.data
			};
		}
		const createdMember = await adapter.createMember(memberData);
		if (teamId) await adapter.findOrCreateTeamMember({
			userId: user.id,
			teamId
		});
		if (option?.organizationHooks?.afterAddMember) await option?.organizationHooks.afterAddMember({
			member: createdMember,
			user,
			organization: organization$1
		});
		return ctx.json(createdMember);
	});
};
const removeMember = (options) => createAuthEndpoint("/organization/remove-member", {
	method: "POST",
	body: z.object({
		memberIdOrEmail: z.string().meta({ description: "The ID or email of the member to remove" }),
		organizationId: z.string().meta({ description: "The ID of the organization to remove the member from. If not provided, the active organization will be used. Eg: \"org-id\"" }).optional()
	}),
	use: [orgMiddleware, orgSessionMiddleware],
	metadata: { openapi: {
		description: "Remove a member from an organization",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: { member: {
					type: "object",
					properties: {
						id: { type: "string" },
						userId: { type: "string" },
						organizationId: { type: "string" },
						role: { type: "string" }
					},
					required: [
						"id",
						"userId",
						"organizationId",
						"role"
					]
				} },
				required: ["member"]
			} } }
		} }
	} }
}, async (ctx) => {
	const session = ctx.context.session;
	const organizationId = ctx.body.organizationId || session.session.activeOrganizationId;
	if (!organizationId) return ctx.json(null, {
		status: 400,
		body: { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION }
	});
	const adapter = getOrgAdapter(ctx.context, options);
	const member = await adapter.findMemberByOrgId({
		userId: session.user.id,
		organizationId
	});
	if (!member) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND });
	let toBeRemovedMember = null;
	if (ctx.body.memberIdOrEmail.includes("@")) toBeRemovedMember = await adapter.findMemberByEmail({
		email: ctx.body.memberIdOrEmail,
		organizationId
	});
	else {
		const result = await adapter.findMemberById(ctx.body.memberIdOrEmail);
		if (!result) toBeRemovedMember = null;
		else {
			const { user: _user, ...member$1 } = result;
			toBeRemovedMember = member$1;
		}
	}
	if (!toBeRemovedMember) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND });
	const roles = toBeRemovedMember.role.split(",");
	const creatorRole = ctx.context.orgOptions?.creatorRole || "owner";
	if (roles.includes(creatorRole)) {
		if (member.role !== creatorRole) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER });
		const { members } = await adapter.listMembers({ organizationId });
		if (members.filter((member$1) => {
			return member$1.role.split(",").includes(creatorRole);
		}).length <= 1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER });
	}
	if (!await hasPermission({
		role: member.role,
		options: ctx.context.orgOptions,
		permissions: { member: ["delete"] },
		organizationId
	}, ctx)) throw new APIError("UNAUTHORIZED", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER });
	if (toBeRemovedMember?.organizationId !== organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND });
	const organization$1 = await adapter.findOrganizationById(organizationId);
	if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
	const userBeingRemoved = await ctx.context.internalAdapter.findUserById(toBeRemovedMember.userId);
	if (!userBeingRemoved) throw new APIError("BAD_REQUEST", { message: "User not found" });
	if (options?.organizationHooks?.beforeRemoveMember) await options?.organizationHooks.beforeRemoveMember({
		member: toBeRemovedMember,
		user: userBeingRemoved,
		organization: organization$1
	});
	await adapter.deleteMember({
		memberId: toBeRemovedMember.id,
		organizationId,
		userId: toBeRemovedMember.userId
	});
	if (session.user.id === toBeRemovedMember.userId && session.session.activeOrganizationId === toBeRemovedMember.organizationId) await adapter.setActiveOrganization(session.session.token, null, ctx);
	if (options?.organizationHooks?.afterRemoveMember) await options?.organizationHooks.afterRemoveMember({
		member: toBeRemovedMember,
		user: userBeingRemoved,
		organization: organization$1
	});
	return ctx.json({ member: toBeRemovedMember });
});
const updateMemberRole = (option) => createAuthEndpoint("/organization/update-member-role", {
	method: "POST",
	body: z.object({
		role: z.union([z.string(), z.array(z.string())]).meta({ description: "The new role to be applied. This can be a string or array of strings representing the roles. Eg: [\"admin\", \"sale\"]" }),
		memberId: z.string().meta({ description: "The member id to apply the role update to. Eg: \"member-id\"" }),
		organizationId: z.string().meta({ description: "An optional organization ID which the member is a part of to apply the role update. If not provided, you must provide session headers to get the active organization. Eg: \"organization-id\"" }).optional()
	}),
	use: [orgMiddleware, orgSessionMiddleware],
	metadata: {
		$Infer: { body: {} },
		openapi: {
			operationId: "updateOrganizationMemberRole",
			description: "Update the role of a member in an organization",
			responses: { "200": {
				description: "Success",
				content: { "application/json": { schema: {
					type: "object",
					properties: { member: {
						type: "object",
						properties: {
							id: { type: "string" },
							userId: { type: "string" },
							organizationId: { type: "string" },
							role: { type: "string" }
						},
						required: [
							"id",
							"userId",
							"organizationId",
							"role"
						]
					} },
					required: ["member"]
				} } }
			} }
		}
	}
}, async (ctx) => {
	const session = ctx.context.session;
	if (!ctx.body.role) throw new APIError("BAD_REQUEST");
	const organizationId = ctx.body.organizationId || session.session.activeOrganizationId;
	if (!organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
	const adapter = getOrgAdapter(ctx.context, ctx.context.orgOptions);
	const roleToSet = Array.isArray(ctx.body.role) ? ctx.body.role : ctx.body.role ? [ctx.body.role] : [];
	const member = await adapter.findMemberByOrgId({
		userId: session.user.id,
		organizationId
	});
	if (!member) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND });
	const toBeUpdatedMember = member.id !== ctx.body.memberId ? await adapter.findMemberById(ctx.body.memberId) : member;
	if (!toBeUpdatedMember) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND });
	if (!(toBeUpdatedMember.organizationId === organizationId)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER });
	const creatorRole = ctx.context.orgOptions?.creatorRole || "owner";
	const updatingMemberRoles = member.role.split(",");
	const isUpdatingCreator = toBeUpdatedMember.role.split(",").includes(creatorRole);
	const updaterIsCreator = updatingMemberRoles.includes(creatorRole);
	const isSettingCreatorRole = roleToSet.includes(creatorRole);
	const memberIsUpdatingThemselves = member.id === toBeUpdatedMember.id;
	if (isUpdatingCreator && !updaterIsCreator || isSettingCreatorRole && !updaterIsCreator) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER });
	if (updaterIsCreator && memberIsUpdatingThemselves) {
		if ((await ctx.context.adapter.findMany({
			model: "member",
			where: [{
				field: "organizationId",
				value: organizationId
			}]
		})).filter((member$1) => {
			return member$1.role.split(",").includes(creatorRole);
		}).length <= 1 && !isSettingCreatorRole) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER });
	}
	if (!await hasPermission({
		role: member.role,
		options: ctx.context.orgOptions,
		permissions: { member: ["update"] },
		allowCreatorAllPermissions: true,
		organizationId
	}, ctx)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER });
	const organization$1 = await adapter.findOrganizationById(organizationId);
	if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
	const userBeingUpdated = await ctx.context.internalAdapter.findUserById(toBeUpdatedMember.userId);
	if (!userBeingUpdated) throw new APIError("BAD_REQUEST", { message: "User not found" });
	const previousRole = toBeUpdatedMember.role;
	const newRole = parseRoles(ctx.body.role);
	if (option?.organizationHooks?.beforeUpdateMemberRole) {
		const response = await option?.organizationHooks.beforeUpdateMemberRole({
			member: toBeUpdatedMember,
			newRole,
			user: userBeingUpdated,
			organization: organization$1
		});
		if (response && typeof response === "object" && "data" in response) {
			const updatedMember$1 = await adapter.updateMember(ctx.body.memberId, response.data.role || newRole);
			if (!updatedMember$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND });
			if (option?.organizationHooks?.afterUpdateMemberRole) await option?.organizationHooks.afterUpdateMemberRole({
				member: updatedMember$1,
				previousRole,
				user: userBeingUpdated,
				organization: organization$1
			});
			return ctx.json(updatedMember$1);
		}
	}
	const updatedMember = await adapter.updateMember(ctx.body.memberId, newRole);
	if (!updatedMember) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND });
	if (option?.organizationHooks?.afterUpdateMemberRole) await option?.organizationHooks.afterUpdateMemberRole({
		member: updatedMember,
		previousRole,
		user: userBeingUpdated,
		organization: organization$1
	});
	return ctx.json(updatedMember);
});
const getActiveMember = (options) => createAuthEndpoint("/organization/get-active-member", {
	method: "GET",
	use: [orgMiddleware, orgSessionMiddleware],
	requireHeaders: true,
	metadata: { openapi: {
		description: "Get the member details of the active organization",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				properties: {
					id: { type: "string" },
					userId: { type: "string" },
					organizationId: { type: "string" },
					role: { type: "string" }
				},
				required: [
					"id",
					"userId",
					"organizationId",
					"role"
				]
			} } }
		} }
	} }
}, async (ctx) => {
	const session = ctx.context.session;
	const organizationId = session.session.activeOrganizationId;
	if (!organizationId) return ctx.json(null, {
		status: 400,
		body: { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION }
	});
	const member = await getOrgAdapter(ctx.context, options).findMemberByOrgId({
		userId: session.user.id,
		organizationId
	});
	if (!member) return ctx.json(null, {
		status: 400,
		body: { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND }
	});
	return ctx.json(member);
});
const leaveOrganization = (options) => createAuthEndpoint("/organization/leave", {
	method: "POST",
	body: z.object({ organizationId: z.string().meta({ description: "The organization Id for the member to leave. Eg: \"organization-id\"" }) }),
	requireHeaders: true,
	use: [sessionMiddleware, orgMiddleware]
}, async (ctx) => {
	const session = ctx.context.session;
	const adapter = getOrgAdapter(ctx.context, options);
	const member = await adapter.findMemberByOrgId({
		userId: session.user.id,
		organizationId: ctx.body.organizationId
	});
	if (!member) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.MEMBER_NOT_FOUND });
	const creatorRole = ctx.context.orgOptions?.creatorRole || "owner";
	if (member.role.split(",").includes(creatorRole)) {
		if ((await ctx.context.adapter.findMany({
			model: "member",
			where: [{
				field: "organizationId",
				value: ctx.body.organizationId
			}]
		})).filter((member$1) => member$1.role.split(",").includes(creatorRole)).length <= 1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER });
	}
	await adapter.deleteMember({
		memberId: member.id,
		organizationId: ctx.body.organizationId,
		userId: session.user.id
	});
	if (session.session.activeOrganizationId === ctx.body.organizationId) await adapter.setActiveOrganization(session.session.token, null, ctx);
	return ctx.json(member);
});
const listMembers = (options) => createAuthEndpoint("/organization/list-members", {
	method: "GET",
	query: z.object({
		limit: z.string().meta({ description: "The number of users to return" }).or(z.number()).optional(),
		offset: z.string().meta({ description: "The offset to start from" }).or(z.number()).optional(),
		sortBy: z.string().meta({ description: "The field to sort by" }).optional(),
		sortDirection: z.enum(["asc", "desc"]).meta({ description: "The direction to sort by" }).optional(),
		filterField: z.string().meta({ description: "The field to filter by" }).optional(),
		filterValue: z.string().meta({ description: "The value to filter by" }).or(z.number()).or(z.boolean()).optional(),
		filterOperator: z.enum([
			"eq",
			"ne",
			"lt",
			"lte",
			"gt",
			"gte",
			"contains"
		]).meta({ description: "The operator to use for the filter" }).optional(),
		organizationId: z.string().meta({ description: "The organization ID to list members for. If not provided, will default to the user's active organization. Eg: \"organization-id\"" }).optional(),
		organizationSlug: z.string().meta({ description: "The organization slug to list members for. If not provided, will default to the user's active organization. Eg: \"organization-slug\"" }).optional()
	}).optional(),
	use: [orgMiddleware, orgSessionMiddleware]
}, async (ctx) => {
	const session = ctx.context.session;
	let organizationId = ctx.query?.organizationId || session.session.activeOrganizationId;
	const adapter = getOrgAdapter(ctx.context, options);
	if (ctx.query?.organizationSlug) {
		const organization$1 = await adapter.findOrganizationBySlug(ctx.query?.organizationSlug);
		if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
		organizationId = organization$1.id;
	}
	if (!organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
	if (!await adapter.findMemberByOrgId({
		userId: session.user.id,
		organizationId
	})) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION });
	const { members, total } = await adapter.listMembers({
		organizationId,
		limit: ctx.query?.limit ? Number(ctx.query.limit) : void 0,
		offset: ctx.query?.offset ? Number(ctx.query.offset) : void 0,
		sortBy: ctx.query?.sortBy,
		sortOrder: ctx.query?.sortDirection,
		filter: ctx.query?.filterField ? {
			field: ctx.query?.filterField,
			operator: ctx.query.filterOperator,
			value: ctx.query.filterValue
		} : void 0
	});
	return ctx.json({
		members,
		total
	});
});
const getActiveMemberRole = (options) => createAuthEndpoint("/organization/get-active-member-role", {
	method: "GET",
	query: z.object({
		userId: z.string().meta({ description: "The user ID to get the role for. If not provided, will default to the current user's" }).optional(),
		organizationId: z.string().meta({ description: "The organization ID to list members for. If not provided, will default to the user's active organization. Eg: \"organization-id\"" }).optional(),
		organizationSlug: z.string().meta({ description: "The organization slug to list members for. If not provided, will default to the user's active organization. Eg: \"organization-slug\"" }).optional()
	}).optional(),
	use: [orgMiddleware, orgSessionMiddleware]
}, async (ctx) => {
	const session = ctx.context.session;
	let organizationId = ctx.query?.organizationId || session.session.activeOrganizationId;
	const adapter = getOrgAdapter(ctx.context, options);
	if (ctx.query?.organizationSlug) {
		const organization$1 = await adapter.findOrganizationBySlug(ctx.query?.organizationSlug);
		if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
		organizationId = organization$1.id;
	}
	if (!organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
	const isMember = await adapter.findMemberByOrgId({
		userId: session.user.id,
		organizationId
	});
	if (!isMember) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION });
	if (!ctx.query?.userId) return ctx.json({ role: isMember.role });
	const userIdToGetRole = ctx.query?.userId;
	const member = await adapter.findMemberByOrgId({
		userId: userIdToGetRole,
		organizationId
	});
	if (!member) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION });
	return ctx.json({ role: member?.role });
});

//#endregion
//#region src/plugins/organization/routes/crud-org.ts
const createOrganization = (options) => {
	const additionalFieldsSchema = toZodSchema({
		fields: options?.schema?.organization?.additionalFields || {},
		isClientSide: true
	});
	const baseSchema = z.object({
		name: z.string().min(1).meta({ description: "The name of the organization" }),
		slug: z.string().min(1).meta({ description: "The slug of the organization" }),
		userId: z.coerce.string().meta({ description: "The user id of the organization creator. If not provided, the current user will be used. Should only be used by admins or when called by the server. server-only. Eg: \"user-id\"" }).optional(),
		logo: z.string().meta({ description: "The logo of the organization" }).optional(),
		metadata: z.record(z.string(), z.any()).meta({ description: "The metadata of the organization" }).optional(),
		keepCurrentActiveOrganization: z.boolean().meta({ description: "Whether to keep the current active organization active after creating a new one. Eg: true" }).optional()
	});
	return createAuthEndpoint("/organization/create", {
		method: "POST",
		body: z.object({
			...baseSchema.shape,
			...additionalFieldsSchema.shape
		}),
		use: [orgMiddleware],
		metadata: {
			$Infer: { body: {} },
			openapi: {
				description: "Create an organization",
				responses: { "200": {
					description: "Success",
					content: { "application/json": { schema: {
						type: "object",
						description: "The organization that was created",
						$ref: "#/components/schemas/Organization"
					} } }
				} }
			}
		}
	}, async (ctx) => {
		const session = await getSessionFromCtx(ctx);
		if (!session && (ctx.request || ctx.headers)) throw new APIError("UNAUTHORIZED");
		let user = session?.user || null;
		if (!user) {
			if (!ctx.body.userId) throw new APIError("UNAUTHORIZED");
			user = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
		}
		if (!user) return ctx.json(null, { status: 401 });
		const options$1 = ctx.context.orgOptions;
		if (!(typeof options$1?.allowUserToCreateOrganization === "function" ? await options$1.allowUserToCreateOrganization(user) : options$1?.allowUserToCreateOrganization === void 0 ? true : options$1.allowUserToCreateOrganization)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION });
		const adapter = getOrgAdapter(ctx.context, options$1);
		const userOrganizations = await adapter.listOrganizations(user.id);
		if (typeof options$1.organizationLimit === "number" ? userOrganizations.length >= options$1.organizationLimit : typeof options$1.organizationLimit === "function" ? await options$1.organizationLimit(user) : false) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS });
		if (await adapter.findOrganizationBySlug(ctx.body.slug)) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_ALREADY_EXISTS });
		let { keepCurrentActiveOrganization: _, userId: __, ...orgData } = ctx.body;
		if (options$1.organizationCreation?.beforeCreate) {
			const response = await options$1.organizationCreation.beforeCreate({
				organization: {
					...orgData,
					createdAt: /* @__PURE__ */ new Date()
				},
				user
			}, ctx.request);
			if (response && typeof response === "object" && "data" in response) orgData = {
				...ctx.body,
				...response.data
			};
		}
		if (options$1?.organizationHooks?.beforeCreateOrganization) {
			const response = await options$1?.organizationHooks.beforeCreateOrganization({
				organization: orgData,
				user
			});
			if (response && typeof response === "object" && "data" in response) orgData = {
				...ctx.body,
				...response.data
			};
		}
		const organization$1 = await adapter.createOrganization({ organization: {
			...orgData,
			createdAt: /* @__PURE__ */ new Date()
		} });
		let member;
		let teamMember = null;
		let data = {
			userId: user.id,
			organizationId: organization$1.id,
			role: ctx.context.orgOptions.creatorRole || "owner"
		};
		if (options$1?.organizationHooks?.beforeAddMember) {
			const response = await options$1?.organizationHooks.beforeAddMember({
				member: {
					userId: user.id,
					organizationId: organization$1.id,
					role: ctx.context.orgOptions.creatorRole || "owner"
				},
				user,
				organization: organization$1
			});
			if (response && typeof response === "object" && "data" in response) data = {
				...data,
				...response.data
			};
		}
		member = await adapter.createMember(data);
		if (options$1?.organizationHooks?.afterAddMember) await options$1?.organizationHooks.afterAddMember({
			member,
			user,
			organization: organization$1
		});
		if (options$1?.teams?.enabled && options$1.teams.defaultTeam?.enabled !== false) {
			let teamData = {
				organizationId: organization$1.id,
				name: `${organization$1.name}`,
				createdAt: /* @__PURE__ */ new Date()
			};
			if (options$1?.organizationHooks?.beforeCreateTeam) {
				const response = await options$1?.organizationHooks.beforeCreateTeam({
					team: {
						organizationId: organization$1.id,
						name: `${organization$1.name}`
					},
					user,
					organization: organization$1
				});
				if (response && typeof response === "object" && "data" in response) teamData = {
					...teamData,
					...response.data
				};
			}
			const defaultTeam = await options$1.teams.defaultTeam?.customCreateDefaultTeam?.(organization$1, ctx) || await adapter.createTeam(teamData);
			teamMember = await adapter.findOrCreateTeamMember({
				teamId: defaultTeam.id,
				userId: user.id
			});
			if (options$1?.organizationHooks?.afterCreateTeam) await options$1?.organizationHooks.afterCreateTeam({
				team: defaultTeam,
				user,
				organization: organization$1
			});
		}
		if (options$1.organizationCreation?.afterCreate) await options$1.organizationCreation.afterCreate({
			organization: organization$1,
			user,
			member
		}, ctx.request);
		if (options$1?.organizationHooks?.afterCreateOrganization) await options$1?.organizationHooks.afterCreateOrganization({
			organization: organization$1,
			user,
			member
		});
		if (ctx.context.session && !ctx.body.keepCurrentActiveOrganization) await adapter.setActiveOrganization(ctx.context.session.session.token, organization$1.id, ctx);
		if (teamMember && ctx.context.session && !ctx.body.keepCurrentActiveOrganization) await adapter.setActiveTeam(ctx.context.session.session.token, teamMember.teamId, ctx);
		return ctx.json({
			...organization$1,
			metadata: organization$1.metadata && typeof organization$1.metadata === "string" ? JSON.parse(organization$1.metadata) : organization$1.metadata,
			members: [member]
		});
	});
};
const checkOrganizationSlug = (options) => createAuthEndpoint("/organization/check-slug", {
	method: "POST",
	body: z.object({ slug: z.string().meta({ description: "The organization slug to check. Eg: \"my-org\"" }) }),
	use: [requestOnlySessionMiddleware, orgMiddleware]
}, async (ctx) => {
	if (!await getOrgAdapter(ctx.context, options).findOrganizationBySlug(ctx.body.slug)) return ctx.json({ status: true });
	throw new APIError("BAD_REQUEST", { message: "slug is taken" });
});
const updateOrganization = (options) => {
	const additionalFieldsSchema = toZodSchema({
		fields: options?.schema?.organization?.additionalFields || {},
		isClientSide: true
	});
	return createAuthEndpoint("/organization/update", {
		method: "POST",
		body: z.object({
			data: z.object({
				...additionalFieldsSchema.shape,
				name: z.string().min(1).meta({ description: "The name of the organization" }).optional(),
				slug: z.string().min(1).meta({ description: "The slug of the organization" }).optional(),
				logo: z.string().meta({ description: "The logo of the organization" }).optional(),
				metadata: z.record(z.string(), z.any()).meta({ description: "The metadata of the organization" }).optional()
			}).partial(),
			organizationId: z.string().meta({ description: "The organization ID. Eg: \"org-id\"" }).optional()
		}),
		requireHeaders: true,
		use: [orgMiddleware],
		metadata: {
			$Infer: { body: {} },
			openapi: {
				description: "Update an organization",
				responses: { "200": {
					description: "Success",
					content: { "application/json": { schema: {
						type: "object",
						description: "The updated organization",
						$ref: "#/components/schemas/Organization"
					} } }
				} }
			}
		}
	}, async (ctx) => {
		const session = await ctx.context.getSession(ctx);
		if (!session) throw new APIError("UNAUTHORIZED", { message: "User not found" });
		const organizationId = ctx.body.organizationId || session.session.activeOrganizationId;
		if (!organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
		const adapter = getOrgAdapter(ctx.context, options);
		const member = await adapter.findMemberByOrgId({
			userId: session.user.id,
			organizationId
		});
		if (!member) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION });
		if (!await hasPermission({
			permissions: { organization: ["update"] },
			role: member.role,
			options: ctx.context.orgOptions,
			organizationId
		}, ctx)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION });
		if (typeof ctx.body.data.slug === "string") {
			const existingOrganization = await adapter.findOrganizationBySlug(ctx.body.data.slug);
			if (existingOrganization && existingOrganization.id !== organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_SLUG_ALREADY_TAKEN });
		}
		if (options?.organizationHooks?.beforeUpdateOrganization) {
			const response = await options.organizationHooks.beforeUpdateOrganization({
				organization: ctx.body.data,
				user: session.user,
				member
			});
			if (response && typeof response === "object" && "data" in response) ctx.body.data = {
				...ctx.body.data,
				...response.data
			};
		}
		const updatedOrg = await adapter.updateOrganization(organizationId, ctx.body.data);
		if (options?.organizationHooks?.afterUpdateOrganization) await options.organizationHooks.afterUpdateOrganization({
			organization: updatedOrg,
			user: session.user,
			member
		});
		return ctx.json(updatedOrg);
	});
};
const deleteOrganization = (options) => {
	return createAuthEndpoint("/organization/delete", {
		method: "POST",
		body: z.object({ organizationId: z.string().meta({ description: "The organization id to delete" }) }),
		requireHeaders: true,
		use: [orgMiddleware],
		metadata: { openapi: {
			description: "Delete an organization",
			responses: { "200": {
				description: "Success",
				content: { "application/json": { schema: {
					type: "string",
					description: "The organization id that was deleted"
				} } }
			} }
		} }
	}, async (ctx) => {
		if (ctx.context.orgOptions.organizationDeletion?.disabled || ctx.context.orgOptions.disableOrganizationDeletion) {
			if (ctx.context.orgOptions.organizationDeletion?.disabled) ctx.context.logger.info("`organizationDeletion.disabled` is deprecated. Use `disableOrganizationDeletion` instead");
			throw new APIError("NOT_FOUND", { message: "Organization deletion is disabled" });
		}
		const session = await ctx.context.getSession(ctx);
		if (!session) throw new APIError("UNAUTHORIZED", { status: 401 });
		const organizationId = ctx.body.organizationId;
		if (!organizationId) return ctx.json(null, {
			status: 400,
			body: { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND }
		});
		const adapter = getOrgAdapter(ctx.context, options);
		const member = await adapter.findMemberByOrgId({
			userId: session.user.id,
			organizationId
		});
		if (!member) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION });
		if (!await hasPermission({
			role: member.role,
			permissions: { organization: ["delete"] },
			organizationId,
			options: ctx.context.orgOptions
		}, ctx)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION });
		if (organizationId === session.session.activeOrganizationId)
 /**
		* If the organization is deleted, we set the active organization to null
		*/
		await adapter.setActiveOrganization(session.session.token, null, ctx);
		const org = await adapter.findOrganizationById(organizationId);
		if (!org) throw new APIError("BAD_REQUEST");
		if (options?.organizationHooks?.beforeDeleteOrganization) await options.organizationHooks.beforeDeleteOrganization({
			organization: org,
			user: session.user
		});
		await adapter.deleteOrganization(organizationId);
		if (options?.organizationHooks?.afterDeleteOrganization) await options.organizationHooks.afterDeleteOrganization({
			organization: org,
			user: session.user
		});
		return ctx.json(org);
	});
};
const getFullOrganization = (options) => createAuthEndpoint("/organization/get-full-organization", {
	method: "GET",
	query: z.optional(z.object({
		organizationId: z.string().meta({ description: "The organization id to get" }).optional(),
		organizationSlug: z.string().meta({ description: "The organization slug to get" }).optional(),
		membersLimit: z.number().or(z.string().transform((val) => parseInt(val))).meta({ description: "The limit of members to get. By default, it uses the membershipLimit option which defaults to 100." }).optional()
	})),
	requireHeaders: true,
	use: [orgMiddleware, orgSessionMiddleware],
	metadata: { openapi: {
		operationId: "getOrganization",
		description: "Get the full organization",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				description: "The organization",
				$ref: "#/components/schemas/Organization"
			} } }
		} }
	} }
}, async (ctx) => {
	const session = ctx.context.session;
	const organizationId = ctx.query?.organizationSlug || ctx.query?.organizationId || session.session.activeOrganizationId;
	if (!organizationId) return ctx.json(null, { status: 200 });
	const adapter = getOrgAdapter(ctx.context, options);
	const organization$1 = await adapter.findFullOrganization({
		organizationId,
		isSlug: !!ctx.query?.organizationSlug,
		includeTeams: ctx.context.orgOptions.teams?.enabled,
		membersLimit: ctx.query?.membersLimit
	});
	if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
	if (!await adapter.checkMembership({
		userId: session.user.id,
		organizationId: organization$1.id
	})) {
		await adapter.setActiveOrganization(session.session.token, null, ctx);
		throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION });
	}
	return ctx.json(organization$1);
});
const setActiveOrganization = (options) => {
	return createAuthEndpoint("/organization/set-active", {
		method: "POST",
		body: z.object({
			organizationId: z.string().meta({ description: "The organization id to set as active. It can be null to unset the active organization. Eg: \"org-id\"" }).nullable().optional(),
			organizationSlug: z.string().meta({ description: "The organization slug to set as active. It can be null to unset the active organization if organizationId is not provided. Eg: \"org-slug\"" }).optional()
		}),
		use: [orgSessionMiddleware, orgMiddleware],
		metadata: { openapi: {
			operationId: "setActiveOrganization",
			description: "Set the active organization",
			responses: { "200": {
				description: "Success",
				content: { "application/json": { schema: {
					type: "object",
					description: "The organization",
					$ref: "#/components/schemas/Organization"
				} } }
			} }
		} }
	}, async (ctx) => {
		const adapter = getOrgAdapter(ctx.context, options);
		const session = ctx.context.session;
		let organizationId = ctx.body.organizationId;
		let organizationSlug = ctx.body.organizationSlug;
		if (organizationId === null) {
			if (!session.session.activeOrganizationId) return ctx.json(null);
			await setSessionCookie(ctx, {
				session: await adapter.setActiveOrganization(session.session.token, null, ctx),
				user: session.user
			});
			return ctx.json(null);
		}
		if (!organizationId && !organizationSlug) {
			const sessionOrgId = session.session.activeOrganizationId;
			if (!sessionOrgId) return ctx.json(null);
			organizationId = sessionOrgId;
		}
		if (organizationSlug && !organizationId) {
			const organization$2 = await adapter.findOrganizationBySlug(organizationSlug);
			if (!organization$2) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
			organizationId = organization$2.id;
		}
		if (!organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
		if (!await adapter.checkMembership({
			userId: session.user.id,
			organizationId
		})) {
			await adapter.setActiveOrganization(session.session.token, null, ctx);
			throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION });
		}
		let organization$1 = await adapter.findOrganizationById(organizationId);
		if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
		await setSessionCookie(ctx, {
			session: await adapter.setActiveOrganization(session.session.token, organization$1.id, ctx),
			user: session.user
		});
		return ctx.json(organization$1);
	});
};
const listOrganizations = (options) => createAuthEndpoint("/organization/list", {
	method: "GET",
	use: [orgMiddleware, orgSessionMiddleware],
	metadata: { openapi: {
		description: "List all organizations",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "array",
				items: { $ref: "#/components/schemas/Organization" }
			} } }
		} }
	} }
}, async (ctx) => {
	const organizations = await getOrgAdapter(ctx.context, options).listOrganizations(ctx.context.session.user.id);
	return ctx.json(organizations);
});

//#endregion
//#region src/plugins/organization/schema.ts
const roleSchema = z.string();
const invitationStatus = z.enum([
	"pending",
	"accepted",
	"rejected",
	"canceled"
]).default("pending");
const organizationSchema = z.object({
	id: z.string().default(generateId),
	name: z.string(),
	slug: z.string(),
	logo: z.string().nullish().optional(),
	metadata: z.record(z.string(), z.unknown()).or(z.string().transform((v) => JSON.parse(v))).optional(),
	createdAt: z.date()
});
const memberSchema = z.object({
	id: z.string().default(generateId),
	organizationId: z.string(),
	userId: z.coerce.string(),
	role: roleSchema,
	createdAt: z.date().default(() => /* @__PURE__ */ new Date())
});
const invitationSchema = z.object({
	id: z.string().default(generateId),
	organizationId: z.string(),
	email: z.string(),
	role: roleSchema,
	status: invitationStatus,
	teamId: z.string().nullish(),
	inviterId: z.string(),
	expiresAt: z.date(),
	createdAt: z.date().default(() => /* @__PURE__ */ new Date())
});
const teamSchema = z.object({
	id: z.string().default(generateId),
	name: z.string().min(1),
	organizationId: z.string(),
	createdAt: z.date(),
	updatedAt: z.date().optional()
});
const teamMemberSchema = z.object({
	id: z.string().default(generateId),
	teamId: z.string(),
	userId: z.string(),
	createdAt: z.date().default(() => /* @__PURE__ */ new Date())
});
const organizationRoleSchema = z.object({
	id: z.string().default(generateId),
	organizationId: z.string(),
	role: z.string(),
	permission: z.record(z.string(), z.array(z.string())),
	createdAt: z.date().default(() => /* @__PURE__ */ new Date()),
	updatedAt: z.date().optional()
});
const defaultRoles$1 = [
	"admin",
	"member",
	"owner"
];
const defaultRolesSchema = z.union([z.enum(defaultRoles$1), z.array(z.enum(defaultRoles$1))]);

//#endregion
//#region src/plugins/organization/routes/crud-team.ts
const createTeam = (options) => {
	const additionalFieldsSchema = toZodSchema({
		fields: options?.schema?.team?.additionalFields ?? {},
		isClientSide: true
	});
	const baseSchema = z.object({
		name: z.string().meta({ description: "The name of the team. Eg: \"my-team\"" }),
		organizationId: z.string().meta({ description: "The organization ID which the team will be created in. Defaults to the active organization. Eg: \"organization-id\"" }).optional()
	});
	return createAuthEndpoint("/organization/create-team", {
		method: "POST",
		body: z.object({
			...baseSchema.shape,
			...additionalFieldsSchema.shape
		}),
		use: [orgMiddleware],
		metadata: {
			$Infer: { body: {} },
			openapi: {
				description: "Create a new team within an organization",
				responses: { "200": {
					description: "Team created successfully",
					content: { "application/json": { schema: {
						type: "object",
						properties: {
							id: {
								type: "string",
								description: "Unique identifier of the created team"
							},
							name: {
								type: "string",
								description: "Name of the team"
							},
							organizationId: {
								type: "string",
								description: "ID of the organization the team belongs to"
							},
							createdAt: {
								type: "string",
								format: "date-time",
								description: "Timestamp when the team was created"
							},
							updatedAt: {
								type: "string",
								format: "date-time",
								description: "Timestamp when the team was last updated"
							}
						},
						required: [
							"id",
							"name",
							"organizationId",
							"createdAt",
							"updatedAt"
						]
					} } }
				} }
			}
		}
	}, async (ctx) => {
		const session = await getSessionFromCtx(ctx);
		const organizationId = ctx.body.organizationId || session?.session.activeOrganizationId;
		if (!session && (ctx.request || ctx.headers)) throw new APIError("UNAUTHORIZED");
		if (!organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
		const adapter = getOrgAdapter(ctx.context, options);
		if (session) {
			const member = await adapter.findMemberByOrgId({
				userId: session.user.id,
				organizationId
			});
			if (!member) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION });
			if (!await hasPermission({
				role: member.role,
				options: ctx.context.orgOptions,
				permissions: { team: ["create"] },
				organizationId
			}, ctx)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION });
		}
		const existingTeams = await adapter.listTeams(organizationId);
		const maximum = typeof ctx.context.orgOptions.teams?.maximumTeams === "function" ? await ctx.context.orgOptions.teams?.maximumTeams({
			organizationId,
			session
		}, ctx) : ctx.context.orgOptions.teams?.maximumTeams;
		if (maximum ? existingTeams.length >= maximum : false) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS });
		const { name, organizationId: _, ...additionalFields } = ctx.body;
		const organization$1 = await adapter.findOrganizationById(organizationId);
		if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
		let teamData = {
			name,
			organizationId,
			createdAt: /* @__PURE__ */ new Date(),
			updatedAt: /* @__PURE__ */ new Date(),
			...additionalFields
		};
		if (options?.organizationHooks?.beforeCreateTeam) {
			const response = await options?.organizationHooks.beforeCreateTeam({
				team: {
					name,
					organizationId,
					...additionalFields
				},
				user: session?.user,
				organization: organization$1
			});
			if (response && typeof response === "object" && "data" in response) teamData = {
				...teamData,
				...response.data
			};
		}
		const createdTeam = await adapter.createTeam(teamData);
		if (options?.organizationHooks?.afterCreateTeam) await options?.organizationHooks.afterCreateTeam({
			team: createdTeam,
			user: session?.user,
			organization: organization$1
		});
		return ctx.json(createdTeam);
	});
};
const removeTeam = (options) => createAuthEndpoint("/organization/remove-team", {
	method: "POST",
	body: z.object({
		teamId: z.string().meta({ description: `The team ID of the team to remove. Eg: "team-id"` }),
		organizationId: z.string().meta({ description: `The organization ID which the team falls under. If not provided, it will default to the user's active organization. Eg: "organization-id"` }).optional()
	}),
	use: [orgMiddleware],
	metadata: { openapi: {
		description: "Remove a team from an organization",
		responses: { "200": {
			description: "Team removed successfully",
			content: { "application/json": { schema: {
				type: "object",
				properties: { message: {
					type: "string",
					description: "Confirmation message indicating successful removal",
					enum: ["Team removed successfully."]
				} },
				required: ["message"]
			} } }
		} }
	} }
}, async (ctx) => {
	const session = await getSessionFromCtx(ctx);
	const organizationId = ctx.body.organizationId || session?.session.activeOrganizationId;
	if (!organizationId) return ctx.json(null, {
		status: 400,
		body: { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION }
	});
	if (!session && (ctx.request || ctx.headers)) throw new APIError("UNAUTHORIZED");
	const adapter = getOrgAdapter(ctx.context, options);
	if (session) {
		const member = await adapter.findMemberByOrgId({
			userId: session.user.id,
			organizationId
		});
		if (!member || session.session?.activeTeamId === ctx.body.teamId) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM });
		if (!await hasPermission({
			role: member.role,
			options: ctx.context.orgOptions,
			permissions: { team: ["delete"] },
			organizationId
		}, ctx)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION });
	}
	const team = await adapter.findTeamById({
		teamId: ctx.body.teamId,
		organizationId
	});
	if (!team || team.organizationId !== organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND });
	if (!ctx.context.orgOptions.teams?.allowRemovingAllTeams) {
		if ((await adapter.listTeams(organizationId)).length <= 1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.UNABLE_TO_REMOVE_LAST_TEAM });
	}
	const organization$1 = await adapter.findOrganizationById(organizationId);
	if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
	if (options?.organizationHooks?.beforeDeleteTeam) await options?.organizationHooks.beforeDeleteTeam({
		team,
		user: session?.user,
		organization: organization$1
	});
	await adapter.deleteTeam(team.id);
	if (options?.organizationHooks?.afterDeleteTeam) await options?.organizationHooks.afterDeleteTeam({
		team,
		user: session?.user,
		organization: organization$1
	});
	return ctx.json({ message: "Team removed successfully." });
});
const updateTeam = (options) => {
	const additionalFieldsSchema = toZodSchema({
		fields: options?.schema?.team?.additionalFields ?? {},
		isClientSide: true
	});
	return createAuthEndpoint("/organization/update-team", {
		method: "POST",
		body: z.object({
			teamId: z.string().meta({ description: `The ID of the team to be updated. Eg: "team-id"` }),
			data: z.object({
				...teamSchema.shape,
				...additionalFieldsSchema.shape
			}).partial()
		}),
		requireHeaders: true,
		use: [orgMiddleware, orgSessionMiddleware],
		metadata: {
			$Infer: { body: {} },
			openapi: {
				description: "Update an existing team in an organization",
				responses: { "200": {
					description: "Team updated successfully",
					content: { "application/json": { schema: {
						type: "object",
						properties: {
							id: {
								type: "string",
								description: "Unique identifier of the updated team"
							},
							name: {
								type: "string",
								description: "Updated name of the team"
							},
							organizationId: {
								type: "string",
								description: "ID of the organization the team belongs to"
							},
							createdAt: {
								type: "string",
								format: "date-time",
								description: "Timestamp when the team was created"
							},
							updatedAt: {
								type: "string",
								format: "date-time",
								description: "Timestamp when the team was last updated"
							}
						},
						required: [
							"id",
							"name",
							"organizationId",
							"createdAt",
							"updatedAt"
						]
					} } }
				} }
			}
		}
	}, async (ctx) => {
		const session = ctx.context.session;
		const organizationId = ctx.body.data.organizationId || session.session.activeOrganizationId;
		if (!organizationId) return ctx.json(null, {
			status: 400,
			body: { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION }
		});
		const adapter = getOrgAdapter(ctx.context, options);
		const member = await adapter.findMemberByOrgId({
			userId: session.user.id,
			organizationId
		});
		if (!member) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM });
		if (!await hasPermission({
			role: member.role,
			options: ctx.context.orgOptions,
			permissions: { team: ["update"] },
			organizationId
		}, ctx)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM });
		const team = await adapter.findTeamById({
			teamId: ctx.body.teamId,
			organizationId
		});
		if (!team || team.organizationId !== organizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND });
		const { name, organizationId: __, ...additionalFields } = ctx.body.data;
		const organization$1 = await adapter.findOrganizationById(organizationId);
		if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
		const updates = {
			name,
			...additionalFields
		};
		if (options?.organizationHooks?.beforeUpdateTeam) {
			const response = await options?.organizationHooks.beforeUpdateTeam({
				team,
				updates,
				user: session.user,
				organization: organization$1
			});
			if (response && typeof response === "object" && "data" in response) {
				const modifiedUpdates = response.data;
				const updatedTeam$1 = await adapter.updateTeam(team.id, modifiedUpdates);
				if (options?.organizationHooks?.afterUpdateTeam) await options?.organizationHooks.afterUpdateTeam({
					team: updatedTeam$1,
					user: session.user,
					organization: organization$1
				});
				return ctx.json(updatedTeam$1);
			}
		}
		const updatedTeam = await adapter.updateTeam(team.id, updates);
		if (options?.organizationHooks?.afterUpdateTeam) await options?.organizationHooks.afterUpdateTeam({
			team: updatedTeam,
			user: session.user,
			organization: organization$1
		});
		return ctx.json(updatedTeam);
	});
};
const listOrganizationTeams = (options) => createAuthEndpoint("/organization/list-teams", {
	method: "GET",
	query: z.optional(z.object({ organizationId: z.string().meta({ description: `The organization ID which the teams are under to list. Defaults to the users active organization. Eg: "organziation-id"` }).optional() })),
	requireHeaders: true,
	metadata: { openapi: {
		description: "List all teams in an organization",
		responses: { "200": {
			description: "Teams retrieved successfully",
			content: { "application/json": { schema: {
				type: "array",
				items: {
					type: "object",
					properties: {
						id: {
							type: "string",
							description: "Unique identifier of the team"
						},
						name: {
							type: "string",
							description: "Name of the team"
						},
						organizationId: {
							type: "string",
							description: "ID of the organization the team belongs to"
						},
						createdAt: {
							type: "string",
							format: "date-time",
							description: "Timestamp when the team was created"
						},
						updatedAt: {
							type: "string",
							format: "date-time",
							description: "Timestamp when the team was last updated"
						}
					},
					required: [
						"id",
						"name",
						"organizationId",
						"createdAt",
						"updatedAt"
					]
				},
				description: "Array of team objects within the organization"
			} } }
		} }
	} },
	use: [orgMiddleware, orgSessionMiddleware]
}, async (ctx) => {
	const session = ctx.context.session;
	const organizationId = ctx.query?.organizationId || session?.session.activeOrganizationId;
	if (!organizationId) throw ctx.error("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
	const adapter = getOrgAdapter(ctx.context, options);
	if (!await adapter.findMemberByOrgId({
		userId: session.user.id,
		organizationId: organizationId || ""
	})) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION });
	const teams = await adapter.listTeams(organizationId);
	return ctx.json(teams);
});
const setActiveTeam = (options) => createAuthEndpoint("/organization/set-active-team", {
	method: "POST",
	body: z.object({ teamId: z.string().meta({ description: "The team id to set as active. It can be null to unset the active team" }).nullable().optional() }),
	use: [orgSessionMiddleware, orgMiddleware],
	metadata: { openapi: {
		description: "Set the active team",
		responses: { "200": {
			description: "Success",
			content: { "application/json": { schema: {
				type: "object",
				description: "The team",
				$ref: "#/components/schemas/Team"
			} } }
		} }
	} }
}, async (ctx) => {
	const adapter = getOrgAdapter(ctx.context, ctx.context.orgOptions);
	const session = ctx.context.session;
	if (ctx.body.teamId === null) {
		if (!session.session.activeTeamId) return ctx.json(null);
		await setSessionCookie(ctx, {
			session: await adapter.setActiveTeam(session.session.token, null, ctx),
			user: session.user
		});
		return ctx.json(null);
	}
	let teamId;
	if (!ctx.body.teamId) {
		const sessionTeamId = session.session.activeTeamId;
		if (!sessionTeamId) return ctx.json(null);
		else teamId = sessionTeamId;
	} else teamId = ctx.body.teamId;
	const team = await adapter.findTeamById({ teamId });
	if (!team) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND });
	if (!await adapter.findTeamMember({
		teamId,
		userId: session.user.id
	})) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_TEAM });
	await setSessionCookie(ctx, {
		session: await adapter.setActiveTeam(session.session.token, team.id, ctx),
		user: session.user
	});
	return ctx.json(team);
});
const listUserTeams = (options) => createAuthEndpoint("/organization/list-user-teams", {
	method: "GET",
	metadata: { openapi: {
		description: "List all teams that the current user is a part of.",
		responses: { "200": {
			description: "Teams retrieved successfully",
			content: { "application/json": { schema: {
				type: "array",
				items: {
					type: "object",
					description: "The team",
					$ref: "#/components/schemas/Team"
				},
				description: "Array of team objects within the organization"
			} } }
		} }
	} },
	use: [orgMiddleware, orgSessionMiddleware]
}, async (ctx) => {
	const session = ctx.context.session;
	const teams = await getOrgAdapter(ctx.context, ctx.context.orgOptions).listTeamsByUser({ userId: session.user.id });
	return ctx.json(teams);
});
const listTeamMembers = (options) => createAuthEndpoint("/organization/list-team-members", {
	method: "GET",
	query: z.optional(z.object({ teamId: z.string().optional().meta({ description: "The team whose members we should return. If this is not provided the members of the current active team get returned." }) })),
	metadata: { openapi: {
		description: "List the members of the given team.",
		responses: { "200": {
			description: "Teams retrieved successfully",
			content: { "application/json": { schema: {
				type: "array",
				items: {
					type: "object",
					description: "The team member",
					properties: {
						id: {
							type: "string",
							description: "Unique identifier of the team member"
						},
						userId: {
							type: "string",
							description: "The user ID of the team member"
						},
						teamId: {
							type: "string",
							description: "The team ID of the team the team member is in"
						},
						createdAt: {
							type: "string",
							format: "date-time",
							description: "Timestamp when the team member was created"
						}
					},
					required: [
						"id",
						"userId",
						"teamId",
						"createdAt"
					]
				},
				description: "Array of team member objects within the team"
			} } }
		} }
	} },
	use: [orgMiddleware, orgSessionMiddleware]
}, async (ctx) => {
	const session = ctx.context.session;
	const adapter = getOrgAdapter(ctx.context, ctx.context.orgOptions);
	let teamId = ctx.query?.teamId || session?.session.activeTeamId;
	if (!teamId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM });
	if (!await adapter.findTeamMember({
		userId: session.user.id,
		teamId
	})) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_TEAM });
	const members = await adapter.listTeamMembers({ teamId });
	return ctx.json(members);
});
const addTeamMember = (options) => createAuthEndpoint("/organization/add-team-member", {
	method: "POST",
	body: z.object({
		teamId: z.string().meta({ description: "The team the user should be a member of." }),
		userId: z.coerce.string().meta({ description: "The user Id which represents the user to be added as a member." })
	}),
	metadata: { openapi: {
		description: "The newly created member",
		responses: { "200": {
			description: "Team member created successfully",
			content: { "application/json": { schema: {
				type: "object",
				description: "The team member",
				properties: {
					id: {
						type: "string",
						description: "Unique identifier of the team member"
					},
					userId: {
						type: "string",
						description: "The user ID of the team member"
					},
					teamId: {
						type: "string",
						description: "The team ID of the team the team member is in"
					},
					createdAt: {
						type: "string",
						format: "date-time",
						description: "Timestamp when the team member was created"
					}
				},
				required: [
					"id",
					"userId",
					"teamId",
					"createdAt"
				]
			} } }
		} }
	} },
	use: [orgMiddleware, orgSessionMiddleware]
}, async (ctx) => {
	const session = ctx.context.session;
	const adapter = getOrgAdapter(ctx.context, ctx.context.orgOptions);
	if (!session.session.activeOrganizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
	const currentMember = await adapter.findMemberByOrgId({
		userId: session.user.id,
		organizationId: session.session.activeOrganizationId
	});
	if (!currentMember) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION });
	if (!await hasPermission({
		role: currentMember.role,
		options: ctx.context.orgOptions,
		permissions: { member: ["update"] },
		organizationId: session.session.activeOrganizationId
	}, ctx)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER });
	if (!await adapter.findMemberByOrgId({
		userId: ctx.body.userId,
		organizationId: session.session.activeOrganizationId
	})) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION });
	const team = await adapter.findTeamById({
		teamId: ctx.body.teamId,
		organizationId: session.session.activeOrganizationId
	});
	if (!team) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND });
	const organization$1 = await adapter.findOrganizationById(session.session.activeOrganizationId);
	if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
	const userBeingAdded = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
	if (!userBeingAdded) throw new APIError("BAD_REQUEST", { message: "User not found" });
	if (options?.organizationHooks?.beforeAddTeamMember) {
		const response = await options?.organizationHooks.beforeAddTeamMember({
			teamMember: {
				teamId: ctx.body.teamId,
				userId: ctx.body.userId
			},
			team,
			user: userBeingAdded,
			organization: organization$1
		});
		if (response && typeof response === "object" && "data" in response) {}
	}
	const teamMember = await adapter.findOrCreateTeamMember({
		teamId: ctx.body.teamId,
		userId: ctx.body.userId
	});
	if (options?.organizationHooks?.afterAddTeamMember) await options?.organizationHooks.afterAddTeamMember({
		teamMember,
		team,
		user: userBeingAdded,
		organization: organization$1
	});
	return ctx.json(teamMember);
});
const removeTeamMember = (options) => createAuthEndpoint("/organization/remove-team-member", {
	method: "POST",
	body: z.object({
		teamId: z.string().meta({ description: "The team the user should be removed from." }),
		userId: z.coerce.string().meta({ description: "The user which should be removed from the team." })
	}),
	metadata: { openapi: {
		description: "Remove a member from a team",
		responses: { "200": {
			description: "Team member removed successfully",
			content: { "application/json": { schema: {
				type: "object",
				properties: { message: {
					type: "string",
					description: "Confirmation message indicating successful removal",
					enum: ["Team member removed successfully."]
				} },
				required: ["message"]
			} } }
		} }
	} },
	use: [orgMiddleware, orgSessionMiddleware]
}, async (ctx) => {
	const session = ctx.context.session;
	const adapter = getOrgAdapter(ctx.context, ctx.context.orgOptions);
	if (!session.session.activeOrganizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
	const currentMember = await adapter.findMemberByOrgId({
		userId: session.user.id,
		organizationId: session.session.activeOrganizationId
	});
	if (!currentMember) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION });
	if (!await hasPermission({
		role: currentMember.role,
		options: ctx.context.orgOptions,
		permissions: { member: ["delete"] },
		organizationId: session.session.activeOrganizationId
	}, ctx)) throw new APIError("FORBIDDEN", { message: ORGANIZATION_ERROR_CODES.YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER });
	if (!await adapter.findMemberByOrgId({
		userId: ctx.body.userId,
		organizationId: session.session.activeOrganizationId
	})) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION });
	const team = await adapter.findTeamById({
		teamId: ctx.body.teamId,
		organizationId: session.session.activeOrganizationId
	});
	if (!team) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.TEAM_NOT_FOUND });
	const organization$1 = await adapter.findOrganizationById(session.session.activeOrganizationId);
	if (!organization$1) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.ORGANIZATION_NOT_FOUND });
	const userBeingRemoved = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
	if (!userBeingRemoved) throw new APIError("BAD_REQUEST", { message: "User not found" });
	const teamMember = await adapter.findTeamMember({
		teamId: ctx.body.teamId,
		userId: ctx.body.userId
	});
	if (!teamMember) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_TEAM });
	if (options?.organizationHooks?.beforeRemoveTeamMember) await options?.organizationHooks.beforeRemoveTeamMember({
		teamMember,
		team,
		user: userBeingRemoved,
		organization: organization$1
	});
	await adapter.removeTeamMember({
		teamId: ctx.body.teamId,
		userId: ctx.body.userId
	});
	if (options?.organizationHooks?.afterRemoveTeamMember) await options?.organizationHooks.afterRemoveTeamMember({
		teamMember,
		team,
		user: userBeingRemoved,
		organization: organization$1
	});
	return ctx.json({ message: "Team member removed successfully." });
});

//#endregion
//#region src/plugins/organization/organization.ts
function parseRoles(roles) {
	return Array.isArray(roles) ? roles.join(",") : roles;
}
const createHasPermission = (options) => {
	return createAuthEndpoint("/organization/has-permission", {
		method: "POST",
		requireHeaders: true,
		body: z.object({ organizationId: z.string().optional() }).and(z.union([z.object({
			permission: z.record(z.string(), z.array(z.string())),
			permissions: z.undefined()
		}), z.object({
			permission: z.undefined(),
			permissions: z.record(z.string(), z.array(z.string()))
		})])),
		use: [orgSessionMiddleware],
		metadata: {
			$Infer: { body: {} },
			openapi: {
				description: "Check if the user has permission",
				requestBody: { content: { "application/json": { schema: {
					type: "object",
					properties: {
						permission: {
							type: "object",
							description: "The permission to check",
							deprecated: true
						},
						permissions: {
							type: "object",
							description: "The permission to check"
						}
					},
					required: ["permissions"]
				} } } },
				responses: { "200": {
					description: "Success",
					content: { "application/json": { schema: {
						type: "object",
						properties: {
							error: { type: "string" },
							success: { type: "boolean" }
						},
						required: ["success"]
					} } }
				} }
			}
		}
	}, async (ctx) => {
		const activeOrganizationId = ctx.body.organizationId || ctx.context.session.session.activeOrganizationId;
		if (!activeOrganizationId) throw new APIError("BAD_REQUEST", { message: ORGANIZATION_ERROR_CODES.NO_ACTIVE_ORGANIZATION });
		const member = await getOrgAdapter(ctx.context, options).findMemberByOrgId({
			userId: ctx.context.session.user.id,
			organizationId: activeOrganizationId
		});
		if (!member) throw new APIError("UNAUTHORIZED", { message: ORGANIZATION_ERROR_CODES.USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION });
		const result = await hasPermission({
			role: member.role,
			options: options || {},
			permissions: ctx.body.permissions ?? ctx.body.permission,
			organizationId: activeOrganizationId
		}, ctx);
		return ctx.json({
			error: null,
			success: result
		});
	});
};
function organization(options) {
	let endpoints = {
		createOrganization: createOrganization(options),
		updateOrganization: updateOrganization(options),
		deleteOrganization: deleteOrganization(options),
		setActiveOrganization: setActiveOrganization(options),
		getFullOrganization: getFullOrganization(options),
		listOrganizations: listOrganizations(options),
		createInvitation: createInvitation(options),
		cancelInvitation: cancelInvitation(options),
		acceptInvitation: acceptInvitation(options),
		getInvitation: getInvitation(options),
		rejectInvitation: rejectInvitation(options),
		listInvitations: listInvitations(options),
		getActiveMember: getActiveMember(options),
		checkOrganizationSlug: checkOrganizationSlug(options),
		addMember: addMember(options),
		removeMember: removeMember(options),
		updateMemberRole: updateMemberRole(options),
		leaveOrganization: leaveOrganization(options),
		listUserInvitations: listUserInvitations(options),
		listMembers: listMembers(options),
		getActiveMemberRole: getActiveMemberRole(options)
	};
	const teamSupport = options?.teams?.enabled;
	const teamEndpoints = {
		createTeam: createTeam(options),
		listOrganizationTeams: listOrganizationTeams(options),
		removeTeam: removeTeam(options),
		updateTeam: updateTeam(options),
		setActiveTeam: setActiveTeam(options),
		listUserTeams: listUserTeams(options),
		listTeamMembers: listTeamMembers(options),
		addTeamMember: addTeamMember(options),
		removeTeamMember: removeTeamMember(options)
	};
	if (teamSupport) endpoints = {
		...endpoints,
		...teamEndpoints
	};
	const dynamicAccessControlEndpoints = {
		createOrgRole: createOrgRole(options),
		deleteOrgRole: deleteOrgRole(options),
		listOrgRoles: listOrgRoles(options),
		getOrgRole: getOrgRole(options),
		updateOrgRole: updateOrgRole(options)
	};
	if (options?.dynamicAccessControl?.enabled) endpoints = {
		...endpoints,
		...dynamicAccessControlEndpoints
	};
	const roles = {
		...defaultRoles,
		...options?.roles
	};
	const teamSchema$1 = teamSupport ? {
		team: {
			modelName: options?.schema?.team?.modelName,
			fields: {
				name: {
					type: "string",
					required: true,
					fieldName: options?.schema?.team?.fields?.name
				},
				organizationId: {
					type: "string",
					required: true,
					references: {
						model: "organization",
						field: "id"
					},
					fieldName: options?.schema?.team?.fields?.organizationId,
					index: true
				},
				createdAt: {
					type: "date",
					required: true,
					fieldName: options?.schema?.team?.fields?.createdAt
				},
				updatedAt: {
					type: "date",
					required: false,
					fieldName: options?.schema?.team?.fields?.updatedAt,
					onUpdate: () => /* @__PURE__ */ new Date()
				},
				...options?.schema?.team?.additionalFields || {}
			}
		},
		teamMember: {
			modelName: options?.schema?.teamMember?.modelName,
			fields: {
				teamId: {
					type: "string",
					required: true,
					references: {
						model: "team",
						field: "id"
					},
					fieldName: options?.schema?.teamMember?.fields?.teamId,
					index: true
				},
				userId: {
					type: "string",
					required: true,
					references: {
						model: "user",
						field: "id"
					},
					fieldName: options?.schema?.teamMember?.fields?.userId,
					index: true
				},
				createdAt: {
					type: "date",
					required: false,
					fieldName: options?.schema?.teamMember?.fields?.createdAt
				}
			}
		}
	} : {};
	const organizationRoleSchema$1 = options?.dynamicAccessControl?.enabled ? { organizationRole: {
		fields: {
			organizationId: {
				type: "string",
				required: true,
				references: {
					model: "organization",
					field: "id"
				},
				fieldName: options?.schema?.organizationRole?.fields?.organizationId,
				index: true
			},
			role: {
				type: "string",
				required: true,
				fieldName: options?.schema?.organizationRole?.fields?.role,
				index: true
			},
			permission: {
				type: "string",
				required: true,
				fieldName: options?.schema?.organizationRole?.fields?.permission
			},
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => /* @__PURE__ */ new Date(),
				fieldName: options?.schema?.organizationRole?.fields?.createdAt
			},
			updatedAt: {
				type: "date",
				required: false,
				fieldName: options?.schema?.organizationRole?.fields?.updatedAt,
				onUpdate: () => /* @__PURE__ */ new Date()
			},
			...options?.schema?.organizationRole?.additionalFields || {}
		},
		modelName: options?.schema?.organizationRole?.modelName
	} } : {};
	const schema = {
		organization: {
			modelName: options?.schema?.organization?.modelName,
			fields: {
				name: {
					type: "string",
					required: true,
					sortable: true,
					fieldName: options?.schema?.organization?.fields?.name
				},
				slug: {
					type: "string",
					required: true,
					unique: true,
					sortable: true,
					fieldName: options?.schema?.organization?.fields?.slug
				},
				logo: {
					type: "string",
					required: false,
					fieldName: options?.schema?.organization?.fields?.logo
				},
				createdAt: {
					type: "date",
					required: true,
					fieldName: options?.schema?.organization?.fields?.createdAt
				},
				metadata: {
					type: "string",
					required: false,
					fieldName: options?.schema?.organization?.fields?.metadata
				},
				...options?.schema?.organization?.additionalFields || {}
			}
		},
		...organizationRoleSchema$1,
		...teamSchema$1,
		member: {
			modelName: options?.schema?.member?.modelName,
			fields: {
				organizationId: {
					type: "string",
					required: true,
					references: {
						model: "organization",
						field: "id"
					},
					fieldName: options?.schema?.member?.fields?.organizationId,
					index: true
				},
				userId: {
					type: "string",
					required: true,
					fieldName: options?.schema?.member?.fields?.userId,
					references: {
						model: "user",
						field: "id"
					},
					index: true
				},
				role: {
					type: "string",
					required: true,
					sortable: true,
					defaultValue: "member",
					fieldName: options?.schema?.member?.fields?.role
				},
				createdAt: {
					type: "date",
					required: true,
					fieldName: options?.schema?.member?.fields?.createdAt
				},
				...options?.schema?.member?.additionalFields || {}
			}
		},
		invitation: {
			modelName: options?.schema?.invitation?.modelName,
			fields: {
				organizationId: {
					type: "string",
					required: true,
					references: {
						model: "organization",
						field: "id"
					},
					fieldName: options?.schema?.invitation?.fields?.organizationId,
					index: true
				},
				email: {
					type: "string",
					required: true,
					sortable: true,
					fieldName: options?.schema?.invitation?.fields?.email,
					index: true
				},
				role: {
					type: "string",
					required: false,
					sortable: true,
					fieldName: options?.schema?.invitation?.fields?.role
				},
				...teamSupport ? { teamId: {
					type: "string",
					required: false,
					sortable: true,
					fieldName: options?.schema?.invitation?.fields?.teamId
				} } : {},
				status: {
					type: "string",
					required: true,
					sortable: true,
					defaultValue: "pending",
					fieldName: options?.schema?.invitation?.fields?.status
				},
				expiresAt: {
					type: "date",
					required: true,
					fieldName: options?.schema?.invitation?.fields?.expiresAt
				},
				createdAt: {
					type: "date",
					required: true,
					fieldName: options?.schema?.invitation?.fields?.createdAt,
					defaultValue: () => /* @__PURE__ */ new Date()
				},
				inviterId: {
					type: "string",
					references: {
						model: "user",
						field: "id"
					},
					fieldName: options?.schema?.invitation?.fields?.inviterId,
					required: true
				},
				...options?.schema?.invitation?.additionalFields || {}
			}
		}
	};
	return {
		id: "organization",
		endpoints: {
			...shimContext(endpoints, {
				orgOptions: options || {},
				roles,
				getSession: async (context) => {
					return await getSessionFromCtx(context);
				}
			}),
			hasPermission: createHasPermission(options)
		},
		schema: {
			...schema,
			session: { fields: {
				activeOrganizationId: {
					type: "string",
					required: false,
					fieldName: options?.schema?.session?.fields?.activeOrganizationId
				},
				...teamSupport ? { activeTeamId: {
					type: "string",
					required: false,
					fieldName: options?.schema?.session?.fields?.activeTeamId
				} } : {}
			} }
		},
		$Infer: {
			Organization: {},
			Invitation: {},
			Member: {},
			Team: teamSupport ? {} : {},
			TeamMember: teamSupport ? {} : {},
			ActiveOrganization: {}
		},
		$ERROR_CODES: ORGANIZATION_ERROR_CODES,
		options
	};
}

//#endregion
export { parseRoles as n, organization as t };