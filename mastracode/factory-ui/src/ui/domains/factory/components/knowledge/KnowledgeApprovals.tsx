import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import {
  useKnowledgeProposal,
  useKnowledgeProposals,
  useReviewKnowledgeProposal,
} from '../../../../../hooks/useKnowledgeGraph';
import type { KnowledgeProposalStatus } from '../../services/knowledge';
import { SkeletonRows } from '../../../../ui/SkeletonRows';

function proposalStatus(value: string): KnowledgeProposalStatus | undefined {
  if (value === 'pending' || value === 'approved' || value === 'rejected' || value === 'conflicted') return value;
  return undefined;
}

export function KnowledgeApprovals({
  factoryProjectId,
  threadId,
  proposalId,
  onSelectProposal,
  onOpenNode,
}: {
  factoryProjectId: string;
  threadId?: string;
  proposalId?: string;
  onSelectProposal: (proposalId: string | undefined) => void;
  onOpenNode: (nodeId: string, name: string) => void;
}) {
  const [status, setStatus] = useState<KnowledgeProposalStatus>('pending');
  const proposals = useKnowledgeProposals(factoryProjectId, status, threadId);
  const selectedProposal = useKnowledgeProposal(factoryProjectId, proposalId, threadId);
  const review = useReviewKnowledgeProposal(factoryProjectId, threadId);

  if (proposals.isPending) return <SkeletonRows label="Loading Knowledge approvals" rows={6} />;
  if (proposals.isError) return <Notice variant="destructive">{proposals.error.message}</Notice>;
  if (selectedProposal.isError) return <Notice variant="destructive">Proposal not found.</Notice>;

  const listed = proposals.data.pages.flatMap(page => page.proposals);
  const visibleProposals = selectedProposal.data
    ? [selectedProposal.data, ...listed.filter(proposal => proposal.id !== selectedProposal.data.id)]
    : listed;

  return (
    <section aria-label="Knowledge approvals" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Select
          value={status}
          onValueChange={value => {
            setStatus(proposalStatus(value) ?? 'pending');
            onSelectProposal(undefined);
          }}
        >
          <SelectTrigger size="sm" aria-label="Proposal status" className="w-40">
            {status}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="conflicted">Conflicted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Only proposals visible from this project perspective are shown.
        </Txt>
      </div>

      {review.isError ? <Notice variant="destructive">{review.error.message}</Notice> : null}
      {visibleProposals.length === 0 ? (
        <Txt as="p" variant="ui-md" className="text-icon3 py-8">
          No {status} proposals.
        </Txt>
      ) : (
        <ol className="flex flex-col gap-3">
          {visibleProposals.map(proposal => {
            const stale = proposal.targets.some(
              target => target.currentVersion !== undefined && target.currentVersion !== target.expectedVersion,
            );
            return (
              <li key={proposal.id} className="border-surface5 bg-surface2 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Txt as="h3" variant="ui-md" className="text-icon6 font-semibold">
                        {proposal.operation}
                      </Txt>
                      <Badge size="xs">{proposal.status}</Badge>
                      {stale ? <Badge size="xs">stale</Badge> : null}
                    </div>
                    {proposal.reason ? (
                      <Txt as="p" variant="ui-sm" className="text-icon4 mt-1">
                        {proposal.reason}
                      </Txt>
                    ) : null}
                    <Txt as="p" variant="ui-sm" className="text-icon3 mt-1">
                      Proposer: {proposal.proposer}
                    </Txt>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <time className="text-icon3 text-xs" dateTime={proposal.createdAt}>
                      {new Date(proposal.createdAt).toLocaleString()}
                    </time>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-current={proposal.id === proposalId ? 'true' : undefined}
                      onClick={() => onSelectProposal(proposal.id)}
                    >
                      Open proposal
                    </Button>
                  </div>
                </div>

                <ul className="mt-3 flex flex-col gap-1" aria-label="Proposal targets">
                  {proposal.targets.map(target => (
                    <li
                      key={`${target.type}:${target.id}`}
                      className="text-icon4 flex items-center justify-between gap-3 text-sm"
                    >
                      {target.type === 'node' && target.name ? (
                        <button
                          type="button"
                          className="text-purple-300 hover:underline"
                          onClick={() => onOpenNode(target.id, target.name!)}
                        >
                          {target.name}
                        </button>
                      ) : (
                        <span>{target.type}</span>
                      )}
                      <span className="text-icon3 text-xs">
                        expected v{target.expectedVersion}
                        {target.currentVersion !== undefined ? ` · current v${target.currentVersion}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>

                {proposal.reviewReason ? (
                  <Txt as="p" variant="ui-sm" className="text-icon3 mt-3">
                    Review: {proposal.reviewReason}
                  </Txt>
                ) : null}

                {proposal.actions.includes('approve') && proposal.actions.includes('reject') ? (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ id: proposal.id, action: 'approve' })}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ id: proposal.id, action: 'reject' })}
                    >
                      Reject
                    </Button>
                  </div>
                ) : proposal.actions.includes('re-review') ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: proposal.id, action: 're-review' })}
                  >
                    Create replacement for re-review
                  </Button>
                ) : null}
              </li>
            );
          })}
          {proposals.hasNextPage ? (
            <li className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={proposals.isFetchingNextPage}
                onClick={() => void proposals.fetchNextPage()}
              >
                {proposals.isFetchingNextPage ? 'Loading proposals…' : 'Load more proposals'}
              </Button>
            </li>
          ) : null}
        </ol>
      )}
    </section>
  );
}
