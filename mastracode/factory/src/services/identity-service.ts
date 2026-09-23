/**
 * Aggregation service for cross-integration user identity.
 *
 * The service is the one place the HTTP routes, filter primitives, and any
 * future consumer (memory search, agent tools) resolve identity questions
 * through. It sits between the storage domain (which tracks what the acting
 * user has claimed) and the per-integration capability (which asks the
 * provider "who's on this installation?"). Consumers stay ignorant of which
 * integrations happen to be registered and whether an integration opts into
 * `identity`: those are private details behind these method calls.
 */

import type { FactoryIntegration, IntegrationCandidateAccount, IntegrationContext } from '../integrations/base.js';
import type {
  IntegrationIdentityClaim,
  IntegrationIdentityClaimKey,
  IntegrationIdentityStorage,
} from '../storage/domains/integration-identity/base.js';

/**
 * Registration entry: an integration together with the pre-built
 * `IntegrationContext` handed to its capability calls. Mirrors the
 * `IntegrationRegistration` shape used by `assembleFactoryApiRoutes` so the
 * service can be constructed at route-assembly time from the same list.
 */
export interface IdentityServiceIntegration {
  integration: FactoryIntegration;
  context: IntegrationContext;
}

export interface IdentityServiceDeps {
  storage: IntegrationIdentityStorage;
  integrations: () => IdentityServiceIntegration[];
}

export interface IdentityIntegrationDescriptor {
  id: string;
}

export interface IdentityClaimInput {
  orgId: string;
  userId: string;
  integrationId: string;
  externalUserId: string;
  label: string;
  email?: string;
}

/**
 * Merged provider-known account across every identity-capable integration,
 * pre-tagged with the acting user's claim state. The `/web/identity` endpoint
 * returns this shape directly so the UI can render a single dropdown without
 * a second cross-reference call.
 */
export interface IntegrationIdentity extends IntegrationCandidateAccount {
  integrationId: string;
  claimed: boolean;
}

/**
 * The resolved `@me` set. Keyed by `integrationId`, each entry is the set of
 * external-user ids that identify the acting user on that integration. Empty
 * entries and absent keys mean "not me on this integration"; consumers must
 * treat both as no-match rather than as a wildcard.
 */
export type ResolvedMe = Map<string, Set<string>>;

export class IdentityService {
  readonly #storage: IntegrationIdentityStorage;
  readonly #integrations: () => IdentityServiceIntegration[];

  constructor(deps: IdentityServiceDeps) {
    this.#storage = deps.storage;
    this.#integrations = deps.integrations;
  }

  /** Every integration that opted into the identity capability, in registration order. */
  listIdentityIntegrations(): IdentityIntegrationDescriptor[] {
    return this.#integrations()
      .filter(({ integration }) => Boolean(integration.identity))
      .map(({ integration }) => ({ id: integration.id }));
  }

  /**
   * All claims the acting user has made in this org, across every
   * integration. Consumers that need only claims (the board `@me` and Cmd+K
   * `@me` expansion) use this to avoid provider round-trips.
   */
  async listMyClaims(orgId: string, userId: string): Promise<IntegrationIdentityClaim[]> {
    return this.#storage.listByUser({ orgId, userId });
  }

  /**
   * Merged provider-member feed across every identity-capable integration.
   * Every row is tagged with its `integrationId` and its `claimed` state for
   * the acting user. Errors from one integration do not fail the whole call —
   * the merged feed drops the failing integration and continues, and any
   * account the user has already claimed but the provider no longer surfaces
   * is still returned (checked) so an in-flight roster change never hides
   * one of the user's claims.
   */
  async listIdentities(orgId: string, userId: string, query?: string): Promise<IntegrationIdentity[]> {
    const registrations = this.#integrations().filter(entry => Boolean(entry.integration.identity));
    const [providerRows, claims] = await Promise.all([
      Promise.all(
        registrations.map(async registration => {
          try {
            const accounts = await registration.integration.identity!.listCandidateAccounts(registration.context, {
              orgId,
              ...(query !== undefined ? { query } : {}),
            });
            return accounts.map(account => ({ ...account, integrationId: registration.integration.id }));
          } catch {
            return [];
          }
        }),
      ),
      this.#storage.listByUser({ orgId, userId }),
    ]);
    const claimedKey = (integrationId: string, externalUserId: string) => `${integrationId}\u0000${externalUserId}`;
    const claimedByKey = new Map(claims.map(claim => [claimedKey(claim.integrationId, claim.externalUserId), claim]));
    const seen = new Set<string>();
    const merged: IntegrationIdentity[] = [];
    for (const account of providerRows.flat()) {
      const key = claimedKey(account.integrationId, account.externalUserId);
      seen.add(key);
      merged.push({ ...account, claimed: claimedByKey.has(key) });
    }
    // Any claim the provider no longer surfaces (e.g. a workspace roster
    // change since the claim was made) still needs to appear as checked so
    // the user can see and unclaim it. Skip claims whose integrationId isn't
    // registered — they'd be dangling rows.
    const registeredIds = new Set(registrations.map(r => r.integration.id));
    for (const claim of claims) {
      const key = claimedKey(claim.integrationId, claim.externalUserId);
      if (seen.has(key)) continue;
      if (!registeredIds.has(claim.integrationId)) continue;
      merged.push({
        integrationId: claim.integrationId,
        externalUserId: claim.externalUserId,
        label: claim.label,
        ...(claim.email ? { email: claim.email } : {}),
        claimed: true,
      });
    }
    return merged;
  }

  /**
   * Build the `@me` resolution set the filter primitives consume. Runs one
   * storage read for the user and buckets by integration; no per-integration
   * round-trip is required because the source of truth is the local claim
   * table, not the provider.
   */
  async resolveMe(orgId: string, userId: string): Promise<ResolvedMe> {
    const claims = await this.#storage.listByUser({ orgId, userId });
    const resolved: ResolvedMe = new Map();
    for (const claim of claims) {
      let set = resolved.get(claim.integrationId);
      if (!set) {
        set = new Set();
        resolved.set(claim.integrationId, set);
      }
      set.add(claim.externalUserId);
    }
    return resolved;
  }

  /**
   * Assert a claim. Idempotent by key — replaying with the same quadruple
   * refreshes the display metadata and `claimedAt` without duplicating rows.
   */
  async claim(input: IdentityClaimInput): Promise<IntegrationIdentityClaim> {
    return this.#storage.upsert(input);
  }

  /** Remove a claim. Returns whether a row was deleted. */
  async unclaim(key: IntegrationIdentityClaimKey): Promise<boolean> {
    return this.#storage.remove(key);
  }
}
