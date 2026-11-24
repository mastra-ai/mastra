import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';
import { IconTag } from '@mastra/playground-ui/icons/central/IconTag';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { useAgentVersions } from '@mastra/react/hooks/agents';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { getVersionTagNameError } from '@/domains/agents/utils/version-tags';
import type { VersionTags } from '@/domains/agents/utils/version-tags';

export interface AgentVersionPanelProps {
  agentId: string;
  selectedVersionId?: string;
  onVersionSelect: (versionId: string) => void;
  activeVersionId?: string;
  /** Tag name → version ID, from the stored agent's `metadata.versionTags`. */
  versionTags?: VersionTags;
  /** Called with the full next tag map. Omit to show tags read-only. */
  onVersionTagsChange?: (versionTags: VersionTags) => void;
  isUpdatingVersionTags?: boolean;
}

const NO_TAGS: VersionTags = {};

export function AgentVersionPanel({
  agentId,
  selectedVersionId,
  onVersionSelect,
  activeVersionId,
  versionTags = NO_TAGS,
  onVersionTagsChange,
  isUpdatingVersionTags = false,
}: AgentVersionPanelProps) {
  const { data, isLoading } = useAgentVersions({
    agentId,
    params: { orderBy: { direction: 'DESC' } },
    queryOptions: { enabled: Boolean(agentId) },
  });
  const [tagName, setTagName] = useState('');
  const [tagNameError, setTagNameError] = useState<string>();

  const versions = data?.versions ?? [];

  const activeVersion = activeVersionId ? versions.find(v => v.id === activeVersionId) : undefined;
  const activeVersionNumber = activeVersion?.versionNumber;

  // With nothing selected the editor shows the latest version, so that is the one a new tag points at.
  const targetVersion = versions.find(v => v.id === selectedVersionId) ?? versions[0];
  const tagEntries = Object.entries(versionTags).sort(([a], [b]) => a.localeCompare(b));
  const versionNumberById = new Map(versions.map(v => [v.id, v.versionNumber]));

  const handleAddTag = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onVersionTagsChange || !targetVersion) return;
    const name = tagName.trim();
    const error = getVersionTagNameError(name);
    if (error) {
      setTagNameError(error);
      return;
    }
    // Reusing a name moves that tag to the target version.
    onVersionTagsChange({ ...versionTags, [name]: targetVersion.id });
    setTagName('');
    setTagNameError(undefined);
  };

  const handleRemoveTag = (name: string) => {
    if (!onVersionTagsChange) return;
    const { [name]: _removed, ...rest } = versionTags;
    onVersionTagsChange(rest);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-3">
        <Txt variant="column" tone="ink">
          Version history
        </Txt>
      </div>

      {(onVersionTagsChange || tagEntries.length > 0) && (
        <section aria-label="Version tags" className="flex flex-col gap-2 border-b border-border px-3 py-3">
          <Txt variant="meta" tone="faint">
            Tags name a version so it can be called from the API.
          </Txt>
          {tagEntries.length > 0 && (
            <ul className="flex flex-col gap-1">
              {tagEntries.map(([name, versionId]) => {
                const versionNumber = versionNumberById.get(versionId);
                return (
                  <li key={name} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2"
                      onClick={() => onVersionSelect(versionId)}
                      aria-label={`View the version tagged ${name}`}
                    >
                      <Badge variant="neutral" icon={<IconTag />}>
                        {name}
                      </Badge>
                      <Txt variant="meta" tone="faint">
                        {versionNumber === undefined ? 'unknown version' : `v${versionNumber}`}
                      </Txt>
                    </button>
                    {onVersionTagsChange && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove tag ${name}`}
                        disabled={isUpdatingVersionTags}
                        onClick={() => handleRemoveTag(name)}
                      >
                        <IconCrossMedium />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {onVersionTagsChange && targetVersion && (
            <form onSubmit={handleAddTag} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  size="sm"
                  value={tagName}
                  onChange={event => {
                    setTagName(event.target.value);
                    setTagNameError(undefined);
                  }}
                  placeholder="production"
                  aria-label="Tag name"
                  error={Boolean(tagNameError)}
                />
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  className="shrink-0"
                  disabled={isUpdatingVersionTags || tagName.trim() === ''}
                >
                  Tag v{targetVersion.versionNumber}
                </Button>
              </div>
              {tagNameError && (
                <Txt variant="meta" role="alert" className="text-destructive-foreground">
                  {tagNameError}
                </Txt>
              )}
            </form>
          )}
        </section>
      )}

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
              const tagsOnVersion = tagEntries.filter(([, versionId]) => versionId === version.id);

              return (
                <li key={version.id}>
                  <button
                    type="button"
                    onClick={() => onVersionSelect(version.id)}
                    className={cn(
                      'text-foreground',
                      'w-full border-l-2 px-3 py-2.5 text-left',
                      controlStateColorTransition,
                      isSelected
                        ? 'border-border-strong bg-fill-hover'
                        : `border-transparent hover:bg-fill-subtle ${quietTextHover}`,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Txt variant="caption" className="text-inherit">
                        v{version.versionNumber}
                      </Txt>
                      {isPublished && <Badge variant="success">Published</Badge>}
                      {isDraft && <Badge variant="info">Draft</Badge>}
                    </div>
                    <Txt variant="meta" tone="faint" className="mt-0.5">
                      {formatDate(version.createdAt, 'date-time') ?? ''}
                    </Txt>
                    {tagsOnVersion.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {tagsOnVersion.map(([name]) => (
                          <Badge key={name} variant="neutral" size="xs" icon={<IconTag />}>
                            {name}
                          </Badge>
                        ))}
                      </div>
                    )}
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
