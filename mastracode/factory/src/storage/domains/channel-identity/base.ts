import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/**
 * A reverse index from a platform sender identity to a Mastra tenant.
 *
 * Inbound channel events (a Slack DM, a Discord mention, ...) carry only the
 * platform-side sender ids — there is no Mastra `(orgId, userId)` on the event.
 * Model credentials, however, resolve **per-tenant**, so a channel run cannot
 * load the sender's stored model credentials until we know which tenant the
 * sender is. This domain holds that mapping: an authenticated web user links
 * their platform account, and the dispatch seam reads it back to stamp the
 * tenant onto the run's request context.
 *
 * One row per `(platform, external_team_id, external_user_id)` — the same
 * platform user in two workspaces (two team ids) is two independent links, so
 * multi-workspace falls out of the key. `platform` is generic (`'slack'` today,
 * reusable for Discord/Telegram later). The `external_` prefix disambiguates
 * the platform-side ids from the tenant ids (`org_id` / `user_id`) that cohabit
 * the row.
 */
export interface ChannelAccountLink {
  /** Undefined for personal accounts (no organization). */
  orgId?: string;
  userId: string;
  linkedAt: Date;
}

/** The reverse-lookup key: a platform sender identity. */
export interface ChannelAccountLinkKey {
  platform: string;
  externalTeamId: string;
  externalUserId: string;
}

export const CHANNEL_ACCOUNT_LINKS_SCHEMA: CollectionSchema = {
  name: 'channel_account_links',
  columns: {
    id: { type: 'uuid-pk' },
    platform: { type: 'text' },
    external_team_id: { type: 'text' },
    external_user_id: { type: 'text' },
    org_id: { type: 'text', nullable: true },
    user_id: { type: 'text' },
    linked_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    {
      name: 'channel_account_links_sender_key',
      columns: ['platform', 'external_team_id', 'external_user_id'],
    },
  ],
};

interface ChannelAccountLinkDbRow extends Record<string, unknown> {
  id: string;
  platform: string;
  external_team_id: string;
  external_user_id: string;
  org_id: string | null;
  user_id: string;
  linked_at: Date;
}

function toLink(row: ChannelAccountLinkDbRow): ChannelAccountLink {
  return {
    ...(row.org_id ? { orgId: row.org_id } : {}),
    userId: row.user_id,
    linkedAt: row.linked_at,
  };
}

export class ChannelIdentityStorage extends FactoryStorageDomain {
  constructor() {
    super('channel-identity');
  }

  async init(): Promise<void> {
    await this.ensureCollections([CHANNEL_ACCOUNT_LINKS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('channel_account_links', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /**
   * Bind a platform sender identity to a Mastra tenant. Last-write-wins: a
   * re-link (e.g. the same Slack user connecting a different tenant) replaces
   * the stored tenant and refreshes `linkedAt`.
   */
  async saveAccountLink({
    platform,
    externalTeamId,
    externalUserId,
    orgId,
    userId,
  }: ChannelAccountLinkKey & { orgId?: string; userId: string }): Promise<ChannelAccountLink> {
    const row = await this.#db.upsertOne<ChannelAccountLinkDbRow>(
      'channel_account_links',
      ['platform', 'external_team_id', 'external_user_id'],
      {
        platform,
        external_team_id: externalTeamId,
        external_user_id: externalUserId,
        org_id: orgId ?? null,
        user_id: userId,
        linked_at: new Date(),
      },
    );
    return toLink(row);
  }

  /** Resolve the tenant a platform sender is linked to, or `null` if unlinked. */
  async getAccountLink({
    platform,
    externalTeamId,
    externalUserId,
  }: ChannelAccountLinkKey): Promise<ChannelAccountLink | null> {
    const row = await this.#db.findOne<ChannelAccountLinkDbRow>('channel_account_links', {
      platform,
      external_team_id: externalTeamId,
      external_user_id: externalUserId,
    });
    return row ? toLink(row) : null;
  }

  /** Remove a platform sender's link. Returns whether a row was deleted. */
  async deleteAccountLink({ platform, externalTeamId, externalUserId }: ChannelAccountLinkKey): Promise<boolean> {
    const deleted = await this.#db.deleteMany('channel_account_links', {
      platform,
      external_team_id: externalTeamId,
      external_user_id: externalUserId,
    });
    return deleted > 0;
  }
}
