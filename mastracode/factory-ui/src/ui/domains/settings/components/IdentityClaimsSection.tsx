/**
 * Single searchable multi-select over every candidate account across every
 * identity-capable integration. Checking a row POSTs a claim, unchecking
 * DELETEs one. The board `@me` chip and the Cmd+K `@me` token read the same
 * claim set via `useResolvedMe`, so a change here refreshes both immediately.
 */
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useMemo, useState } from 'react';

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

const INTEGRATION_LABELS: Record<string, string> = {
  github: 'GitHub',
  linear: 'Linear',
  jira: 'Jira',
  incidentio: 'incident.io',
  slack: 'Slack',
  'platform-github': 'GitHub',
  'platform-linear': 'Linear',
  'platform-jira': 'Jira',
  'platform-incidentio': 'incident.io',
};

function integrationLabel(id: string): string {
  return INTEGRATION_LABELS[id] ?? id;
}

/** Stable composite key so `(integrationId, externalUserId)` can round-trip through Combobox's string values. */
function keyOf(integrationId: string, externalUserId: string): string {
  return `${integrationId}\u0000${externalUserId}`;
}

function parseKey(key: string): { integrationId: string; externalUserId: string } | undefined {
  const idx = key.indexOf('\u0000');
  if (idx <= 0) return undefined;
  return { integrationId: key.slice(0, idx), externalUserId: key.slice(idx + 1) };
}

export function IdentityClaimsSection() {
  const [inputValue, setInputValue] = useState('');
  const query = inputValue.trim();
  const candidatesQuery = useAllIdentityCandidatesQuery(query || undefined);
  const claimsQuery = useIdentityClaimsQuery();
  const upsert = useUpsertIdentityClaimMutation();
  const remove = useRemoveIdentityClaimMutation();

  const claims: IdentityClaim[] = claimsQuery.data ?? [];
  const candidates: IdentityCandidateAcrossIntegrations[] = candidatesQuery.data ?? [];

  // Merge server candidates with the acting user's existing claims so a claim
  // for an account no longer surfaced as a candidate (persisted from an earlier
  // session, or on an integration whose observed feed is now empty) still
  // appears — checked — in the dropdown.
  const options: ComboboxOption[] = useMemo(() => {
    const seen = new Set<string>();
    const rows: ComboboxOption[] = [];
    for (const candidate of candidates) {
      const key = keyOf(candidate.integrationId, candidate.externalUserId);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        value: key,
        label: candidate.label,
        description: `${integrationLabel(candidate.integrationId)}${candidate.email ? ` · ${candidate.email}` : ''}`,
      });
    }
    for (const claim of claims) {
      const key = keyOf(claim.integrationId, claim.externalUserId);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        value: key,
        label: claim.label,
        description: `${integrationLabel(claim.integrationId)}${claim.email ? ` · ${claim.email}` : ''}`,
      });
    }
    return rows;
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
    // Additions.
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
    // Removals.
    for (const [key, claim] of claimByKey) {
      if (next.has(key)) continue;
      remove.mutate({ integrationId: claim.integrationId, externalUserId: claim.externalUserId });
    }
  };

  if (claimsQuery.isError) {
    return (
      <Notice variant="destructive">
        {claimsQuery.error instanceof Error ? claimsQuery.error.message : 'Failed to load your identity claims'}
      </Notice>
    );
  }

  return (
    <div className="max-w-md">
      <Combobox
        multiple
        options={options}
        value={selected}
        onValueChange={onValueChange}
        onInputValueChange={setInputValue}
        placeholder="Add your accounts…"
        searchPlaceholder="Search accounts…"
        emptyText={
          candidatesQuery.isPending ? 'Loading accounts…' : 'No accounts found across your integrations.'
        }
        aria-label="Your external accounts"
        clearLabel="Clear all"
        size="md"
      />
    </div>
  );
}
