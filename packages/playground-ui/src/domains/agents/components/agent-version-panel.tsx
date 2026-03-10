import { cn } from '@/lib/utils';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';
import { useAgentVersions } from '../hooks/use-agent-versions';

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

export interface AgentVersionPanelProps {
  agentId: string;
  selectedVersionId?: string;
  onVersionSelect: (versionId: string) => void;
  activeVersionId?: string;
}

export function AgentVersionPanel({
  agentId,
  selectedVersionId,
  onVersionSelect,
  activeVersionId,
}: AgentVersionPanelProps) {
  const { data, isLoading } = useAgentVersions({
    agentId,
    params: { sortDirection: 'DESC' },
  });

  const versions = data?.versions ?? [];

  const activeVersion = activeVersionId ? versions.find(v => v.id === activeVersionId) : undefined;
  const activeVersionNumber = activeVersion?.versionNumber;

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-border1">
        <Txt variant="ui-sm" className="font-medium text-neutral5">
          Version history
        </Txt>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="px-3 py-4">
            <Txt variant="ui-xs" className="text-neutral2">
              Loading versions...
            </Txt>
          </div>
        ) : (
          <ul className="flex flex-col">
            {versions.map(version => {
              const isSelected =
                selectedVersionId === version.id || (!selectedVersionId && version.id === versions[0]?.id);
              const isPublished = version.id === activeVersionId;
              const isDraft = activeVersionNumber !== undefined && version.versionNumber > activeVersionNumber;

              return (
                <li key={version.id}>
                  <button
                    type="button"
                    onClick={() => onVersionSelect(version.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm transition-colors border-l-2',
                      isSelected
                        ? 'bg-surface2 text-neutral5 border-accent1'
                        : 'border-transparent text-neutral3 hover:bg-surface3 hover:text-neutral5',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Txt variant="ui-sm" className="text-inherit">
                        v{version.versionNumber}
                      </Txt>
                      {isPublished && <Badge variant="success">Published</Badge>}
                      {isDraft && <Badge variant="info">Draft</Badge>}
                    </div>
                    <Txt variant="ui-xs" className="text-neutral2 mt-0.5">
                      {formatTimestamp(version.createdAt)}
                    </Txt>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
