import { TeamRole, type Team, type TeamSettings } from '@mastra/admin';
import type { AdminServerRoute, AdminServerContext } from '../types';
import {
  teamIdParamSchema,
  userIdParamSchema,
  inviteIdParamSchema,
  successResponseSchema,
} from '../schemas/common';
import {
  teamResponseSchema,
  createTeamBodySchema,
  updateTeamBodySchema,
  teamMemberResponseSchema,
  inviteMemberBodySchema,
  teamInviteResponseSchema,
  updateMemberRoleBodySchema,
  listTeamsQuerySchema,
  listTeamMembersQuerySchema,
  listTeamInvitesQuerySchema,
} from '../schemas/teams';

/**
 * Helper to convert team to response format.
 */
function toTeamResponse(team: Team) {
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    settings: team.settings as unknown as Record<string, unknown>,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

/**
 * GET /teams - List user's teams.
 */
export const LIST_TEAMS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/teams',
  responseType: 'json',
  queryParamSchema: listTeamsQuerySchema,
  summary: 'List teams',
  description: "List all teams the authenticated user is a member of",
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const { page = 1, perPage = 20 } = params as AdminServerContext & { page?: number; perPage?: number };
    const result = await admin.listTeams(userId, { page, perPage });
    return {
      data: result.data.map(toTeamResponse),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      hasMore: result.hasMore,
    };
  },
};

/**
 * POST /teams - Create new team.
 */
export const CREATE_TEAM_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/teams',
  responseType: 'json',
  bodySchema: createTeamBodySchema,
  responseSchema: teamResponseSchema,
  summary: 'Create team',
  description: 'Create a new team. The authenticated user becomes the owner.',
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const { name, slug } = params as AdminServerContext & { name: string; slug: string };
    const team = await admin.createTeam(userId, { name, slug });
    return toTeamResponse(team);
  },
};

/**
 * GET /teams/:teamId - Get team details.
 */
export const GET_TEAM_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/teams/:teamId',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema,
  responseSchema: teamResponseSchema,
  summary: 'Get team',
  description: 'Get details of a specific team',
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const { teamId } = params as AdminServerContext & { teamId: string };
    const team = await admin.getTeam(userId, teamId);
    if (!team) {
      throw new Error('Team not found');
    }
    return toTeamResponse(team);
  },
};

/**
 * PATCH /teams/:teamId - Update team.
 */
export const UPDATE_TEAM_ROUTE: AdminServerRoute = {
  method: 'PATCH',
  path: '/teams/:teamId',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema,
  bodySchema: updateTeamBodySchema,
  responseSchema: teamResponseSchema,
  summary: 'Update team',
  description: 'Update team name or settings',
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const { teamId, name, settings } = params as AdminServerContext & {
      teamId: string;
      name?: string;
      settings?: TeamSettings;
    };
    // Get team to verify access and get current values
    const team = await admin.getTeam(userId, teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Update via storage
    const storage = admin.getStorage();
    const updated = await storage.updateTeam(teamId, {
      name: name ?? team.name,
      settings: settings ?? team.settings,
    });

    return toTeamResponse(updated);
  },
};

/**
 * DELETE /teams/:teamId - Delete team.
 */
export const DELETE_TEAM_ROUTE: AdminServerRoute = {
  method: 'DELETE',
  path: '/teams/:teamId',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema,
  responseSchema: successResponseSchema,
  summary: 'Delete team',
  description: 'Delete a team and all its projects and deployments',
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const { teamId } = params as AdminServerContext & { teamId: string };
    // Verify access
    const team = await admin.getTeam(userId, teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Delete via storage
    const storage = admin.getStorage();
    await storage.deleteTeam(teamId);

    return { success: true };
  },
};

/**
 * GET /teams/:teamId/members - List team members.
 */
export const LIST_MEMBERS_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/teams/:teamId/members',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema,
  queryParamSchema: listTeamMembersQuerySchema,
  summary: 'List team members',
  description: 'List all members of a team',
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const { teamId, page = 1, perPage = 20 } = params as AdminServerContext & {
      teamId: string;
      page?: number;
      perPage?: number;
    };
    const result = await admin.getTeamMembers(userId, teamId, { page, perPage });
    return {
      data: result.data.map(member => ({
        id: member.id,
        teamId: member.teamId,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
        user: {
          id: member.user.id,
          email: member.user.email,
          name: member.user.name,
          avatarUrl: member.user.avatarUrl,
        },
      })),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      hasMore: result.hasMore,
    };
  },
};

/**
 * POST /teams/:teamId/members - Invite member.
 */
export const INVITE_MEMBER_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/teams/:teamId/members',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema,
  bodySchema: inviteMemberBodySchema,
  responseSchema: teamInviteResponseSchema,
  summary: 'Invite member',
  description: 'Send an invitation to join the team',
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const { teamId, email, role } = params as AdminServerContext & {
      teamId: string;
      email: string;
      role: string;
    };
    const invite = await admin.inviteMember(userId, teamId, email, role as TeamRole);
    return {
      id: invite.id,
      teamId: invite.teamId,
      email: invite.email,
      role: invite.role,
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    };
  },
};

/**
 * DELETE /teams/:teamId/members/:userId - Remove member.
 */
export const REMOVE_MEMBER_ROUTE: AdminServerRoute = {
  method: 'DELETE',
  path: '/teams/:teamId/members/:userId',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema.merge(userIdParamSchema),
  responseSchema: successResponseSchema,
  summary: 'Remove member',
  description: 'Remove a member from the team',
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const p = params as AdminServerContext & { teamId: string; userId: string };
    // Note: p.userId is the member to remove, while userId from context is the acting user
    await admin.removeMember(userId, p.teamId, p.userId);
    return { success: true };
  },
};

/**
 * PATCH /teams/:teamId/members/:userId - Update member role.
 */
export const UPDATE_MEMBER_ROLE_ROUTE: AdminServerRoute = {
  method: 'PATCH',
  path: '/teams/:teamId/members/:userId',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema.merge(userIdParamSchema),
  bodySchema: updateMemberRoleBodySchema,
  responseSchema: teamMemberResponseSchema,
  summary: 'Update member role',
  description: "Update a team member's role",
  tags: ['Teams'],
  handler: async (params) => {
    const { admin } = params;
    const p = params as AdminServerContext & {
      teamId: string;
      userId: string;
      role: string;
    };
    const memberUserId = p.userId;

    // Get storage to update
    const storage = admin.getStorage();
    const updated = await storage.updateTeamMemberRole(p.teamId, memberUserId, p.role as TeamRole);
    const user = await admin.getUser(memberUserId);

    return {
      id: updated.id,
      teamId: updated.teamId,
      userId: updated.userId,
      role: updated.role,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      user: user ? {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      } : {
        id: memberUserId,
        email: '',
        name: null,
        avatarUrl: null,
      },
    };
  },
};

/**
 * GET /teams/:teamId/invites - List pending invites.
 */
export const LIST_INVITES_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/teams/:teamId/invites',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema,
  queryParamSchema: listTeamInvitesQuerySchema,
  summary: 'List invites',
  description: 'List pending team invitations',
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const { teamId, page = 1, perPage = 20 } = params as AdminServerContext & {
      teamId: string;
      page?: number;
      perPage?: number;
    };
    // Verify team access
    const team = await admin.getTeam(userId, teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    const storage = admin.getStorage();
    // listTeamInvites doesn't take pagination, so we paginate client-side
    const allInvites = await storage.listTeamInvites(teamId);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const data = allInvites.slice(start, end);

    return {
      data: data.map(invite => ({
        id: invite.id,
        teamId: invite.teamId,
        email: invite.email,
        role: invite.role,
        invitedBy: invite.invitedBy,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
      })),
      total: allInvites.length,
      page,
      perPage,
      hasMore: end < allInvites.length,
    };
  },
};

/**
 * DELETE /teams/:teamId/invites/:inviteId - Cancel invite.
 */
export const CANCEL_INVITE_ROUTE: AdminServerRoute = {
  method: 'DELETE',
  path: '/teams/:teamId/invites/:inviteId',
  responseType: 'json',
  pathParamSchema: teamIdParamSchema.merge(inviteIdParamSchema),
  responseSchema: successResponseSchema,
  summary: 'Cancel invite',
  description: 'Cancel a pending team invitation',
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const { teamId, inviteId } = params as AdminServerContext & {
      teamId: string;
      inviteId: string;
    };
    // Verify team access
    const team = await admin.getTeam(userId, teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    const storage = admin.getStorage();
    await storage.deleteTeamInvite(inviteId);

    return { success: true };
  },
};

/**
 * POST /invites/:inviteId/accept - Accept team invite.
 */
export const ACCEPT_INVITE_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/invites/:inviteId/accept',
  responseType: 'json',
  pathParamSchema: inviteIdParamSchema,
  responseSchema: teamResponseSchema,
  summary: 'Accept invite',
  description: 'Accept a team invitation and join the team',
  tags: ['Teams'],
  handler: async (params) => {
    const { admin, userId } = params;
    const { inviteId } = params as AdminServerContext & { inviteId: string };
    const storage = admin.getStorage();

    // Get the invite
    const invite = await storage.getTeamInvite(inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    // Check if invite is expired
    if (invite.expiresAt < new Date()) {
      throw new Error('Invite has expired');
    }

    // Add user to team
    await storage.addTeamMember({
      teamId: invite.teamId,
      userId,
      role: invite.role,
    });

    // Delete the invite
    await storage.deleteTeamInvite(inviteId);

    // Return the team
    const team = await storage.getTeam(invite.teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    return toTeamResponse(team);
  },
};

/**
 * All team routes.
 */
export const TEAM_ROUTES: AdminServerRoute[] = [
  LIST_TEAMS_ROUTE,
  CREATE_TEAM_ROUTE,
  GET_TEAM_ROUTE,
  UPDATE_TEAM_ROUTE,
  DELETE_TEAM_ROUTE,
  LIST_MEMBERS_ROUTE,
  INVITE_MEMBER_ROUTE,
  REMOVE_MEMBER_ROUTE,
  UPDATE_MEMBER_ROLE_ROUTE,
  LIST_INVITES_ROUTE,
  CANCEL_INVITE_ROUTE,
  ACCEPT_INVITE_ROUTE,
];
