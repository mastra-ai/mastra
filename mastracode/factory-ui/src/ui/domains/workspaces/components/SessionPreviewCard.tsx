import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { HoverCardContent } from '@mastra/playground-ui/components/HoverCard';
import { Txt } from '@mastra/playground-ui/components/Txt';

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
  const updated = relativeTime(details.updatedAt);
  const valueClassName = 'overflow-visible text-clip whitespace-normal wrap-anywhere';

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
      <div className="flex flex-col gap-1">
        <Txt as="p" variant="ui-sm" className="text-icon6 m-0 font-medium wrap-anywhere whitespace-normal">
          {name}
        </Txt>
        <Txt as="p" variant="ui-xs" className="text-icon3 m-0">
          {statusLabel ? `${details.kind} · ${statusLabel}` : details.kind}
        </Txt>
        {details.itemLabel && (
          <Txt as="p" variant="ui-xs" className="text-icon4 m-0">
            {details.itemLabel}
          </Txt>
        )}
        {itemTitle && itemTitle !== name && (
          <Txt as="p" variant="ui-sm" className="text-icon5 m-0 wrap-anywhere whitespace-normal">
            {itemTitle}
          </Txt>
        )}
        <DataKeysAndValues className="mt-2">
          <DataKeysAndValues.Key>Branch</DataKeysAndValues.Key>
          <DataKeysAndValues.Value className={valueClassName}>{details.branch}</DataKeysAndValues.Value>
          <DataKeysAndValues.Key>Base</DataKeysAndValues.Key>
          <DataKeysAndValues.Value className={valueClassName}>{details.baseBranch}</DataKeysAndValues.Value>
          {updated && (
            <>
              <DataKeysAndValues.Key>Updated</DataKeysAndValues.Key>
              <DataKeysAndValues.Value className={valueClassName}>{updated}</DataKeysAndValues.Value>
            </>
          )}
        </DataKeysAndValues>
      </div>
    </HoverCardContent>
  );
}
