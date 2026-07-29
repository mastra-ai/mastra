import { HoverCardContent } from '@mastra/playground-ui/components/HoverCard';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CircleDot, GitBranch, GitMerge, GitPullRequest } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { relativeTime } from '../../../../lib/date/relativeTime';

export interface SessionPreviewDetails {
  kind: 'Work session' | 'Review session';
  itemLabel?: string;
  itemTitle?: string;
  branch: string;
  baseBranch: string;
  updatedAt: string;
}

function getStatusLabel(status: 'running' | 'attention' | undefined) {
  if (status === 'running') return 'Agent working';
  if (status === 'attention') return 'Agent finished';
  return undefined;
}

/** The icon carries the meaning visually, so `label` names the row for screen readers. */
function DetailRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-icon3 mt-0.5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="sr-only">{label}</span>
        {children}
      </div>
    </div>
  );
}

export function SessionPreviewCard({
  name,
  status,
  details,
}: {
  name: string;
  status?: 'running' | 'attention';
  details: SessionPreviewDetails;
}) {
  const statusLabel = getStatusLabel(status);
  const itemTitle = details.itemTitle?.trim();
  const subtitle = itemTitle && itemTitle !== name ? itemTitle : undefined;
  const updated = relativeTime(details.updatedAt);
  const ItemIcon = details.kind === 'Review session' ? GitPullRequest : CircleDot;

  return (
    <HoverCardContent
      aria-label={`${name} session details`}
      side="right"
      align="start"
      sideOffset={8}
      collisionPadding={8}
      showArrow={false}
      className="w-80 max-w-[calc(100vw-2rem)]"
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-3">
            <Txt as="p" variant="ui-sm" className="text-icon6 m-0 min-w-0 flex-1 font-medium wrap-anywhere">
              {name}
            </Txt>
            {updated && (
              <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0">
                {updated}
              </Txt>
            )}
          </div>
          <Txt as="p" variant="ui-xs" className="text-icon3 m-0">
            {statusLabel ? `${details.kind} · ${statusLabel}` : details.kind}
          </Txt>
        </div>
        <div className="flex flex-col gap-1.5">
          {(details.itemLabel || subtitle) && (
            <DetailRow icon={ItemIcon} label={details.kind === 'Review session' ? 'Pull request' : 'Work item'}>
              {details.itemLabel && (
                <Txt as="p" variant="ui-sm" className="text-icon5 m-0 truncate">
                  {details.itemLabel}
                </Txt>
              )}
              {subtitle && (
                <Txt as="p" variant="ui-xs" className="text-icon3 m-0 truncate">
                  {subtitle}
                </Txt>
              )}
            </DetailRow>
          )}
          <DetailRow icon={GitBranch} label="Branch">
            <Txt as="p" variant="ui-sm" className="text-icon5 m-0 truncate">
              {details.branch}
            </Txt>
          </DetailRow>
          <DetailRow icon={GitMerge} label="Base branch">
            <Txt as="p" variant="ui-sm" className="text-icon5 m-0 truncate">
              {details.baseBranch}
            </Txt>
          </DetailRow>
        </div>
      </div>
    </HoverCardContent>
  );
}
