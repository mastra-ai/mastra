import {
  useSearchSkillsSh,
  usePopularSkillsSh,
  useSkillPreview,
  parseSkillSource,
} from '@mastra/react/hooks/workspace';
import type { SkillsShSkill } from '@mastra/react/hooks/workspace';
import { Download, ExternalLink, Loader2, CircleSlashIcon, Package, Check, Folder } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
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
} from '@/ds/components/Dialog';
import { Field, FieldLabel } from '@/ds/components/Field';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import { SearchInput } from '@/ds/components/SearchInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Txt } from '@/ds/components/Txt';
import { GithubIcon } from '@/ds/icons/GithubIcon';
import { SkillIcon } from '@/ds/icons/SkillIcon';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/lib/utils';

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

export function WorkspaceAddSkillDialog({
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
  const [selectedMount, setSelectedMount] = useState<string>();
  const installMount = writableMounts?.some(mount => mount.path === selectedMount)
    ? selectedMount
    : writableMounts?.[0]?.path;

  const { data: popularData, isLoading: isLoadingPopular } = usePopularSkillsSh({
    workspaceId: workspaceId,
    queryOptions: { enabled: !!workspaceId },
  });

  const searchMutation = useSearchSkillsSh({ workspaceId: workspaceId });

  const parsedSource = useMemo(() => {
    if (!selectedSkill?.topSource) return null;
    return parseSkillSource(selectedSkill.topSource, selectedSkill.name);
  }, [selectedSkill]);

  const skillsUrl = useMemo(() => {
    if (!parsedSource || !selectedSkill) return null;
    return `https://skills.sh/${parsedSource.owner}/${parsedSource.repo}/${selectedSkill.name}`;
  }, [parsedSource, selectedSkill]);

  const { data: previewContent, isLoading: isLoadingPreview } = useSkillPreview({
    workspaceId,
    owner: parsedSource?.owner,
    repo: parsedSource?.repo,
    skillPath: selectedSkill?.name,
    queryOptions: { enabled: !!workspaceId && !!parsedSource && !!selectedSkill },
  });

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

  const isSelectedSkillInstalled = useMemo(() => {
    if (!selectedSkill) return false;

    const installedId = getInstalledSkillId(selectedSkill);
    if (installedId && installedSkillIds.includes(installedId)) {
      return true;
    }

    if (installedSkillNames.includes(selectedSkill.name)) {
      return true;
    }

    return false;
  }, [selectedSkill, installedSkillIds, installedSkillNames]);

  const handleInstall = useCallback(() => {
    if (!selectedSkill || !parsedSource) return;

    onInstall({
      repository: `${parsedSource.owner}/${parsedSource.repo}`,
      skillName: selectedSkill.name,
      mount: writableMounts && writableMounts.length > 1 ? installMount : undefined,
    });
  }, [selectedSkill, parsedSource, onInstall, writableMounts, installMount]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSearchQuery('');
        setSelectedSkill(null);
        setSelectedMount(undefined);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} pending={isInstalling}>
      <DialogContent size="xl" className="h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Skill</DialogTitle>
          <DialogDescription>Search and install skills from the community registry</DialogDescription>
        </DialogHeader>

        <DialogBody layout="fill">
          <SearchInput
            label="Search skills"
            placeholder="Search skills..."
            value={searchQuery}
            onValueChange={handleSearch}
          />

          <div className="flex min-h-0 flex-1 gap-4">
            <div className="flex min-h-0 w-1/2 flex-col">
              <Txt as="p" variant="eyebrow" tone="muted" className="mb-2">
                {hasSearchResults ? 'Search Results' : 'Popular Skills'}
              </Txt>
              <ScrollArea className="flex-1 rounded-lg border border-border">
                <ScrollAreaViewport
                  className={
                    !isLoadingPopular && !isSearching && displaySkills.length === 0
                      ? 'flex flex-col [&>div]:flex [&>div]:flex-1 [&>div]:flex-col'
                      : undefined
                  }
                >
                  {isLoadingPopular || isSearching ? (
                    <div className="flex items-center justify-center py-5">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : displaySkills.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center-safe justify-center-safe py-5 text-muted-foreground">
                      <CircleSlashIcon className="mb-2 size-8" />
                      <Txt>{hasSearchResults ? 'No skills found' : 'No skills available'}</Txt>
                    </div>
                  ) : (
                    <div className="space-y-1 p-2">
                      {displaySkills.map(skill => {
                        const skillUniqueId = getSkillUniqueId(skill);
                        const installedId = getInstalledSkillId(skill);
                        const isInstalled =
                          (installedId && installedSkillIds.includes(installedId)) ||
                          installedSkillNames.includes(skill.name);
                        const selectedSkillUniqueId = selectedSkill ? getSkillUniqueId(selectedSkill) : null;
                        return (
                          <button
                            key={skillUniqueId}
                            onClick={() => setSelectedSkill(skill)}
                            className={cn(
                              'w-full rounded-md px-3 py-2 text-left',
                              'hover:bg-fill-subtle',
                              selectedSkillUniqueId === skillUniqueId && 'border border-border-strong bg-fill-hover',
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
                                      <Check className="size-2.5" />
                                      Installed
                                    </Txt>
                                  )}
                                </div>
                                <Txt as="p" variant="caption" tone="muted" className="truncate">
                                  {skill.topSource}
                                </Txt>
                              </div>
                              <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                                <Download className="size-3" />
                                <Txt as="span" variant="caption">
                                  {skill.installs.toLocaleString()}
                                </Txt>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollAreaViewport>
              </ScrollArea>
            </div>

            <div className="flex min-h-0 w-1/2 flex-col">
              <Txt as="p" variant="eyebrow" tone="muted" className="mb-2">
                Preview
              </Txt>
              <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border">
                {!selectedSkill ? (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <Package className="mb-2 size-8" />
                    <Txt>Select a skill to preview</Txt>
                  </div>
                ) : (
                  <>
                    <div className="border-b border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          <SkillIcon className="size-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Txt as="h3" variant="subheading" tone="ink" className="truncate">
                            {selectedSkill.name}
                          </Txt>
                          <div className="mt-1 flex items-center gap-3 text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <GithubIcon className="size-3" />
                              <Txt as="span" variant="caption" className="block">
                                {selectedSkill.topSource}
                              </Txt>
                            </span>
                            <span className="flex items-center gap-1">
                              <Download className="size-3" />
                              <Txt as="span" variant="caption" className="block">
                                {selectedSkill.installs.toLocaleString()} installs
                              </Txt>
                            </span>
                          </div>
                        </div>
                        {parsedSource && (
                          <a
                            href={`https://github.com/${parsedSource.owner}/${parsedSource.repo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(quietTextHover, controlStateColorTransition)}
                            title="View on GitHub"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {isLoadingPreview ? (
                      <div className="flex flex-1 items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : previewContent ? (
                      <ScrollArea className="flex-1">
                        <div className="p-4">
                          <MarkdownRenderer>{previewContent}</MarkdownRenderer>
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                        <Package className="mb-2 size-8" />
                        <Txt>Preview unavailable</Txt>
                        {skillsUrl && (
                          <a
                            href={skillsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 flex items-center gap-1 text-info-indicator hover:underline"
                          >
                            <Txt as="span" variant="caption" className="block">
                              View on skills.sh{' '}
                            </Txt>
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {selectedSkill && writableMounts && writableMounts.length > 1 && (
            <Field orientation="horizontal" className={cn(raisedSurfaceStyle, 'gap-3 rounded-lg p-3')}>
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <FieldLabel className="whitespace-nowrap">Install to</FieldLabel>
              <Select value={installMount} onValueChange={setSelectedMount}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {writableMounts.map(m => {
                    const name = m.displayName ?? m.name ?? m.provider ?? 'unknown';
                    return (
                      <SelectItem key={m.path} value={m.path}>
                        {name} ({m.path})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>
          )}
        </DialogBody>

        {selectedSkill && (
          <DialogFooter>
            {isSelectedSkillInstalled &&
              writableMounts &&
              writableMounts.length > 1 &&
              (() => {
                const skillPath = installedSkillPaths?.[selectedSkill.name];
                if (!skillPath) return null;
                const mount = writableMounts.find(m => skillPath.startsWith(m.path + '/') || skillPath === m.path);
                return mount ? (
                  <Txt as="span" variant="caption" tone="muted" className="mr-auto">
                    Installed at {mount.path}
                  </Txt>
                ) : null;
              })()}
            <DialogCancel>Cancel</DialogCancel>
            <DialogAction
              onConfirm={handleInstall}
              disabled={!parsedSource || isSelectedSkillInstalled}
              data-testid="install-skill-button"
            >
              {isInstalling ? 'Installing...' : isSelectedSkillInstalled ? 'Already Installed' : 'Install'}
            </DialogAction>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
