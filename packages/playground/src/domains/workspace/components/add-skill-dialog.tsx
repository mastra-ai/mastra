import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { SkillIcon } from '@mastra/playground-ui/icons/SkillIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Search, Download, ExternalLink, Loader2, Package, Github, Check, Folder } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useSearchSkillsSh, usePopularSkillsSh, useSkillPreview, parseSkillSource } from '../hooks/use-skills-sh';
import type { SkillsShSkill } from '../types';

export interface WritableMount {
  path: string;
  displayName?: string;
  icon?: string;
  provider?: string;
  name?: string;
}

export interface AddSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onInstall: (params: { repository: string; skillName: string; mount?: string }) => void;
  isInstalling?: boolean;
  /**
   * Unique IDs of skills installed via skills.sh (format: "owner/repo/skillName").
   * Used for precise matching - only the exact source/skill combo shows as installed.
   */
  installedSkillIds?: string[];
  /**
   * Names of skills that are already installed (fallback when source info unavailable).
   * Skills matching by name only will show as installed regardless of source.
   */
  installedSkillNames?: string[];
  /**
   * Writable mounts available for skill installation (for CompositeFilesystem).
   * When more than one is provided, a dropdown is shown to pick the mount.
   */
  writableMounts?: WritableMount[];
  /**
   * Map of skill name to its installed path (for showing mount location on "Installed" badge).
   * Only needed when multiple mounts exist.
   */
  installedSkillPaths?: Record<string, string>;
}

/**
 * Generate a unique identifier for a skills.sh skill (for selection tracking).
 * Uses topSource + name since a repo can only have one skill with a given name.
 */
function getSkillUniqueId(skill: SkillsShSkill): string {
  return `${skill.topSource}/${skill.name}`;
}

/**
 * Generate an installed skill ID from a skills.sh skill.
 * Format: "owner/repo/skillName" - matches what we build from workspace skills with skillsShSource.
 */
function getInstalledSkillId(skill: SkillsShSkill): string | null {
  const parsed = parseSkillSource(skill.topSource, skill.name);
  if (!parsed) return null;
  return `${parsed.owner}/${parsed.repo}/${skill.name}`;
}

export function AddSkillDialog({
  open,
  onOpenChange,
  workspaceId,
  onInstall,
  isInstalling,
  installedSkillIds = [],
  installedSkillNames = [],
  writableMounts,
  installedSkillPaths,
}: AddSkillDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<SkillsShSkill | null>(null);
  const [selectedMount, setSelectedMount] = useState<string | undefined>(
    writableMounts && writableMounts.length > 0 ? writableMounts[0]?.path : undefined,
  );

  // Fetch popular skills (via server proxy)
  const { data: popularData, isLoading: isLoadingPopular } = usePopularSkillsSh(workspaceId);

  // Search mutation (via server proxy)
  const searchMutation = useSearchSkillsSh(workspaceId);

  // Parse selected skill source for install and preview URL
  const parsedSource = useMemo(() => {
    if (!selectedSkill?.topSource) return null;
    return parseSkillSource(selectedSkill.topSource, selectedSkill.name);
  }, [selectedSkill]);

  // Build agentskills.io preview URL
  const skillsUrl = useMemo(() => {
    if (!parsedSource || !selectedSkill) return null;
    return `https://skills.sh/${parsedSource.owner}/${parsedSource.repo}/${selectedSkill.name}`;
  }, [parsedSource, selectedSkill]);

  // Fetch skill preview markdown (via server proxy to skills.sh)
  const { data: previewContent, isLoading: isLoadingPreview } = useSkillPreview(
    workspaceId,
    parsedSource?.owner,
    parsedSource?.repo,
    selectedSkill?.name,
    { enabled: !!parsedSource && !!selectedSkill },
  );

  // Debounced search to reduce API calls
  const debouncedSearch = useDebouncedCallback((query: string) => {
    if (query.trim().length >= 2) {
      searchMutation.mutate(query);
    }
  }, 300);

  // Handle search input
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      debouncedSearch(query);
    },
    [debouncedSearch],
  );

  // Determine which skills to display
  // When searching (query >= 2 chars), show search results (or empty if pending/error)
  // Otherwise show popular skills
  const displaySkills = useMemo(() => {
    if (searchQuery.trim().length >= 2) {
      return searchMutation.data?.skills ?? [];
    }
    return popularData?.skills ?? [];
  }, [searchQuery, searchMutation.data, popularData]);

  const isSearching = searchMutation.isPending;
  const hasSearchResults = searchQuery.trim().length >= 2;

  // Check if selected skill is already installed
  // Check both precise IDs (for skills.sh installed skills) and names (for local/external skills)
  const isSelectedSkillInstalled = useMemo(() => {
    if (!selectedSkill) return false;

    // Check precise match (owner/repo/name) for skills.sh installed skills
    const installedId = getInstalledSkillId(selectedSkill);
    if (installedId && installedSkillIds.includes(installedId)) {
      return true;
    }

    // Check name match for local/external skills without source tracking
    if (installedSkillNames.includes(selectedSkill.name)) {
      return true;
    }

    return false;
  }, [selectedSkill, installedSkillIds, installedSkillNames]);

  // Handle install
  const handleInstall = useCallback(() => {
    if (!selectedSkill || !parsedSource) return;

    onInstall({
      repository: `${parsedSource.owner}/${parsedSource.repo}`,
      skillName: selectedSkill.name,
      mount: writableMounts && writableMounts.length > 1 ? selectedMount : undefined,
    });
  }, [selectedSkill, parsedSource, onInstall, writableMounts, selectedMount]);

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSearchQuery('');
        setSelectedSkill(null);
        setSelectedMount(writableMounts?.[0]?.path);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, writableMounts],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Add Skill</DialogTitle>
          <DialogDescription>Search and install skills from the community registry</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex max-h-none flex-1 flex-col gap-4 overflow-hidden">
          {/* Search Input */}
          <div className="relative">
            <Search className="text-neutral3 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search skills..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex min-h-0 flex-1 gap-4">
            {/* Skills List */}
            <div className="flex min-h-0 w-1/2 flex-col">
              <div className="text-neutral4 mb-2 text-xs font-medium tracking-wide uppercase">
                {hasSearchResults ? 'Search Results' : 'Popular Skills'}
              </div>
              <ScrollArea className="border-border1 flex-1 rounded-lg border">
                {isLoadingPopular || isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="text-neutral3 h-6 w-6 animate-spin" />
                  </div>
                ) : displaySkills.length === 0 ? (
                  <div className="text-neutral4 flex flex-col items-center justify-center py-8">
                    <Package className="mb-2 h-8 w-8" />
                    <p className="text-sm">{hasSearchResults ? 'No skills found' : 'No skills available'}</p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {displaySkills.map(skill => {
                      const skillUniqueId = getSkillUniqueId(skill);
                      const installedId = getInstalledSkillId(skill);
                      // Check precise match (skills.sh) OR name match (local/external)
                      const isInstalled =
                        (installedId && installedSkillIds.includes(installedId)) ||
                        installedSkillNames.includes(skill.name);
                      const selectedSkillUniqueId = selectedSkill ? getSkillUniqueId(selectedSkill) : null;
                      return (
                        <button
                          key={skillUniqueId}
                          onClick={() => setSelectedSkill(skill)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-md transition-colors',
                            'hover:bg-surface4',
                            selectedSkillUniqueId === skillUniqueId && 'bg-surface5 border border-accent1',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-neutral6 truncate text-sm font-medium">{skill.name}</span>
                                {isInstalled && (
                                  <span className="bg-accent1/20 text-accent1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
                                    <Check className="h-2.5 w-2.5" />
                                    Installed
                                  </span>
                                )}
                              </div>
                              <div className="text-neutral4 truncate text-xs">{skill.topSource}</div>
                            </div>
                            <div className="text-neutral3 flex shrink-0 items-center gap-1 text-xs">
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

            {/* Preview Panel */}
            <div className="flex min-h-0 w-1/2 flex-col">
              <div className="text-neutral4 mb-2 text-xs font-medium tracking-wide uppercase">Preview</div>
              <div className="border-border1 flex flex-1 flex-col overflow-hidden rounded-lg border">
                {!selectedSkill ? (
                  <div className="text-neutral4 flex h-full flex-col items-center justify-center">
                    <Package className="mb-2 h-8 w-8" />
                    <p className="text-sm">Select a skill to preview</p>
                  </div>
                ) : (
                  <>
                    {/* Skill Header */}
                    <div className="border-border1 bg-surface3 border-b p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-surface5 rounded-lg p-2">
                          <SkillIcon className="text-neutral4 h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-neutral6 truncate font-semibold">{selectedSkill.name}</h3>
                          <div className="text-neutral4 mt-1 flex items-center gap-3 text-xs">
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
                        {parsedSource && (
                          <a
                            href={`https://github.com/${parsedSource.owner}/${parsedSource.repo}`}
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

                    {/* Skill Content */}
                    {isLoadingPreview ? (
                      <div className="flex flex-1 items-center justify-center">
                        <Loader2 className="text-neutral3 h-6 w-6 animate-spin" />
                      </div>
                    ) : previewContent ? (
                      <ScrollArea className="flex-1">
                        <div className="p-4">
                          <MarkdownRenderer>{previewContent}</MarkdownRenderer>
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-neutral4 flex flex-1 flex-col items-center justify-center">
                        <Package className="mb-2 h-8 w-8" />
                        <p className="text-sm">Preview unavailable</p>
                        {skillsUrl && (
                          <a
                            href={skillsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent1 mt-2 flex items-center gap-1 text-xs hover:underline"
                          >
                            View on skills.sh <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Install Actions */}
          {selectedSkill && (
            <div className="border-border1 flex flex-col gap-3 border-t pt-4">
              {/* Mount picker - only shown when multiple writable mounts exist */}
              {writableMounts && writableMounts.length > 1 && (
                <div className="bg-surface3 border-border1 flex items-center gap-3 rounded-lg border p-3">
                  <Folder className="text-icon4 h-4 w-4 shrink-0" />
                  <label htmlFor="mount-select" className="text-icon5 text-sm font-medium whitespace-nowrap">
                    Install to
                  </label>
                  <select
                    id="mount-select"
                    value={selectedMount ?? ''}
                    onChange={e => setSelectedMount(e.target.value)}
                    className="border-border1 bg-surface2 text-icon6 flex-1 rounded-md border px-3 py-1.5 text-sm"
                  >
                    {writableMounts.map(m => {
                      const name = m.displayName ?? m.name ?? m.provider ?? 'unknown';
                      return (
                        <option key={m.path} value={m.path}>
                          {name} ({m.path})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                {isSelectedSkillInstalled &&
                  writableMounts &&
                  writableMounts.length > 1 &&
                  selectedSkill &&
                  installedSkillPaths?.[selectedSkill.name] &&
                  (() => {
                    const skillPath = installedSkillPaths[selectedSkill.name]!;
                    const mount = writableMounts.find(m => skillPath.startsWith(m.path + '/') || skillPath === m.path);
                    return mount ? <span className="text-icon4 text-xs">Installed at {mount.path}</span> : null;
                  })()}
                <Button variant="default" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleInstall}
                  disabled={!parsedSource || isInstalling || isSelectedSkillInstalled}
                  data-testid="install-skill-button"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Installing...
                    </>
                  ) : isSelectedSkillInstalled ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Already Installed
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
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
