/**
 * Aggregation service for integration identity claims and the `@me` filter.
 *
 * The service is the one place the HTTP routes, filter primitives, and any
 * future consumer (memory search, agent tools) resolve identity questions
 * through. It sits between the storage domain and the per-integration
 * capability so consumers stay ignorant of which integrations happen to be
 * registered: whether an integration is present, whether it opts into
 * `identity`, and whether it has a source-(b) roster are private details
 * behind these method calls.
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
   * integration — the settings UI reads this to populate initial checkbox
   * state, and the resolver builds `@me` from the same set.
   */
  async listMyClaims(orgId: string, userId: string): Promise<IntegrationIdentityClaim[]> {
    return this.#storage.listByUser({ orgId, userId });
  }

  /**
   * Ask an integration for its candidate accounts. Returns `[]` when the
   * integration isn't registered or hasn't opted into the capability rather
   * than throwing — the settings UI polls per-integration and would otherwise
   * have to special-case each missing integration in the client.
   */
  async listCandidates(orgId: string, integrationId: string, query?: string): Promise<IntegrationCandidateAccount[]> {
    const registration = this.#integrations().find(entry => entry.integration.id === integrationId);
    if (!registration || !registration.integration.identity) return [];
    return registration.integration.identity.listCandidateAccounts(registration.context, {
      orgId,
      ...(query !== undefined ? { query } : {}),
    });
  }

  /**
   * Merged candidate feed across every identity-capable integration. Each
   * result is tagged with its `integrationId` so a single-dropdown UI can
   * key the (integrationId, externalUserId) pair without a second lookup.
   * Errors from one integration do not fail the whole call — the merged
   * feed drops the failing integration and continues.
   */
  async listAllCandidates(
    orgId: string,
    query?: string,
  ): Promise<Array<IntegrationCandidateAccount & { integrationId: string }>> {
    const registrations = this.#integrations().filter(entry => Boolean(entry.integration.identity));
    const results = await Promise.all(
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
    );
    return results.flat();
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
