import { Txt } from '@/ds/components/Txt';
import { Spinner } from '@/ds/components/Spinner';

import { useAgentVersions } from '../../hooks/use-agent-versions';

interface VersionListProps {
  agentId: string;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VersionList({ agentId }: VersionListProps) {
  const { data, isLoading } = useAgentVersions({
    agentId,
    params: { sortDirection: 'DESC' },
  });

  const versions = data?.versions ?? [];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </div>
      )}

      {!isLoading && versions.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Txt variant="ui-sm" className="text-icon3">
            No versions available.
          </Txt>
        </div>
      )}

      {!isLoading &&
        versions.map(version => (
          <div key={version.id} className="flex flex-col gap-0.5 px-4 py-2 border-t border-border1">
            <Txt variant="ui-xs" font="mono" className="text-neutral3">
              Version: {version.versionNumber}
            </Txt>
            <Txt variant="ui-sm" className="text-neutral6 truncate">
              {version.instructions}
            </Txt>
            <Txt variant="ui-xs" className="text-neutral3 truncate">
              {formatTimestamp(version.createdAt)}
            </Txt>
          </div>
        ))}
    </div>
  );
}
