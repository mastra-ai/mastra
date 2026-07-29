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
        <Txt as="p" variant="ui-sm" className="m-0 font-medium text-icon6 whitespace-normal wrap-anywhere">
          {name}
        </Txt>
        <Txt as="p" variant="ui-xs" className="m-0 text-icon3">
          {statusLabel ? `${details.kind} · ${statusLabel}` : details.kind}
        </Txt>
        {details.itemLabel && (
          <Txt as="p" variant="ui-xs" className="m-0 text-icon4">
            {details.itemLabel}
          </Txt>
        )}
        {itemTitle && itemTitle !== name && (
          <Txt as="p" variant="ui-sm" className="m-0 text-icon5 whitespace-normal wrap-anywhere">
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
