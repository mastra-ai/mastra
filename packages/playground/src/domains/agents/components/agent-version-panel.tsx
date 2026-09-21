import { Badge } from '@mastra/playground-ui/components/Badge';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
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
    params: { orderBy: { direction: 'DESC' } },
  });

  const versions = data?.versions ?? [];

  const activeVersion = activeVersionId ? versions.find(v => v.id === activeVersionId) : undefined;
  const activeVersionNumber = activeVersion?.versionNumber;

  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b px-3 py-3">
        <Txt variant="column" className="text-foreground">
          Version history
        </Txt>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <div className="px-3 py-4">
            <Txt variant="meta" className="text-placeholder">
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
                      'w-full text-left px-3 py-2.5 text-body border-l-2',
                      controlStateColorTransition,
                      isSelected
                        ? 'bg-fill-hover text-foreground border-accent1'
                        : `hover:bg-fill-subtle border-transparent ${quietTextHover}`,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Txt variant="caption" className="text-inherit">
                        v{version.versionNumber}
                      </Txt>
                      {isPublished && <Badge variant="green">Published</Badge>}
                      {isDraft && <Badge variant="blue">Draft</Badge>}
                    </div>
                    <Txt variant="meta" className="text-placeholder mt-0.5">
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
