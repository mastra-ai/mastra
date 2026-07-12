import type { BuilderRegistrySkillSummary } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { SkillIcon } from '@mastra/playground-ui/icons/SkillIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, Download, ExternalLink, Github, Loader2, Package, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import {
  useBuilderRegistryPreview,
  useInstallBuilderRegistrySkill,
  usePopularBuilderRegistrySkills,
  useSearchBuilderRegistry,
} from '@/domains/agent-builder/hooks/use-builder-registries';

// =============================================================================
// Helpers
// =============================================================================

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

// =============================================================================
// Component
// =============================================================================

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
      // Detect 409 from the stringified error body. The collision case is the
      // only one we need to upgrade into a navigation hint.
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Browse {registryLabel}</DialogTitle>
          <DialogDescription>
            Find a public skill from {registryLabel} and import it into your Builder skill library.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex max-h-none flex-1 flex-col gap-4 overflow-hidden">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral3" />
            <Input
              placeholder={`Search ${registryLabel}...`}
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="pl-9"
              data-testid="builder-add-skill-search"
            />
          </div>

          <div className="flex min-h-0 flex-1 gap-4">
            {/* Skills list */}
            <div className="flex min-h-0 w-1/2 flex-col">
              <div className="mb-2 text-xs font-medium tracking-wide text-neutral4 uppercase">
                {hasSearchResults ? 'Search results' : 'Popular skills'}
              </div>
              <ScrollArea className="flex-1 rounded-lg border border-border1">
                {isLoadingPopular || isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-neutral3" />
                  </div>
                ) : displaySkills.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-neutral4">
                    <Package className="mb-2 size-8" />
                    <p className="text-sm">{hasSearchResults ? 'No skills found' : 'No skills available'}</p>
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
                            'w-full rounded-md px-3 py-2 text-left transition-colors',
                            'hover:bg-surface4',
                            selectedUniqueId === skillUniqueId && 'border border-accent1 bg-surface5',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-neutral6">{skill.name}</span>
                                {isInstalled && (
                                  <span className="inline-flex items-center gap-1 rounded bg-accent1/20 px-1.5 py-0.5 text-[10px] font-medium text-accent1">
                                    <Check className="size-2.5" />
                                    Installed
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-xs text-neutral4">{skill.topSource}</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 text-xs text-neutral3">
                              <Download className="size-3" />
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

            {/* Preview pane */}
            <div className="flex min-h-0 w-1/2 flex-col overflow-hidden rounded-lg border border-border1">
              {!selectedSkill ? (
                <div className="flex flex-1 flex-col items-center justify-center text-neutral4">
                  <Package className="mb-2 size-8" />
                  <p className="text-sm">Select a skill to preview</p>
                </div>
              ) : (
                <>
                  <div className="border-b border-border1 bg-surface3 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-surface5 p-2">
                        <SkillIcon className="size-5 text-neutral4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-neutral6">{selectedSkill.name}</h3>
                        <div className="mt-1 flex items-center gap-3 text-xs text-neutral4">
                          <span className="flex items-center gap-1">
                            <Github className="size-3" />
                            {selectedSkill.topSource}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="size-3" />
                            {selectedSkill.installs.toLocaleString()} installs
                          </span>
                        </div>
                      </div>
                      {githubUrl && (
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neutral4 transition-colors hover:text-neutral5"
                          title="View on GitHub"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {isLoadingPreview ? (
                    <div className="flex flex-1 items-center justify-center">
                      <Loader2 className="size-6 animate-spin text-neutral3" />
                    </div>
                  ) : previewContent ? (
                    <ScrollArea className="flex-1">
                      <div className="p-4">
                        <MarkdownRenderer>{previewContent}</MarkdownRenderer>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center text-neutral4">
                      <Package className="mb-2 size-8" />
                      <p className="text-sm">Preview unavailable</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {selectedSkill && (
            <div className="flex flex-col gap-3 border-t border-border1 pt-4">
              {installError && (
                <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {installError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <Button variant="default" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleInstall}
                  disabled={!parsedSource || installMutation.isPending || isSelectedInstalled}
                  data-testid="builder-install-skill-button"
                >
                  {installMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Installing...
                    </>
                  ) : isSelectedInstalled ? (
                    <>
                      <Check className="mr-2 size-4" />
                      Already installed
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 size-4" />
                      Install
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
