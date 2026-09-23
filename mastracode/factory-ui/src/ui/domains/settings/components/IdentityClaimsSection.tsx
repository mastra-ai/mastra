/**
 * Single searchable multi-select over every identity across every
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
  useClaimIdentityMutation,
  useIdentityQuery,
  useUnclaimIdentityMutation,
} from '../../../../hooks/useIdentityClaims';
import type { IdentityRow } from '../services/identityClaims';

/** Human-visible integration name and badge color, keyed by `FactoryIntegration.id`. */
const INTEGRATION_META: Record<string, { label: string; tone: BadgeVariant }> = {
  github: { label: 'GitHub', tone: 'purple' },
  linear: { label: 'Linear', tone: 'blue' },
  jira: { label: 'Jira', tone: 'blue' },
  incidentio: { label: 'incident.io', tone: 'red' },
  gitlab: { label: 'GitLab', tone: 'orange' },
  slack: { label: 'Slack', tone: 'yellow' },
  'platform-github': { label: 'GitHub', tone: 'purple' },
  'platform-linear': { label: 'Linear', tone: 'blue' },
  'platform-jira': { label: 'Jira', tone: 'blue' },
  'platform-incidentio': { label: 'incident.io', tone: 'red' },
  'platform-gitlab': { label: 'GitLab', tone: 'orange' },
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
  const identityQuery = useIdentityQuery();
  const claim = useClaimIdentityMutation();
  const unclaim = useUnclaimIdentityMutation();

  const identities: IdentityRow[] = identityQuery.data?.identities ?? [];

  const rowByKey = useMemo(() => {
    const map = new Map<string, IdentityRow>();
    for (const row of identities) map.set(keyOf(row.integrationId, row.externalUserId), row);
    return map;
  }, [identities]);

  // Group by integration so the list reads as "everything GitHub, then
  // everything Linear, …". BaseCombobox filters options client-side against
  // the label + description, so the raw external id remains searchable.
  const options: ComboboxOption[] = useMemo(() => {
    const sorted = [...identities].sort((a, b) => {
      const providerA = integrationMeta(a.integrationId).label;
      const providerB = integrationMeta(b.integrationId).label;
      const cmp = providerA.localeCompare(providerB);
      if (cmp !== 0) return cmp;
      return a.label.localeCompare(b.label);
    });
    return sorted.map(row => {
      const meta = integrationMeta(row.integrationId);
      return {
        value: keyOf(row.integrationId, row.externalUserId),
        label: row.label && row.label !== row.externalUserId ? `${row.label} · ${row.externalUserId}` : row.externalUserId,
        description: row.email ?? undefined,
        start: (
          <Badge variant={meta.tone} emphasis="muted" size="sm" className="mr-1 shrink-0">
            {meta.label}
          </Badge>
        ),
      };
    });
  }, [identities]);

  const selected = useMemo(
    () => identities.filter(row => row.claimed).map(row => keyOf(row.integrationId, row.externalUserId)),
    [identities],
  );

  const onValueChange = (nextKeys: string[]) => {
    const next = new Set(nextKeys);
    const prev = new Set(selected);
    for (const key of nextKeys) {
      if (prev.has(key)) continue;
      const parsed = parseKey(key);
      if (!parsed) continue;
      const row = rowByKey.get(key);
      claim.mutate({
        integrationId: parsed.integrationId,
        externalUserId: parsed.externalUserId,
        label: row?.label ?? parsed.externalUserId,
        email: row?.email,
      });
    }
    for (const key of prev) {
      if (next.has(key)) continue;
      const parsed = parseKey(key);
      if (!parsed) continue;
      unclaim.mutate({ integrationId: parsed.integrationId, externalUserId: parsed.externalUserId });
    }
  };

  const claimedGroups = useMemo(() => {
    const byIntegration = new Map<string, IdentityRow[]>();
    for (const row of identities) {
      if (!row.claimed) continue;
      const existing = byIntegration.get(row.integrationId);
      if (existing) existing.push(row);
      else byIntegration.set(row.integrationId, [row]);
    }
    return Array.from(byIntegration.entries()).sort((a, b) =>
      integrationMeta(a[0]).label.localeCompare(integrationMeta(b[0]).label),
    );
  }, [identities]);

  if (identityQuery.isError) {
    return (
      <Notice variant="destructive">
        {identityQuery.error instanceof Error ? identityQuery.error.message : 'Failed to load your identities'}
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
        placeholder={identityQuery.isPending ? 'Loading accounts…' : 'Add your accounts across integrations…'}
        searchPlaceholder="Search by name, id, or email…"
        emptyText={
          identityQuery.isPending
            ? 'Loading accounts…'
            : 'No accounts found. Type to search across every integration.'
        }
        aria-label="Your external accounts"
        clearLabel="Clear all"
        size="md"
      />

      {claimedGroups.length > 0 && (
        <div className="flex flex-col gap-1.5" aria-label="Claimed accounts">
          <Txt as="p" variant="caption" className="text-muted-foreground">
            Claimed accounts
          </Txt>
          <ul className="flex flex-wrap gap-1.5">
            {claimedGroups.flatMap(([integrationId, group]) =>
              group.map(row => {
                const meta = integrationMeta(integrationId);
                const display = row.label && row.label !== row.externalUserId ? row.label : row.externalUserId;
                return (
                  <li key={`${integrationId}:${row.externalUserId}`}>
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
