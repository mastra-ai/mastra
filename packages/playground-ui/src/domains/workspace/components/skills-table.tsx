import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { EntryList } from '@/ds/components/EntryList';
import { SkillIcon } from '@/ds/icons/SkillIcon';
import { useLinkComponent } from '@/lib/framework';
import { AlertTriangle, BookOpen, Plus } from 'lucide-react';
import type { SkillMetadata } from '../types';
import { SkillRemoveButton, SkillUpdateButton } from './skill-actions';

export interface SkillsTableProps {
  skills: SkillMetadata[];
  isLoading: boolean;
  isSkillsConfigured?: boolean;
  /** True if .agents/skills has skills that aren't being discovered */
  hasUndiscoveredAgentSkills?: boolean;
  /** Base path for skill links (should include workspaceId, e.g., /workspaces/{id}/skills) */
  basePath?: string;
  /** Callback when "Add Skill" is clicked (only shown if provided) */
  onAddSkill?: () => void;
  /** Callback when "Update" is clicked on a downloaded skill (only shown for skills with isDownloaded=true) */
  onUpdateSkill?: (skillName: string) => void;
  /** Callback when "Remove" is clicked on a downloaded skill (only shown for skills with isDownloaded=true) */
  onRemoveSkill?: (skillName: string) => void;
  /** Name of the skill currently being updated (if any) */
  updatingSkillName?: string;
  /** Name of the skill currently being removed (if any) */
  removingSkillName?: string;
  /** Mount paths for labeling skills by mount (only used when multiple mounts exist) */
  mountPaths?: string[];
}

/** Path segment that identifies skills installed via the skills CLI */
const DOWNLOADED_SKILLS_PATH = '.agents/skills/';

const columns = [
  { name: 'name', label: 'Skill', size: '1fr' },
  { name: 'description', label: 'Description', size: '2fr' },
];

const columnsWithActions = [...columns, { name: 'actions', label: '', size: '48px' }];

/**
 * Derive a mount label for a skill by matching its path against known mount paths.
 * Returns the mount path or display name if multiple mounts exist.
 */
function getMountLabel(skillPath: string | undefined, mountPaths: string[] | undefined): string | null {
  if (!skillPath || !mountPaths || mountPaths.length === 0) return null;
  for (const mp of mountPaths) {
    if (skillPath.startsWith(mp + '/') || skillPath === mp) {
      return mp;
    }
  }
  return null;
}

export function SkillsTable({
  skills,
  isLoading,
  isSkillsConfigured = true,
  hasUndiscoveredAgentSkills = false,
  basePath = '/workspace/skills',
  onAddSkill,
  onUpdateSkill,
  onRemoveSkill,
  updatingSkillName,
  removingSkillName,
  mountPaths,
}: SkillsTableProps) {
  const { navigate } = useLinkComponent();
  const showMountBadges = mountPaths && mountPaths.length > 0;

  // Helper to check if a skill is downloaded (installed via skills CLI)
  const isDownloaded = (skill: SkillMetadata) => skill.path?.includes(DOWNLOADED_SKILLS_PATH) ?? false;

  // Check if any skill is downloaded (for determining if we need the actions column)
  const hasDownloadedSkills = skills.some(isDownloaded);
  // For skeleton, assume actions column is needed if callbacks are provided
  const hasActionCallbacks = !!onRemoveSkill || !!onUpdateSkill;
  const hasRowActions = hasActionCallbacks && hasDownloadedSkills;

  const effectiveColumns = hasRowActions ? columnsWithActions : columns;

  if (!isSkillsConfigured && !isLoading) {
    return <SkillsNotConfigured onAddSkill={onAddSkill} />;
  }

  if (isLoading) {
    return <SkillsTableSkeleton hasRowActions={hasActionCallbacks} />;
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      {onAddSkill && (
        <div className="flex items-center gap-4">
          <Button variant="default" size="sm" onClick={onAddSkill}>
            <Icon>
              <Plus className="h-4 w-4" />
            </Icon>
            Add Skill
          </Button>
        </div>
      )}

      {/* Warning for undiscovered skills */}
      {hasUndiscoveredAgentSkills && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-500">Skills installed but not discovered</p>
            <p className="text-icon4 mt-1">
              You have skills in <code className="px-1 py-0.5 rounded bg-surface4 text-xs">.agents/skills</code> that
              aren&apos;t being discovered. Add this path to your workspace skills configuration to see them.
            </p>
          </div>
        </div>
      )}

      <EntryList>
        <EntryList.Trim>
          <EntryList.Header columns={effectiveColumns} />
          {skills.length > 0 ? (
            <EntryList.Entries>
              {skills.map(skill => {
                const entry = {
                  id: skill.name,
                  name: skill.name,
                  description: skill.description || '—',
                };
                const mountLabel = showMountBadges ? getMountLabel(skill.path, mountPaths) : null;

                return (
                  <EntryList.Entry
                    key={skill.name}
                    entry={entry}
                    columns={effectiveColumns}
                    onClick={() => {
                      const url = `${basePath}/${encodeURIComponent(skill.name)}`;
                      navigate(url);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-surface5">
                        <SkillIcon className="h-3.5 w-3.5 text-icon4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-icon6">{skill.name}</span>
                        {skill.path && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {mountLabel && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface4 text-icon3 shrink-0">
                                {mountLabel}
                              </span>
                            )}
                            <span className="text-[11px] text-icon3 truncate" title={skill.path}>
                              {skill.path}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <EntryList.EntryText>{skill.description || '—'}</EntryList.EntryText>
                    {hasRowActions && (
                      <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {/* Only show actions for downloaded skills */}
                        {isDownloaded(skill) && (
                          <>
                            {onUpdateSkill && (
                              <SkillUpdateButton
                                skillName={skill.name}
                                onUpdate={() => onUpdateSkill(skill.name)}
                                isUpdating={updatingSkillName === skill.name}
                              />
                            )}
                            {onRemoveSkill && (
                              <SkillRemoveButton
                                skillName={skill.name}
                                onRemove={() => onRemoveSkill(skill.name)}
                                isRemoving={removingSkillName === skill.name}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </EntryList.Entry>
                );
              })}
            </EntryList.Entries>
          ) : (
            <EntryList.Message
              message={
                onAddSkill
                  ? 'No skills discovered. Click "Add Skill" to install from skills.sh.'
                  : 'No skills discovered. Add SKILL.md files to your skills directory.'
              }
            />
          )}
        </EntryList.Trim>
      </EntryList>
    </div>
  );
}

function SkillsTableSkeleton({ hasRowActions }: { hasRowActions?: boolean }) {
  const effectiveColumns = hasRowActions ? columnsWithActions : columns;
  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={effectiveColumns} />
        <EntryList.Entries>
          {Array.from({ length: 3 }).map((_, i) => (
            <EntryList.Entry key={i} columns={effectiveColumns} isLoading>
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded bg-surface4 animate-pulse" />
                <div>
                  <div className="h-4 w-32 rounded bg-surface4 animate-pulse" />
                  <div className="h-3 w-40 rounded bg-surface4 animate-pulse mt-1" />
                </div>
              </div>
              <div className="h-4 w-48 rounded bg-surface4 animate-pulse" />
              {hasRowActions && <div className="h-4 w-6 rounded bg-surface4 animate-pulse" />}
            </EntryList.Entry>
          ))}
        </EntryList.Entries>
      </EntryList.Trim>
    </EntryList>
  );
}

interface SkillsNotConfiguredProps {
  onAddSkill?: () => void;
}

function SkillsNotConfigured({ onAddSkill }: SkillsNotConfiguredProps) {
  return (
    <div className="grid place-items-center py-16">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="p-4 rounded-full bg-surface4 mb-4">
          <SkillIcon className="h-8 w-8 text-icon3" />
        </div>
        <h2 className="text-lg font-medium text-icon6 mb-2">Skills Not Configured</h2>
        <p className="text-sm text-icon4 mb-6">
          No skills are configured in the workspace. Add SKILL.md files to your skills directory to discover and manage
          agent skills.
        </p>
        <div className="flex gap-3">
          {onAddSkill && (
            <Button size="lg" variant="default" onClick={onAddSkill}>
              <Icon>
                <Plus className="h-4 w-4" />
              </Icon>
              Add Skill from skills.sh
            </Button>
          )}
          <Button size="lg" variant="light" as="a" href="https://mastra.ai/en/docs/workspace/skills" target="_blank">
            <Icon>
              <BookOpen className="h-4 w-4" />
            </Icon>
            Learn about Skills
          </Button>
        </div>
      </div>
    </div>
  );
}

export { SkillsNotConfigured };
