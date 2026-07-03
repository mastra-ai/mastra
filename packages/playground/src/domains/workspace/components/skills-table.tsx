import { Button } from '@mastra/playground-ui/components/Button';
import { DataList, DataListSkeleton } from '@mastra/playground-ui/components/DataList';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { SkillIcon } from '@mastra/playground-ui/icons/SkillIcon';
import { AlertTriangle, BookOpen, Plus } from 'lucide-react';
import type { SkillMetadata } from '../types';
import { SkillRemoveButton, SkillUpdateButton } from './skill-actions';
import { useLinkComponent } from '@/lib/framework';

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
}

/** Path segment that identifies skills installed via the skills CLI */
const DOWNLOADED_SKILLS_PATH = '.agents/skills/';

const baseColumns = [
  { label: 'Skill', size: 'minmax(8rem,auto)' },
  { label: 'Path', size: 'minmax(8rem,1fr)' },
  { label: 'Description', size: 'minmax(0,2fr)' },
] as const;

const columnsWithActions = [...baseColumns, { label: '', size: 'auto' }] as const;

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
}: SkillsTableProps) {
  const { navigate } = useLinkComponent();

  const isDownloaded = (skill: SkillMetadata) => skill.path?.includes(DOWNLOADED_SKILLS_PATH) ?? false;
  const hasActionCallbacks = !!onRemoveSkill || !!onUpdateSkill;
  const activeColumns = hasActionCallbacks ? columnsWithActions : baseColumns;
  const gridColumns = activeColumns.map(c => c.size).join(' ');

  if (!isSkillsConfigured && !isLoading) {
    return <SkillsNotConfigured onAddSkill={onAddSkill} />;
  }

  if (isLoading) {
    return <DataListSkeleton columns={gridColumns} />;
  }

  return (
    <div className="space-y-4">
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

      {hasUndiscoveredAgentSkills && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-500">Skills installed but not discovered</p>
            <p className="text-neutral4 mt-1">
              You have skills in <code className="px-1 py-0.5 rounded bg-surface4 text-xs">.agents/skills</code> that
              aren&apos;t being discovered. Add this path to your workspace skills configuration to see them.
            </p>
          </div>
        </div>
      )}

      <DataList columns={gridColumns}>
        <DataList.Top>
          {activeColumns.map(col => (
            <DataList.TopCell key={col.label}>{col.label}</DataList.TopCell>
          ))}
        </DataList.Top>

        {skills.length === 0 ? (
          <DataList.NoMatch
            message={
              onAddSkill
                ? 'No skills discovered. Click "Add Skill" to install from skills.sh.'
                : 'No skills discovered. Add SKILL.md files to your skills directory.'
            }
          />
        ) : (
          skills.map(skill => {
            const onClick = () => {
              navigate(`${basePath}/${encodeURIComponent(skill.name)}?path=${encodeURIComponent(skill.path)}`);
            };

            const rowContent = (
              <>
                <DataList.Cell className="font-medium text-neutral6">{skill.name}</DataList.Cell>
                <DataList.MonoCell height="default">{skill.path}</DataList.MonoCell>
                <DataList.Cell className="min-w-0">
                  <span className="block truncate">{skill.description || '—'}</span>
                </DataList.Cell>
              </>
            );

            if (!hasActionCallbacks) {
              return (
                <DataList.RowButton key={skill.path} onClick={onClick}>
                  {rowContent}
                </DataList.RowButton>
              );
            }

            return (
              <DataList.RowWrapper key={skill.path}>
                <DataList.RowButton flushRight flushLeft colEnd={-2} onClick={onClick}>
                  {rowContent}
                </DataList.RowButton>
                <DataList.Cell className="py-0">
                  <div className="flex items-center justify-end gap-1 pl-2 w-full pr-3">
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
                </DataList.Cell>
              </DataList.RowWrapper>
            );
          })
        )}
      </DataList>
    </div>
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
          <SkillIcon className="h-8 w-8 text-neutral3" />
        </div>
        <h2 className="text-lg font-medium text-neutral6 mb-2">Skills Not Configured</h2>
        <p className="text-sm text-neutral4 mb-6">
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
          <Button size="lg" variant="default" as="a" href="https://mastra.ai/en/docs/workspace/skills" target="_blank">
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
