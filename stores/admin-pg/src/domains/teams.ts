import type { Team, TeamMember, TeamInvite, User, TeamRole } from '@mastra/admin';
import { AdminPgDB, TABLES } from '../db';
import type { PgDomainConfig } from './utils';
import { resolvePgConfig } from './utils';

export class TeamsPG {
  private db: AdminPgDB;

  static readonly MANAGED_TABLES = [TABLES.teams, TABLES.team_members, TABLES.team_invites, TABLES.team_installations] as const;

  constructor(config: PgDomainConfig) {
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.db = new AdminPgDB({ client, schemaName, skipDefaultIndexes });
  }

  // Team operations
  async createTeam(data: Omit<Team, 'createdAt' | 'updatedAt'>): Promise<Team> {
    return this.db.insert<Omit<Team, 'id'>>(TABLES.teams, data as unknown as Record<string, unknown>);
  }

  async getTeamById(id: string): Promise<Team | null> {
    return this.db.findById<Team>(TABLES.teams, id);
  }

  async getTeamBySlug(slug: string): Promise<Team | null> {
    return this.db.findOneBy<Team>(TABLES.teams, { slug });
  }

  async updateTeam(id: string, data: Partial<Omit<Team, 'id' | 'createdAt'>>): Promise<Team | null> {
    return this.db.update<Omit<Team, 'id'>>(TABLES.teams, id, data as unknown as Record<string, unknown>);
  }

  async deleteTeam(id: string): Promise<boolean> {
    return this.db.delete(TABLES.teams, id);
  }

  async listTeamsForUser(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: Team[]; total: number }> {
    const countSql = `
      SELECT COUNT(*) as count FROM "${this.db.schemaName}"."${TABLES.teams}" t
      INNER JOIN "${this.db.schemaName}"."${TABLES.team_members}" tm ON t.id = tm.team_id
      WHERE tm.user_id = $1
    `;
    const countResult = await this.db.db.one<{ count: string }>(countSql, [userId]);
    const total = parseInt(countResult.count, 10);

    let sql = `
      SELECT t.* FROM "${this.db.schemaName}"."${TABLES.teams}" t
      INNER JOIN "${this.db.schemaName}"."${TABLES.team_members}" tm ON t.id = tm.team_id
      WHERE tm.user_id = $1
      ORDER BY t.name
    `;

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    const data = await this.db.query<Team>(sql, [userId]);
    return { data, total };
  }

  // Team member operations
  async addTeamMember(data: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<TeamMember> {
    return this.db.insert<Omit<TeamMember, 'id'>>(TABLES.team_members, data as unknown as Record<string, unknown>);
  }

  async removeTeamMember(teamId: string, userId: string): Promise<boolean> {
    const member = await this.db.findOneBy<TeamMember>(TABLES.team_members, { teamId, userId });
    if (!member) return false;
    return this.db.delete(TABLES.team_members, member.id);
  }

  async getTeamMember(teamId: string, userId: string): Promise<TeamMember | null> {
    return this.db.findOneBy<TeamMember>(TABLES.team_members, { teamId, userId });
  }

  async listTeamMembers(
    teamId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: (TeamMember & { user: User })[]; total: number }> {
    const countSql = `
      SELECT COUNT(*) as count FROM "${this.db.schemaName}"."${TABLES.team_members}"
      WHERE team_id = $1
    `;
    const countResult = await this.db.db.one<{ count: string }>(countSql, [teamId]);
    const total = parseInt(countResult.count, 10);

    let sql = `
      SELECT
        tm.*,
        u.id as "user_id",
        u.email as "user_email",
        u.name as "user_name",
        u.avatar_url as "user_avatar_url",
        u.created_at as "user_created_at",
        u.updated_at as "user_updated_at"
      FROM "${this.db.schemaName}"."${TABLES.team_members}" tm
      INNER JOIN "${this.db.schemaName}"."${TABLES.users}" u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY tm.joined_at
    `;

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    const rows = await this.db.db.any(sql, [teamId]);
    const data = rows.map(row => ({
      id: row.id,
      teamId: row.team_id,
      userId: row.user_id,
      role: row.role as TeamRole,
      createdAt: row.joined_at,
      updatedAt: row.joined_at, // Schema doesn't have updated_at, use joined_at
      user: {
        id: row.user_id,
        email: row.user_email,
        name: row.user_name,
        avatarUrl: row.user_avatar_url,
        createdAt: row.user_created_at,
        updatedAt: row.user_updated_at,
      },
    }));

    return { data, total };
  }

  async updateTeamMemberRole(teamId: string, userId: string, role: TeamRole): Promise<TeamMember | null> {
    const member = await this.getTeamMember(teamId, userId);
    if (!member) return null;
    return this.db.update<Omit<TeamMember, 'id'>>(TABLES.team_members, member.id, { role });
  }

  // Team invite operations
  async createInvite(data: Omit<TeamInvite, 'id' | 'createdAt'> & { token?: string }): Promise<TeamInvite> {
    // Generate a unique token if not provided
    const insertData = {
      ...data,
      token: data.token ?? crypto.randomUUID(),
    };
    return this.db.insert<Omit<TeamInvite, 'id'>>(TABLES.team_invites, insertData as unknown as Record<string, unknown>);
  }

  async getInviteById(id: string): Promise<TeamInvite | null> {
    return this.db.findById<TeamInvite>(TABLES.team_invites, id);
  }

  async getInviteByEmail(teamId: string, email: string): Promise<TeamInvite | null> {
    return this.db.findOneBy<TeamInvite>(TABLES.team_invites, { teamId, email });
  }

  async listPendingInvites(teamId: string): Promise<TeamInvite[]> {
    return this.db.findBy<TeamInvite>(TABLES.team_invites, { teamId }, { orderBy: 'created_at DESC' });
  }

  async deleteInvite(id: string): Promise<boolean> {
    return this.db.delete(TABLES.team_invites, id);
  }
}
