import { FactoryStorageDomain } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/**
 * A tenant-scoped index from a Mastra `(orgId, userId)` to the external
 * accounts on each integration that the user has claimed as theirs.
 *
 * Where `channel-identity` maps *inbound* platform sender ids to tenants
 * (chat sender → Factory user), this domain does the inverse and generalizes
 * it to every integration: a Factory user claims which GitHub logins, Linear
 * user ids, Jira accountIds, IncidentIO user ids, or Slack member ids belong
 * to them, and downstream filter surfaces (the board's `@me` filter chip,
 * Cmd+K search, future consumers) resolve "me" by unioning the claimed
 * external ids for each `integrationId` and matching them against the
 * external-user fields on stored records.
 *
 * A user may claim multiple accounts per integration — the primary key is
 * `(org_id, user_id, integration_id, external_user_id)` — and claims are
 * per-org, so the same Factory user in two orgs is two independent claim
 * sets. Claims carry only display metadata (`label`, `email`) and never any
 * provider credentials or tokens; they are self-service assertions, not
 * verified identity binds.
 */
export interface IntegrationIdentityClaim {
  orgId: string;
  userId: string;
  integrationId: string;
  externalUserId: string;
  /** Display label shown in the settings UI (e.g. GitHub login, Linear name). */
  label: string;
  /** Provider-reported email, optional and display-only. */
  email?: string;
  claimedAt: Date;
  /**
   * How the claim came to be. Only `'self-claim'` is written today; the
   * column exists so later work (email auto-suggest, admin-imposed claim)
   * can distinguish provenance without a schema migration.
   */
  source: 'self-claim';
}

/** The primary key of a claim: which tenant claimed which external account on which integration. */
export interface IntegrationIdentityClaimKey {
  orgId: string;
  userId: string;
  integrationId: string;
  externalUserId: string;
}

/** The reverse-lookup key: which tenant users have claimed this external account. */
export interface IntegrationIdentityExternalKey {
  orgId: string;
  integrationId: string;
  externalUserId: string;
}

export const INTEGRATION_IDENTITY_CLAIMS_SCHEMA: CollectionSchema = {
  name: 'integration_identity_claims',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    user_id: { type: 'text' },
    integration_id: { type: 'text' },
    external_user_id: { type: 'text' },
    label: { type: 'text' },
    email: { type: 'text', nullable: true },
    claimed_at: { type: 'timestamp' },
    source: { type: 'text' },
  },
  uniqueIndexes: [
    {
      name: 'integration_identity_claims_key',
      columns: ['org_id', 'user_id', 'integration_id', 'external_user_id'],
    },
  ],
  indexes: [
    {
      name: 'integration_identity_claims_reverse_idx',
      columns: ['org_id', 'integration_id', 'external_user_id'],
    },
  ],
};

interface IntegrationIdentityClaimDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  user_id: string;
  integration_id: string;
  external_user_id: string;
  label: string;
  email: string | null;
  claimed_at: Date;
  source: string;
}

function toClaim(row: IntegrationIdentityClaimDbRow): IntegrationIdentityClaim {
  return {
    orgId: row.org_id,
    userId: row.user_id,
    integrationId: row.integration_id,
    externalUserId: row.external_user_id,
    label: row.label,
    ...(row.email ? { email: row.email } : {}),
    claimedAt: row.claimed_at,
    source: row.source as 'self-claim',
  };
}

export interface IntegrationIdentityUpsertInput extends IntegrationIdentityClaimKey {
  label: string;
  email?: string;
}

export class IntegrationIdentityStorage extends FactoryStorageDomain {
  constructor() {
    super('integration-identity');
  }

  async init(): Promise<void> {
    await this.ensureCollections([INTEGRATION_IDENTITY_CLAIMS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('integration_identity_claims', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /**
   * Assert (or refresh) a claim. Last-write-wins on the key: re-claiming with
   * a new `label`/`email` replaces the stored display metadata and stamps a
   * fresh `claimedAt`. Missing required fields (`label`) fail loud at the
   * boundary rather than silently persisting a blank row.
   */
  async upsert(input: IntegrationIdentityUpsertInput): Promise<IntegrationIdentityClaim> {
    if (!input.label || input.label.trim() === '') {
      throw new Error('IntegrationIdentityStorage.upsert: `label` is required and must be non-empty.');
    }
    const row = await this.#db.upsertOne<IntegrationIdentityClaimDbRow>(
      'integration_identity_claims',
      ['org_id', 'user_id', 'integration_id', 'external_user_id'],
      {
        org_id: input.orgId,
        user_id: input.userId,
        integration_id: input.integrationId,
        external_user_id: input.externalUserId,
        label: input.label,
        email: input.email ?? null,
        claimed_at: new Date(),
        source: 'self-claim',
      },
    );
    return toClaim(row);
  }

  /** All claims made by one tenant user, across all integrations. */
  async listByUser({ orgId, userId }: { orgId: string; userId: string }): Promise<IntegrationIdentityClaim[]> {
    const rows = await this.#db.findMany<IntegrationIdentityClaimDbRow>('integration_identity_claims', {
      org_id: orgId,
      user_id: userId,
    });
    return rows.map(toClaim);
  }

  /**
   * All tenant users in an org who have claimed a given external account on
   * an integration. Multiple users may claim the same external id (co-owners
   * of a service account, an admin claiming their own bot); the reverse
   * lookup returns every match rather than picking one.
   */
  async listByExternalUser({
    orgId,
    integrationId,
    externalUserId,
  }: IntegrationIdentityExternalKey): Promise<IntegrationIdentityClaim[]> {
    const rows = await this.#db.findMany<IntegrationIdentityClaimDbRow>('integration_identity_claims', {
      org_id: orgId,
      integration_id: integrationId,
      external_user_id: externalUserId,
    });
    return rows.map(toClaim);
  }

  /** Remove a claim by its full key. Returns whether a row was deleted (idempotent). */
  async remove(key: IntegrationIdentityClaimKey): Promise<boolean> {
    const deleted = await this.#db.deleteMany('integration_identity_claims', {
      org_id: key.orgId,
      user_id: key.userId,
      integration_id: key.integrationId,
      external_user_id: key.externalUserId,
    });
    return deleted > 0;
  }
}
