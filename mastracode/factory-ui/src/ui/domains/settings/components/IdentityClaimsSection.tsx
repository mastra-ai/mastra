/**
 * Single searchable multi-select over every candidate account across every
 * identity-capable integration. Checking a row POSTs a claim, unchecking
 * DELETEs one. The board `@me` chip and the Cmd+K `@me` token read the same
 * claim set via `useResolvedMe`, so a change here refreshes both immediately.
 */
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMemo } from 'react';

import {
  useAllIdentityCandidatesQuery,
  useIdentityClaimsQuery,
  useRemoveIdentityClaimMutation,
  useUpsertIdentityClaimMutation,
} from '../../../../hooks/useIdentityClaims';
import type {
  IdentityCandidateAcrossIntegrations,
  IdentityClaim,
} from '../services/identityClaims';

/** Human-visible integration name and badge color, keyed by `FactoryIntegration.id`. */
const INTEGRATION_META: Record<string, { label: string; tone: BadgeVariant }> = {
  github: { label: 'GitHub', tone: 'purple' },
  linear: { label: 'Linear', tone: 'blue' },
  jira: { label: 'Jira', tone: 'blue' },
  incidentio: { label: 'incident.io', tone: 'red' },
  slack: { label: 'Slack', tone: 'yellow' },
  'platform-github': { label: 'GitHub', tone: 'purple' },
  'platform-linear': { label: 'Linear', tone: 'blue' },
  'platform-jira': { label: 'Jira', tone: 'blue' },
  'platform-incidentio': { label: 'incident.io', tone: 'red' },
};

function integrationMeta(id: string): { label: string; tone: BadgeVariant } {
  return INTEGRATION_META[id] ?? { label: id, tone: 'neutral' };
}

/** Stable composite key so `(integrationId, externalUserId)` round-trips through Combobox string values. */
function keyOf(integrationId: string, externalUserId: string): string {
  return `${integrationId}\u0000${externalUserId}`;
}

function parseKey(key: string): { integrationId: string; externalUserId: string } | undefined {
  const idx = key.indexOf('\u0000');
  if (idx <= 0) return undefined;
  return { integrationId: key.slice(0, idx), externalUserId: key.slice(idx + 1) };
}

export function IdentityClaimsSection() {
  // BaseCombobox filters options client-side against the label/description,
  // so no `?query=` round-trip is needed — the merged feed is small enough
  // to hold entirely in memory.
  const candidatesQuery = useAllIdentityCandidatesQuery();
  const claimsQuery = useIdentityClaimsQuery();
  const upsert = useUpsertIdentityClaimMutation();
  const remove = useRemoveIdentityClaimMutation();

  const claims: IdentityClaim[] = claimsQuery.data ?? [];
  const candidates: IdentityCandidateAcrossIntegrations[] = candidatesQuery.data ?? [];

  // Merge server candidates with the acting user's existing claims so a claim
  // for an account no longer surfaced as a candidate (persisted from an
  // earlier session, or on an integration whose observed feed is now empty)
  // still appears — checked — in the dropdown. Group by integration so the
  // list reads as "everything GitHub, then everything Linear, …".
  const options: ComboboxOption[] = useMemo(() => {
    interface Row {
      integrationId: string;
      externalUserId: string;
      label: string;
      email?: string;
    }
    const byKey = new Map<string, Row>();
    for (const candidate of candidates) {
      const key = keyOf(candidate.integrationId, candidate.externalUserId);
      if (!byKey.has(key)) {
        byKey.set(key, {
          integrationId: candidate.integrationId,
          externalUserId: candidate.externalUserId,
          label: candidate.label,
          email: candidate.email,
        });
      }
    }
    for (const claim of claims) {
      const key = keyOf(claim.integrationId, claim.externalUserId);
      if (!byKey.has(key)) {
        byKey.set(key, {
          integrationId: claim.integrationId,
          externalUserId: claim.externalUserId,
          label: claim.label,
          email: claim.email,
        });
      }
    }
    const rows = Array.from(byKey.values()).sort((a, b) => {
      const providerA = integrationMeta(a.integrationId).label;
      const providerB = integrationMeta(b.integrationId).label;
      const cmp = providerA.localeCompare(providerB);
      if (cmp !== 0) return cmp;
      return a.label.localeCompare(b.label);
    });
    return rows.map(row => {
      const meta = integrationMeta(row.integrationId);
      return {
        value: keyOf(row.integrationId, row.externalUserId),
        // Label reads as `"<display> · <externalUserId>"` when the display
        // and the raw id disagree; otherwise just the id. Base UI's
        // client-side filter matches against both label and description,
        // so the raw id remains searchable.
        label: row.label && row.label !== row.externalUserId ? `${row.label} · ${row.externalUserId}` : row.externalUserId,
        description: row.email ?? undefined,
        start: (
          <Badge variant={meta.tone} emphasis="muted" size="sm" className="mr-1 shrink-0">
            {meta.label}
          </Badge>
        ),
      };
    });
  }, [candidates, claims]);

  const claimByKey = useMemo(() => {
    const map = new Map<string, IdentityClaim>();
    for (const claim of claims) map.set(keyOf(claim.integrationId, claim.externalUserId), claim);
    return map;
  }, [claims]);

  const candidateByKey = useMemo(() => {
    const map = new Map<string, IdentityCandidateAcrossIntegrations>();
    for (const candidate of candidates) map.set(keyOf(candidate.integrationId, candidate.externalUserId), candidate);
    return map;
  }, [candidates]);

  const selected = useMemo(() => Array.from(claimByKey.keys()), [claimByKey]);

  const onValueChange = (nextKeys: string[]) => {
    const next = new Set(nextKeys);
    for (const key of nextKeys) {
      if (claimByKey.has(key)) continue;
      const parsed = parseKey(key);
      if (!parsed) continue;
      const source = candidateByKey.get(key);
      upsert.mutate({
        integrationId: parsed.integrationId,
        externalUserId: parsed.externalUserId,
        label: source?.label ?? parsed.externalUserId,
        email: source?.email,
      });
    }
    for (const [key, claim] of claimByKey) {
      if (next.has(key)) continue;
      remove.mutate({ integrationId: claim.integrationId, externalUserId: claim.externalUserId });
    }
  };

  const claimedGroups = useMemo(() => {
    const byIntegration = new Map<string, IdentityClaim[]>();
    for (const claim of claims) {
      const existing = byIntegration.get(claim.integrationId);
      if (existing) existing.push(claim);
      else byIntegration.set(claim.integrationId, [claim]);
    }
    return Array.from(byIntegration.entries()).sort((a, b) =>
      integrationMeta(a[0]).label.localeCompare(integrationMeta(b[0]).label),
    );
  }, [claims]);

  if (claimsQuery.isError) {
    return (
      <Notice variant="destructive">
        {claimsQuery.error instanceof Error ? claimsQuery.error.message : 'Failed to load your identity claims'}
      </Notice>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <Combobox
        multiple
        options={options}
        value={selected}
        onValueChange={onValueChange}
        placeholder={
          candidatesQuery.isPending ? 'Loading accounts…' : 'Add your accounts across integrations…'
        }
        searchPlaceholder="Search by name, id, or email…"
        emptyText={
          candidatesQuery.isError
            ? 'Could not load accounts. Refresh the page to retry.'
            : candidatesQuery.isPending
              ? 'Loading accounts…'
              : 'No accounts found. Type to search across every integration.'
        }
        aria-label="Your external accounts"
        clearLabel="Clear all"
        size="md"
      />

      {claims.length > 0 && (
        <div className="flex flex-col gap-1.5" aria-label="Claimed accounts">
          <Txt as="p" variant="caption" className="text-muted-foreground">
            Claimed accounts
          </Txt>
          <ul className="flex flex-wrap gap-1.5">
            {claimedGroups.flatMap(([integrationId, group]) =>
              group.map(claim => {
                const meta = integrationMeta(integrationId);
                const display = claim.label && claim.label !== claim.externalUserId ? claim.label : claim.externalUserId;
                return (
                  <li key={`${integrationId}:${claim.externalUserId}`}>
                    <Badge variant={meta.tone} emphasis="muted" size="sm">
                      {`${meta.label} · ${display}`}
                    </Badge>
                  </li>
                );
              }),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
