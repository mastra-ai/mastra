import type { BuilderRegistrySkillSummary } from '@mastra/client-js';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { SkillIcon } from '@mastra/playground-ui/icons/SkillIcon';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, Download, ExternalLink, Loader2, Package, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import {
  useBuilderRegistryPreview,
  useInstallBuilderRegistrySkill,
  usePopularBuilderRegistrySkills,
  useSearchBuilderRegistry,
} from '@/domains/agent-builder/hooks/use-builder-registries';

/**
 * Parse a registry skill's `topSource` field to extract owner/repo. Mirrors
 * the workspace-side helper but kept private to the Builder dialog so the two
 * surfaces can evolve independently.
 *
 * Accepts:
 *   - `owner/repo`
 *   - `owner/repo/path/...`
 *   - `github.com/owner/repo/...`
 *   - `https://github.com/owner/repo/...`
 */
function parseSkillSource(topSource: string): { owner: string; repo: string } | null {
  if (!topSource) return null;
  let cleaned = topSource.replace(/^https?:\/\//, '').replace(/^github\.com\//, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0]!, repo: parts[1]! };
}

function getSkillUniqueId(skill: BuilderRegistrySkillSummary): string {
  return `${skill.topSource}/${skill.name}`;
}

export interface BuilderAddSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registryId: string;
  registryLabel: string;
  /** Stored skill ids that already exist locally (collision check). */
  installedSkillIds?: string[];
  /** Called after a successful install with the new stored skill id. */
  onInstalled?: (storedSkillId: string) => void;
  /**
   * Called when a 409 collision is detected. Receives the offending skill name
   * so the parent can navigate to or focus the existing stored skill.
   */
  onCollision?: (skillName: string) => void;
}

export function BuilderAddSkillDialog({
  open,
  onOpenChange,
  registryId,
  registryLabel,
  installedSkillIds = [],
  onInstalled,
  onCollision,
}: BuilderAddSkillDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<BuilderRegistrySkillSummary | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  const { data: popularData, isLoading: isLoadingPopular } = usePopularBuilderRegistrySkills(
    open ? registryId : undefined,
  );
  const searchMutation = useSearchBuilderRegistry(registryId);
  const installMutation = useInstallBuilderRegistrySkill(registryId);

  const parsedSource = useMemo(() => {
    if (!selectedSkill?.topSource) return null;
    return parseSkillSource(selectedSkill.topSource);
  }, [selectedSkill]);

  const { data: previewContent, isLoading: isLoadingPreview } = useBuilderRegistryPreview(
    registryId,
    parsedSource?.owner,
    parsedSource?.repo,
    selectedSkill?.name,
    { enabled: !!parsedSource && !!selectedSkill && open },
  );

  const debouncedSearch = useDebouncedCallback((query: string) => {
    if (query.trim().length >= 2) {
      searchMutation.mutate(query);
    }
  }, 300);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      debouncedSearch(query);
    },
    [debouncedSearch],
  );

  const displaySkills = useMemo(() => {
    if (searchQuery.trim().length >= 2) {
      return searchMutation.data?.skills ?? [];
    }
    return popularData?.skills ?? [];
  }, [searchQuery, searchMutation.data, popularData]);

  const isSearching = searchMutation.isPending;
  const hasSearchResults = searchQuery.trim().length >= 2;

  const isSelectedInstalled = useMemo(() => {
    if (!selectedSkill) return false;
    return installedSkillIds.includes(selectedSkill.name);
  }, [selectedSkill, installedSkillIds]);

  const githubUrl = useMemo(() => {
    if (!parsedSource) return null;
    return `https://github.com/${parsedSource.owner}/${parsedSource.repo}`;
  }, [parsedSource]);

  const handleInstall = useCallback(async () => {
    if (!selectedSkill || !parsedSource) return;
    setInstallError(null);
    try {
      const result = await installMutation.mutateAsync({
        owner: parsedSource.owner,
        repo: parsedSource.repo,
        skillName: selectedSkill.name,
      });
      onInstalled?.(result.storedSkillId);
      onOpenChange(false);
    } catch (err: any) {
      const message: string = err?.message ?? 'Install failed';
      if (/409/.test(message) || /already exists/i.test(message)) {
        onCollision?.(selectedSkill.name);
        setInstallError('A skill with this name already exists. Open the existing skill instead.');
      } else {
        setInstallError(message);
      }
    }
  }, [selectedSkill, parsedSource, installMutation, onInstalled, onOpenChange, onCollision]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setSearchQuery('');
        setSelectedSkill(null);
        setInstallError(null);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} pending={installMutation.isPending}>
      <DialogContent size="xl" className="h-[80vh]">
        <DialogHeader>
          <DialogTitle>Browse {registryLabel}</DialogTitle>
          <DialogDescription>
            Find a public skill from {registryLabel} and import it into your Builder skill library.
          </DialogDescription>
        </DialogHeader>

        <DialogBody layout="fill">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${registryLabel}...`}
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="pl-9"
              data-testid="builder-add-skill-search"
            />
          </div>

          <div className="flex min-h-0 flex-1 gap-4">
            <div className="flex min-h-0 w-1/2 flex-col">
              <div className="mb-2 text-column tracking-wide text-muted-foreground uppercase">
                {hasSearchResults ? 'Search results' : 'Popular skills'}
              </div>
              <ScrollArea className="flex-1 rounded-lg border border-border">
                {isLoadingPopular || isSearching ? (
                  <div className="flex items-center justify-center py-5">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : displaySkills.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-5 text-muted-foreground">
                    <Package className="mb-2 h-8 w-8" />
                    <Txt>{hasSearchResults ? 'No skills found' : 'No skills available'}</Txt>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {displaySkills.map(skill => {
                      const skillUniqueId = getSkillUniqueId(skill);
                      const isInstalled = installedSkillIds.includes(skill.name);
                      const selectedUniqueId = selectedSkill ? getSkillUniqueId(selectedSkill) : null;
                      return (
                        <button
                          key={skillUniqueId}
                          onClick={() => setSelectedSkill(skill)}
                          className={cn(
                            'w-full rounded-md px-3 py-2 text-left',
                            'hover:bg-fill-subtle',
                            selectedUniqueId === skillUniqueId && 'border border-border-strong bg-fill-hover',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Txt as="span" variant="subheading" tone="ink" className="truncate">
                                  {skill.name}
                                </Txt>
                                {isInstalled && (
                                  <Txt
                                    as="span"
                                    variant="meta"
                                    className="inline-flex items-center gap-1 rounded bg-info-subtle px-1.5 py-0.5 text-info-subtle-foreground"
                                  >
                                    <Check className="h-2.5 w-2.5" />
                                    Installed
                                  </Txt>
                                )}
                              </div>
                              <div className="truncate text-caption text-muted-foreground">{skill.topSource}</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
                              <Download className="h-3 w-3" />
                              <span>{skill.installs.toLocaleString()}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="flex min-h-0 w-1/2 flex-col overflow-hidden rounded-lg border border-border">
              {!selectedSkill ? (
                <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                  <Package className="mb-2 h-8 w-8" />
                  <Txt>Select a skill to preview</Txt>
                </div>
              ) : (
                <>
                  <div className="border-b border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <SkillIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Txt as="h3" variant="subheading" tone="ink" className="truncate">
                          {selectedSkill.name}
                        </Txt>
                        <div className="mt-1 flex items-center gap-3 text-caption text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <GithubIcon className="h-3 w-3" />
                            {selectedSkill.topSource}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {selectedSkill.installs.toLocaleString()} installs
                          </span>
                        </div>
                      </div>
                      {githubUrl && (
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(quietTextHover, controlStateColorTransition)}
                          title="View on GitHub"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {isLoadingPreview ? (
                    <div className="flex flex-1 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : previewContent ? (
                    <ScrollArea className="flex-1">
                      <div className="p-4">
                        <MarkdownRenderer>{previewContent}</MarkdownRenderer>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                      <Package className="mb-2 h-8 w-8" />
                      <Txt>Preview unavailable</Txt>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {installError && <Notice variant="destructive">{installError}</Notice>}
        </DialogBody>

        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction
            onConfirm={handleInstall}
            disabled={!parsedSource || isSelectedInstalled}
            data-testid="builder-install-skill-button"
          >
            {installMutation.isPending ? 'Installing...' : isSelectedInstalled ? 'Already installed' : 'Install'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
