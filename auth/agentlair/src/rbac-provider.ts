import type { AgentLairUser, MastraRBACAgentLairOptions } from './types';

/**
 * Maps AgentLair behavioral trust scores to Mastra RBAC roles and permissions.
 *
 * An agent earns every role whose `minScore` threshold it meets or exceeds.
 * Permissions are the union of all earned roles.
 */
export class MastraRBACAgentLair {
  private tierMapping: MastraRBACAgentLairOptions['tierMapping'];

  constructor(options: MastraRBACAgentLairOptions) {
    this.tierMapping = options.tierMapping;
  }

  async getRoles(user: AgentLairUser): Promise<string[]> {
    const score = user.trustScore ?? 0;
    return Object.entries(this.tierMapping)
      .filter(([, tier]) => score >= tier.minScore)
      .map(([role]) => role);
  }

  async hasRole(user: AgentLairUser, role: string): Promise<boolean> {
    const roles = await this.getRoles(user);
    return roles.includes(role);
  }

  async getPermissions(user: AgentLairUser): Promise<string[]> {
    const score = user.trustScore ?? 0;
    const permissions = new Set<string>();

    for (const [, tier] of Object.entries(this.tierMapping)) {
      if (score >= tier.minScore) {
        for (const perm of tier.permissions) {
          permissions.add(perm);
        }
      }
    }

    return [...permissions];
  }

  async hasPermission(user: AgentLairUser, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(user);
    return permissions.some(p => {
      if (p === permission) return true;
      // Wildcard matching: 'agents:*' matches 'agents:read'
      if (p.endsWith(':*')) {
        const prefix = p.slice(0, -1);
        return permission.startsWith(prefix);
      }
      return false;
    });
  }
}
