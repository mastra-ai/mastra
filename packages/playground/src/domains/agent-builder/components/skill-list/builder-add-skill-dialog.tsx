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
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Browse {registryLabel}</DialogTitle>
          <DialogDescription>
            Find a public skill from {registryLabel} and import it into your Builder skill library.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 flex flex-col gap-4 overflow-hidden max-h-none">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral3" />
            <Input
              placeholder={`Search ${registryLabel}...`}
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="pl-9"
              data-testid="builder-add-skill-search"
            />
          </div>

          <div className="flex flex-1 gap-4 min-h-0">
            {/* Skills list */}
            <div className="w-1/2 flex flex-col min-h-0">
              <div className="text-xs font-medium text-neutral4 uppercase tracking-wide mb-2">
                {hasSearchResults ? 'Search results' : 'Popular skills'}
              </div>
              <ScrollArea className="flex-1 border border-border1 rounded-lg">
                {isLoadingPopular || isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral3" />
                  </div>
                ) : displaySkills.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-neutral4">
                    <Package className="h-8 w-8 mb-2" />
                    <p className="text-sm">{hasSearchResults ? 'No skills found' : 'No skills available'}</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {displaySkills.map(skill => {
                      const skillUniqueId = getSkillUniqueId(skill);
                      const isInstalled = installedSkillIds.includes(skill.name);
                      const selectedUniqueId = selectedSkill ? getSkillUniqueId(selectedSkill) : null;
                      return (
                        <button
                          key={skillUniqueId}
                          onClick={() => setSelectedSkill(skill)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-md transition-colors',
                            'hover:bg-surface4',
                            selectedUniqueId === skillUniqueId && 'bg-surface5 border border-accent1',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-neutral6 truncate">{skill.name}</span>
                                {isInstalled && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent1/20 text-accent1">
                                    <Check className="h-2.5 w-2.5" />
                                    Installed
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-neutral4 truncate">{skill.topSource}</div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-neutral3 shrink-0">
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

            {/* Preview pane */}
            <div className="w-1/2 flex flex-col min-h-0 border border-border1 rounded-lg overflow-hidden">
              {!selectedSkill ? (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral4">
                  <Package className="h-8 w-8 mb-2" />
                  <p className="text-sm">Select a skill to preview</p>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-border1 bg-surface3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-surface5">
                        <SkillIcon className="h-5 w-5 text-neutral4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral6 truncate">{selectedSkill.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-neutral4">
                          <span className="flex items-center gap-1">
                            <Github className="h-3 w-3" />
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
                          className="text-neutral4 hover:text-neutral5 transition-colors"
                          title="View on GitHub"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {isLoadingPreview ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-neutral3" />
                    </div>
                  ) : previewContent ? (
                    <ScrollArea className="flex-1">
                      <div className="p-4">
                        <MarkdownRenderer>{previewContent}</MarkdownRenderer>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-neutral4">
                      <Package className="h-8 w-8 mb-2" />
                      <p className="text-sm">Preview unavailable</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {selectedSkill && (
            <div className="flex flex-col gap-3 pt-4 border-t border-border1">
              {installError && (
                <div className="text-sm text-red-400 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20">
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
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Installing...
                    </>
                  ) : isSelectedInstalled ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Already installed
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
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
