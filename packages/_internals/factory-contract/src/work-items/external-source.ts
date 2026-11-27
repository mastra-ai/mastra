// Browser-safe: part of @internal/factory-contract, which Factory's server and UIs share.

export interface ExternalWorkItemSource {
  integrationId: string;
  type: string;
  /**
   * The tenant on the platform, never ours: a Slack team (`T0ABC…`), a Discord
   * guild. Scopes the key, because a platform id such as a channel or a message
   * `ts` is only unique inside the workspace that issued it.
   */
  workspaceId?: string;
  externalId: string;
  url?: string;
}
