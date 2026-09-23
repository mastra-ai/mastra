/**
 * Per-integration identity claims. For each integration that opted into the
 * capability the section renders an expander showing the candidate accounts
 * (external users the integration has observed in stored records) with
 * checkboxes populated from the acting user's current claims. A per-integration
 * "Save" button diffs the checkbox state against the claim set and issues
 * POST/DELETE calls; the resulting invalidations refresh `useResolvedMe`,
 * which is what the board `@me` chip and the Cmd+K `@me` token consume.
 */
import { Button } from '@mastra/playground-ui/components/Button';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

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
          label={
            <span className="flex flex-col gap-0.5">
              <Txt as="span" variant="body">
                No integrations available
              </Txt>
              <Txt as="span" variant="caption" className="text-icon3">
                Once an integration that supports identity is configured, its candidate accounts will appear here.
              </Txt>
            </span>
          }
        />
      </SettingsContainer>
    );
  }

  return (
    <div className="flex flex-col gap-3">
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
  const claimSummary =
    claims.length === 0 ? 'No accounts claimed' : `${claims.length} claimed`;

  return (
    <SettingsContainer>
      <SettingsRow
        label={
          <button
            type="button"
            onClick={() => setExpanded(current => !current)}
            aria-expanded={expanded}
            aria-controls={`identity-panel-${integrationId}`}
            className="flex w-full items-center gap-2 text-left"
          >
            {expanded ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
            <span className="flex flex-col gap-0.5">
              <Txt as="span" variant="body">
                {label}
              </Txt>
              <Txt as="span" variant="caption" className={claims.length > 0 ? 'text-positive1' : 'text-icon3'}>
                {claimSummary}
              </Txt>
            </span>
          </button>
        }
      />
      {expanded && (
        <div id={`identity-panel-${integrationId}`} className="border-border1 border-t p-4">
          <IntegrationClaimPanel integrationId={integrationId} claims={claims} />
        </div>
      )}
    </SettingsContainer>
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
   * Save-flow diff picks them up like any other checked candidate. This
   * keeps write-through to a single path (Save) — no dual-write race with
   * the shared claims-query invalidation.
   */
  const [manualCandidates, setManualCandidates] = useState<IdentityCandidate[]>([]);
  const candidatesQuery = useIdentityCandidatesQuery(integrationId, query || undefined);
  const upsert = useUpsertIdentityClaimMutation();
  const remove = useRemoveIdentityClaimMutation();

  const claimedIds = useMemo(() => new Set(claims.map(claim => claim.externalUserId)), [claims]);
  const [pendingChecks, setPendingChecks] = useState<Set<string>>(claimedIds);

  // Advance the working set only when the user has no in-progress edits for
  // this integration (i.e. the local set still matches the previous baseline).
  // A save elsewhere invalidates the shared claims query and re-renders us,
  // but we must not silently discard checkbox changes the user is composing
  // on this panel — that also covers the same-panel post-save case (after a
  // successful save the new baseline equals the local set, so this advances
  // cleanly without churning the checkboxes).
  useAdvanceBaselineWhenClean(claimedIds, pendingChecks, setPendingChecks);

  const candidates: IdentityCandidate[] = candidatesQuery.data ?? [];

  // Merge order: observed candidates from the server, then existing claims
  // not covered by the observed feed (persisted from an earlier session),
  // then manual-add rows the user just typed in this session (not saved
  // yet). All three surface as regular candidates so the Save-flow diff
  // treats them uniformly.
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
    // Manual candidates that landed as real claims are now covered by
    // `claims` on the next refetch; drop the local shadow list so it
    // doesn't accumulate.
    if (manualCandidates.length > 0) setManualCandidates([]);
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

      {candidatesQuery.isPending ? (
        <SkeletonRows label="Loading accounts" rows={3} rowClassName="h-10 w-full" />
      ) : merged.length === 0 ? (
        <Txt as="p" variant="caption" className="text-icon3">
          No accounts observed yet on this integration. Add your account id below to enable the <code>@me</code> filter
          for records that reference you.
        </Txt>
      ) : (
        <ul aria-label={`${integrationLabel(integrationId)} accounts`} className="flex flex-col gap-1">
          {merged.map(candidate => {
            const checked = pendingChecks.has(candidate.externalUserId);
            const inputId = `identity-${integrationId}-${candidate.externalUserId}`;
            return (
              <li key={candidate.externalUserId} className="hover:bg-surface4 flex items-center gap-3 rounded-md p-2">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={checked}
                  onChange={event => onToggle(candidate.externalUserId, event.target.checked)}
                />
                <label htmlFor={inputId} className="flex flex-1 flex-col gap-0.5">
                  <Txt as="span" variant="body">
                    {candidate.label}
                  </Txt>
                  {candidate.email && (
                    <Txt as="span" variant="caption" className="text-icon3">
                      {candidate.email}
                    </Txt>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-border1 flex flex-col gap-2 border-t pt-3">
        <Txt as="p" variant="caption" className="text-icon3">
          Add an account by its {integrationLabel(integrationId)} id (e.g. <code>octocat</code> for GitHub).
        </Txt>
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label={`${integrationLabel(integrationId)} id`}
            placeholder="account id"
            value={manualId}
            onChange={event => setManualId(event.target.value)}
            className="bg-surface3 border-border1 text-ui-sm h-8 min-w-32 flex-1 rounded-md border px-2"
          />
          <input
            aria-label={`${integrationLabel(integrationId)} display name`}
            placeholder="display name (optional)"
            value={manualLabel}
            onChange={event => setManualLabel(event.target.value)}
            className="bg-surface3 border-border1 text-ui-sm h-8 min-w-32 flex-1 rounded-md border px-2"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const id = manualId.trim();
              if (!id) return;
              // Push a synthetic candidate and check it. The row now
              // renders in the candidate list marked as pending; the
              // existing Save flow will POST it as a claim.
              setManualCandidates(current => {
                if (current.some(candidate => candidate.externalUserId === id)) return current;
                return [
                  ...current,
                  { externalUserId: id, label: manualLabel.trim() || id, sources: [] },
                ];
              });
              setPendingChecks(current => {
                if (current.has(id)) return current;
                const draft = new Set(current);
                draft.add(id);
                return draft;
              });
              setManualId('');
              setManualLabel('');
            }}
            disabled={!manualId.trim() || isBusy}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="primary" size="sm" onClick={onSave} disabled={!dirty || isBusy}>
          {isBusy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
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
    if (!claimedIds.has(id)) {
      const candidate = byId.get(id);
      if (candidate) toClaim.push(candidate);
    }
  }
  for (const id of claimedIds) {
    if (!pending.has(id)) toUnclaim.push(id);
  }
  return { toClaim, toUnclaim };
}

/**
 * When the shared claims query resolves with a new baseline, advance the
 * working checkbox set to it — but only if the user has no in-progress
 * edits on this panel. A save on a different integration invalidates the
 * shared claims query too; without this guard, the invalidation would
 * blow away unsaved checkbox changes here.
 *
 * Uses a stable key comparison so the baseline-set identity churn from
 * every refetch doesn't cause re-runs.
 */
function useAdvanceBaselineWhenClean(
  claimedIds: ReadonlySet<string>,
  pending: ReadonlySet<string>,
  setPending: (next: Set<string>) => void,
) {
  const newBaselineKey = setKey(claimedIds);
  const [previousBaselineKey, setPreviousBaselineKey] = useState(newBaselineKey);
  if (previousBaselineKey !== newBaselineKey) {
    setPreviousBaselineKey(newBaselineKey);
    // Only reseed when the local set matches the *previous* baseline: that
    // means the user hasn't changed anything on this panel and it's safe to
    // move them forward. If they have unsaved changes, keep them intact.
    if (setKey(pending) === previousBaselineKey) {
      setPending(new Set(claimedIds));
    }
  }
}

function setKey(set: ReadonlySet<string>): string {
  return [...set].sort().join('\u0000');
}
