import { useState, useCallback, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Search, Download, ExternalLink, Loader2, Package, Github, Check } from 'lucide-react';
import { SkillIcon } from '@/ds/icons/SkillIcon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { useSearchSkillsSh, usePopularSkillsSh, useSkillPreview, parseSkillSource } from '../hooks/use-skills-sh';
import type { SkillsShSkill } from '../types';

export interface AddSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onInstall: (params: { repository: string; skillName: string }) => void;
  isInstalling?: boolean;
  /** Names of skills that are already installed (to show indicator and prevent re-install) */
  installedSkillNames?: string[];
}

export function AddSkillDialog({
  open,
  onOpenChange,
  workspaceId,
  onInstall,
  isInstalling,
  installedSkillNames = [],
}: AddSkillDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<SkillsShSkill | null>(null);

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

  // Fetch skill preview HTML (via server proxy to skills.sh)
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
  const displaySkills = useMemo(() => {
    if (searchQuery.trim().length >= 2 && searchMutation.data?.skills) {
      return searchMutation.data.skills;
    }
    return popularData?.skills ?? [];
  }, [searchQuery, searchMutation.data, popularData]);

  const isSearching = searchMutation.isPending;
  const hasSearchResults = searchQuery.trim().length >= 2;

  // Check if selected skill is already installed
  const isSelectedSkillInstalled = selectedSkill ? installedSkillNames.includes(selectedSkill.name) : false;

  // Handle install
  const handleInstall = useCallback(() => {
    if (!selectedSkill || !parsedSource) return;

    onInstall({
      repository: `${parsedSource.owner}/${parsedSource.repo}`,
      skillName: selectedSkill.name,
    });
  }, [selectedSkill, parsedSource, onInstall]);

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSearchQuery('');
        setSelectedSkill(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Skill</DialogTitle>
          <DialogDescription>Search and install skills from the community registry</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 flex flex-col gap-4 overflow-hidden max-h-none">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-icon3" />
            <Input
              placeholder="Search skills..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-1 gap-4 min-h-0">
            {/* Skills List */}
            <div className="w-1/2 flex flex-col min-h-0">
              <div className="text-xs font-medium text-icon4 uppercase tracking-wide mb-2">
                {hasSearchResults ? 'Search Results' : 'Popular Skills'}
              </div>
              <ScrollArea className="flex-1 border border-border1 rounded-lg">
                {isLoadingPopular || isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-icon3" />
                  </div>
                ) : displaySkills.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-icon4">
                    <Package className="h-8 w-8 mb-2" />
                    <p className="text-sm">{hasSearchResults ? 'No skills found' : 'No skills available'}</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {displaySkills.map(skill => {
                      const isInstalled = installedSkillNames.includes(skill.name);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => setSelectedSkill(skill)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-md transition-colors',
                            'hover:bg-surface4',
                            selectedSkill?.id === skill.id && 'bg-surface5 border border-accent1',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-icon6 truncate">{skill.name}</span>
                                {isInstalled && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent1/20 text-accent1">
                                    <Check className="h-2.5 w-2.5" />
                                    Installed
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-icon4 truncate">{skill.topSource}</div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-icon3 shrink-0">
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
            <div className="w-1/2 flex flex-col min-h-0">
              <div className="text-xs font-medium text-icon4 uppercase tracking-wide mb-2">Preview</div>
              <div className="flex-1 border border-border1 rounded-lg overflow-hidden flex flex-col">
                {!selectedSkill ? (
                  <div className="flex flex-col items-center justify-center h-full text-icon4">
                    <Package className="h-8 w-8 mb-2" />
                    <p className="text-sm">Select a skill to preview</p>
                  </div>
                ) : (
                  <>
                    {/* Skill Header */}
                    <div className="p-4 border-b border-border1 bg-surface3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-surface5">
                          <SkillIcon className="h-5 w-5 text-icon4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-icon6 truncate">{selectedSkill.name}</h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-icon4">
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
                            className="text-icon4 hover:text-icon5 transition-colors"
                            title="View on GitHub"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Skill Content */}
                    {isLoadingPreview ? (
                      <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-icon3" />
                      </div>
                    ) : previewContent ? (
                      <ScrollArea className="flex-1">
                        <div className="p-4">
                          <MarkdownRenderer>{previewContent}</MarkdownRenderer>
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-icon4">
                        <Package className="h-8 w-8 mb-2" />
                        <p className="text-sm">Preview unavailable</p>
                        {skillsUrl && (
                          <a
                            href={skillsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs mt-2 text-accent1 hover:underline flex items-center gap-1"
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
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border1">
              <Button variant="light" onClick={() => handleOpenChange(false)}>
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
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Installing...
                  </>
                ) : isSelectedSkillInstalled ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Already Installed
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Install
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
