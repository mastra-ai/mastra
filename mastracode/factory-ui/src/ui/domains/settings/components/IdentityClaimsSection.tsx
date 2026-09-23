/**
 * Per-integration identity claims. For each integration that opted into the
 * capability the section renders a group with the candidate accounts
 * (external users the integration has observed in stored records, plus any
 * the user typed in manually) as design-system settings rows with checkboxes.
 * A per-integration "Save" button diffs the checkbox state against the claim
 * set and issues POST/DELETE calls; the resulting invalidations refresh
 * `useResolvedMe`, which is what the board `@me` chip and the Cmd+K `@me`
 * token consume.
 */
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Input } from '@mastra/playground-ui/components/Input';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  useIdentityCandidatesQuery,
  useIdentityClaimsQuery,
  useIdentityIntegrationsQuery,
  useRemoveIdentityClaimMutation,
  useUpsertIdentityClaimMutation,
} from '../../../../hooks/useIdentityClaims';
import type { IdentityCandidate, IdentityClaim } from '../services/identityClaims';
import { SkeletonRows } from '../../../ui/SkeletonRows';

const INTEGRATION_LABELS: Record<string, string> = {
  github: 'GitHub',
  linear: 'Linear',
  jira: 'Jira',
  incidentio: 'incident.io',
  slack: 'Slack',
  'platform-github': 'GitHub (via Platform)',
  'platform-linear': 'Linear (via Platform)',
  'platform-jira': 'Jira (via Platform)',
  'platform-incidentio': 'incident.io (via Platform)',
};

function integrationLabel(id: string): string {
  return INTEGRATION_LABELS[id] ?? id;
}

export function IdentityClaimsSection() {
  const integrationsQuery = useIdentityIntegrationsQuery();
  const claimsQuery = useIdentityClaimsQuery();

  if (integrationsQuery.isPending || claimsQuery.isPending) {
    return <SkeletonRows label="Loading identity claims" rows={2} rowClassName="h-16 w-full" />;
  }
  if (integrationsQuery.isError) {
    return (
      <Txt as="p" variant="caption" className="text-notice-destructive-fg">
        {integrationsQuery.error instanceof Error
          ? integrationsQuery.error.message
          : 'Failed to load identity integrations'}
      </Txt>
    );
  }
  if (claimsQuery.isError) {
    return (
      <Txt as="p" variant="caption" className="text-notice-destructive-fg">
        {claimsQuery.error instanceof Error ? claimsQuery.error.message : 'Failed to load your identity claims'}
      </Txt>
    );
  }

  const integrations = integrationsQuery.data ?? [];
  const claims = claimsQuery.data ?? [];

  if (integrations.length === 0) {
    return (
      <SettingsContainer>
        <SettingsRow
          label="No integrations available"
          description="Once an integration that supports identity is configured, its candidate accounts will appear here."
        />
      </SettingsContainer>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {integrations.map(integration => (
        <IntegrationClaimGroup
          key={integration.id}
          integrationId={integration.id}
          claims={claims.filter(claim => claim.integrationId === integration.id)}
        />
      ))}
    </div>
  );
}

function IntegrationClaimGroup({ integrationId, claims }: { integrationId: string; claims: IdentityClaim[] }) {
  const [expanded, setExpanded] = useState(claims.length > 0);
  const label = integrationLabel(integrationId);
  const panelId = `identity-panel-${integrationId}`;
  const summary =
    claims.length === 0
      ? 'Pick the accounts on this integration that are yours.'
      : `${claims.length} ${claims.length === 1 ? 'account' : 'accounts'} claimed.`;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="flex flex-col gap-3">
      <SettingsContainer>
        <SettingsRow
          label={
            <button
              type="button"
              onClick={() => setExpanded(current => !current)}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="focus-visible:ring-accent1 -mx-1 flex w-full items-start gap-2 rounded-md px-1 py-1 text-left outline-hidden focus-visible:ring-2"
            >
              <Chevron aria-hidden className="text-muted-foreground mt-1 size-4 shrink-0" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <Txt as="span" variant="body">
                  {label}
                </Txt>
                <Txt as="span" variant="caption" className="text-muted-foreground">
                  {summary}
                </Txt>
              </span>
            </button>
          }
        />
      </SettingsContainer>
      {expanded && (
        <div id={panelId}>
          <IntegrationClaimPanel integrationId={integrationId} claims={claims} />
        </div>
      )}
    </div>
  );
}

function IntegrationClaimPanel({ integrationId, claims }: { integrationId: string; claims: IdentityClaim[] }) {
  const [query, setQuery] = useState('');
  const [manualId, setManualId] = useState('');
  const [manualLabel, setManualLabel] = useState('');
  /**
   * Manually-typed candidates the user has added but not yet saved. They
   * live in local state (never in the server-side candidates feed) and
   * merge into `merged` alongside observed + already-claimed rows so the
   * Save-flow diff picks them up like any other checked candidate.
   */
  const [manualCandidates, setManualCandidates] = useState<IdentityCandidate[]>([]);
  const candidatesQuery = useIdentityCandidatesQuery(integrationId, query || undefined);
  const upsert = useUpsertIdentityClaimMutation();
  const remove = useRemoveIdentityClaimMutation();

  const claimedIds = useMemo(() => new Set(claims.map(claim => claim.externalUserId)), [claims]);
  const [pendingChecks, setPendingChecks] = useState<Set<string>>(claimedIds);

  useAdvanceBaselineWhenClean(claimedIds, pendingChecks, setPendingChecks);

  const candidates: IdentityCandidate[] = candidatesQuery.data ?? [];

  const merged = useMemo(() => {
    const seen = new Set<string>();
    const rows: IdentityCandidate[] = [];
    for (const candidate of candidates) {
      seen.add(candidate.externalUserId);
      rows.push(candidate);
    }
    for (const claim of claims) {
      if (seen.has(claim.externalUserId)) continue;
      seen.add(claim.externalUserId);
      rows.push({
        externalUserId: claim.externalUserId,
        label: claim.label,
        email: claim.email,
        sources: [],
      });
    }
    for (const candidate of manualCandidates) {
      if (seen.has(candidate.externalUserId)) continue;
      seen.add(candidate.externalUserId);
      rows.push(candidate);
    }
    return rows;
  }, [candidates, claims, manualCandidates]);

  const toChange = useMemo(() => diffClaims(claimedIds, pendingChecks, merged), [claimedIds, pendingChecks, merged]);
  const dirty = toChange.toClaim.length > 0 || toChange.toUnclaim.length > 0;

  const isBusy = upsert.isPending || remove.isPending;

  const onToggle = (externalUserId: string, next: boolean) => {
    setPendingChecks(current => {
      const draft = new Set(current);
      if (next) draft.add(externalUserId);
      else draft.delete(externalUserId);
      return draft;
    });
  };

  const onSave = async () => {
    for (const candidate of toChange.toClaim) {
      await upsert.mutateAsync({
        integrationId,
        externalUserId: candidate.externalUserId,
        label: candidate.label,
        email: candidate.email,
      });
    }
    for (const externalUserId of toChange.toUnclaim) {
      await remove.mutateAsync({ integrationId, externalUserId });
    }
    if (manualCandidates.length > 0) setManualCandidates([]);
  };

  const onManualAdd = () => {
    const id = manualId.trim();
    if (!id) return;
    const trimmedLabel = manualLabel.trim();
    setManualCandidates(current => {
      if (current.some(candidate => candidate.externalUserId === id)) return current;
      return [...current, { externalUserId: id, label: trimmedLabel || id, sources: [] }];
    });
    setPendingChecks(current => {
      if (current.has(id)) return current;
      const draft = new Set(current);
      draft.add(id);
      return draft;
    });
    setManualId('');
    setManualLabel('');
  };

  return (
    <div className="flex flex-col gap-3">
      <ListSearch
        label={`Search ${integrationLabel(integrationId)} accounts`}
        placeholder="Filter accounts…"
        value={query}
        onSearch={setQuery}
        size="sm"
      />

      <SettingsContainer>
        {candidatesQuery.isPending ? (
          <div className="p-2">
            <SkeletonRows label="Loading accounts" rows={3} rowClassName="h-10 w-full" />
          </div>
        ) : merged.length === 0 ? (
          <SettingsRow
            label="No accounts observed yet on this integration"
            description={`Add your ${integrationLabel(integrationId)} account below to enable the @me filter for records that reference you.`}
          />
        ) : (
          merged.map(candidate => {
            const checked = pendingChecks.has(candidate.externalUserId);
            const inputId = `identity-${integrationId}-${candidate.externalUserId}`;
            return (
              <SettingsRow
                key={candidate.externalUserId}
                label={
                  <label htmlFor={inputId} className="cursor-pointer">
                    {candidate.label}
                  </label>
                }
                description={candidate.email ?? candidate.externalUserId}
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  onCheckedChange={next => onToggle(candidate.externalUserId, next === true)}
                  aria-label={`Claim ${candidate.label}`}
                />
              </SettingsRow>
            );
          })
        )}
        <SettingsRow
          label="Add account manually"
          description={`Type the ${integrationLabel(integrationId)} account id (e.g. octocat) — useful when the account has not yet been observed.`}
        >
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={event => {
              event.preventDefault();
              onManualAdd();
            }}
          >
            <Input
              aria-label={`${integrationLabel(integrationId)} id`}
              placeholder="account id"
              size="sm"
              value={manualId}
              onChange={event => setManualId(event.target.value)}
              className="min-w-32"
            />
            <Input
              aria-label={`${integrationLabel(integrationId)} display name`}
              placeholder="display name (optional)"
              size="sm"
              value={manualLabel}
              onChange={event => setManualLabel(event.target.value)}
              className="min-w-32"
            />
            <Button type="submit" variant="ghost" size="sm" disabled={!manualId.trim() || isBusy}>
              Add
            </Button>
          </form>
        </SettingsRow>
      </SettingsContainer>

      <div className="flex items-center justify-end">
        <Button type="button" variant="primary" size="sm" onClick={onSave} disabled={!dirty || isBusy}>
          {isBusy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Advance the pending baseline to the freshly-invalidated claims set only
 * when the user has no in-progress edits on this panel — otherwise a save
 * on another integration (which invalidates the shared claims query) would
 * silently discard the checkbox changes the user is composing here.
 */
function useAdvanceBaselineWhenClean(
  claimedIds: ReadonlySet<string>,
  pendingChecks: ReadonlySet<string>,
  setPendingChecks: (next: Set<string>) => void,
): void {
  const lastBaseline = useRef(claimedIds);
  useEffect(() => {
    if (lastBaseline.current === claimedIds) return;
    // The user has no unsaved edits when their local set equals the previous
    // baseline; that also covers the same-panel post-save case (baseline just
    // became the local set, so this advances cleanly without churn).
    if (setsEqual(pendingChecks, lastBaseline.current)) {
      setPendingChecks(new Set(claimedIds));
    }
    lastBaseline.current = claimedIds;
  }, [claimedIds, pendingChecks, setPendingChecks]);
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/**
 * Diff the working checkbox state against the canonical claim set. Only
 * candidates that appear in the merged list are considered — a user cannot
 * claim an id they have not seen at least once in the panel.
 */
function diffClaims(
  claimedIds: ReadonlySet<string>,
  pending: ReadonlySet<string>,
  merged: readonly IdentityCandidate[],
): { toClaim: IdentityCandidate[]; toUnclaim: string[] } {
  const toClaim: IdentityCandidate[] = [];
  const toUnclaim: string[] = [];
  const byId = new Map(merged.map(candidate => [candidate.externalUserId, candidate]));
  for (const id of pending) {
    if (claimedIds.has(id)) continue;
    const candidate = byId.get(id);
    if (candidate) toClaim.push(candidate);
  }
  for (const id of claimedIds) {
    if (pending.has(id)) continue;
    toUnclaim.push(id);
  }
  return { toClaim, toUnclaim };
}
