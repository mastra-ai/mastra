import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitFork } from 'lucide-react';

import type { BranchForkMarkerData } from './build-branch-fork-markers';
import { useLinkComponent } from '@/lib/framework';

export const BranchForkMarker = ({ marker, agentId }: { marker: BranchForkMarkerData; agentId: string }) => {
  const { Link, paths } = useLinkComponent();
  const targetTitle = marker.targetTitle ?? marker.targetThreadId;
  const label = marker.kind === 'origin' ? `Branched from ${targetTitle}` : `Branch ${targetTitle} forked here`;
  const linkLabel = marker.kind === 'origin' ? 'View parent' : 'View branch';

  return (
    <div className="flex items-center gap-2 py-1" data-testid={`branch-marker-${marker.kind}`}>
      <div className="bg-border1 h-px flex-1" aria-hidden />
      <GitFork className="text-neutral3 h-3 w-3 shrink-0" aria-hidden />
      <Txt as="span" variant="ui-xs" className="text-neutral3 max-w-96 min-w-0 truncate" title={label}>
        {label}
      </Txt>
      <Link
        href={paths.agentThreadLink(agentId, marker.targetThreadId)}
        className="text-ui-xs text-neutral3 hover:text-neutral5 shrink-0 underline"
      >
        {linkLabel}
      </Link>
      <div className="bg-border1 h-px flex-1" aria-hidden />
    </div>
  );
};
