import { Badge } from '@mastra/playground-ui/components/Badge';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { useAgentVersions } from '../hooks/use-agent-versions';

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
      <div className="border-b border-border px-3 py-3">
        <Txt variant="column" tone="ink">
          Version history
        </Txt>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <div className="px-3 py-4">
            <Txt variant="meta" tone="faint">
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
                      'w-full border-l-2 px-3 py-2.5 text-left text-body',
                      controlStateColorTransition,
                      isSelected
                        ? 'border-accent1 bg-fill-hover text-foreground'
                        : `border-transparent hover:bg-fill-subtle ${quietTextHover}`,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Txt variant="caption" className="text-inherit">
                        v{version.versionNumber}
                      </Txt>
                      {isPublished && <Badge variant="green">Published</Badge>}
                      {isDraft && <Badge variant="blue">Draft</Badge>}
                    </div>
                    <Txt variant="meta" tone="faint" className="mt-0.5">
                      {formatDate(version.createdAt, 'date-time') ?? ''}
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
