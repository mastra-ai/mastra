import { Button } from '@mastra/playground-ui/components/Button';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { sortBy } from '@mastra/playground-ui/sort/sort-by';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { AlertTriangle, BookOpen, CircleSlashIcon, Plus } from 'lucide-react';
import { useMemo } from 'react';
import type { SyntheticEvent } from 'react';
import type { SkillMetadata } from '../types';
import { SkillRemoveButton, SkillUpdateButton } from './skill-actions';

export type SkillsSortKey = 'name' | 'path';
export type SkillsSort = ListSort<SkillsSortKey>;

export interface SkillsTableProps {
  skills: SkillMetadata[];
  isLoading: boolean;
  sort?: SkillsSort;
  onSortChange?: (direction: DataListSort, key: SkillsSortKey) => void;
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
  { label: 'Skill', size: 'minmax(8rem,auto)', sortKey: 'name' },
  { label: 'Path', size: 'minmax(8rem,1fr)', sortKey: 'path' },
  { label: 'Description', size: 'minmax(0,2fr)' },
] as const;

const columnsWithActions = [...baseColumns, { label: '', size: 'auto' }] as const;

const sortAccessors = {
  name: (skill: SkillMetadata) => skill.name,
  path: (skill: SkillMetadata) => skill.path,
};

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export function SkillsTable({
  skills: unsortedSkills,
  isLoading,
  sort,
  onSortChange,
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
  const skills = useMemo(
    () =>
      sortBy(
        unsortedSkills.map(skill => ({ ...skill, id: skill.path })),
        sort,
        sortAccessors,
      ),
    [unsortedSkills, sort],
  );
  const { containerRef, getRowProps } = useDataListKeyboard({ count: skills.length, global: true });

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
          <Button variant="default" size="sm" onClick={onAddSkill} icon={<Plus />}>
            Add Skill
          </Button>
        </div>
      )}

      {hasUndiscoveredAgentSkills && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="text-body">
            <p className="font-medium text-amber-500">Skills installed but not discovered</p>
            <p className="mt-1 text-muted-foreground">
              You have skills in <code className="rounded bg-muted px-1 py-0.5 text-caption">.agents/skills</code> that
              aren&apos;t being discovered. Add this path to your workspace skills configuration to see them.
            </p>
          </div>
        </div>
      )}

      <DataList columns={gridColumns} scrollRef={containerRef}>
        <DataList.Top>
          {activeColumns.map(col =>
            onSortChange && 'sortKey' in col ? (
              <DataList.SortableTopCell
                key={col.label}
                sortKey={col.sortKey}
                sort={sort?.key === col.sortKey ? sort.direction : undefined}
                onSortChange={onSortChange}
              >
                {col.label}
              </DataList.SortableTopCell>
            ) : (
              <DataList.TopCell key={col.label}>{col.label}</DataList.TopCell>
            ),
          )}
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
          skills.map((skill, index) => {
            const onClick = () => {
              navigate(`${basePath}/${encodeURIComponent(skill.name)}?path=${encodeURIComponent(skill.path)}`);
            };

            const rowContent = (
              <>
                <DataList.Cell className="font-medium text-foreground">{skill.name}</DataList.Cell>
                <DataList.TextCell font="mono">{skill.path}</DataList.TextCell>
                <DataList.Cell className="min-w-0">
                  <span className="block truncate">{skill.description || '—'}</span>
                </DataList.Cell>
              </>
            );

            if (!hasActionCallbacks) {
              return (
                <DataList.RowButton key={skill.path} onClick={onClick} {...getRowProps(index)}>
                  {rowContent}
                </DataList.RowButton>
              );
            }

            return (
              <DataList.RowWrapper key={skill.path} {...getRowProps(index)} onSelectRow={onClick}>
                <DataList.RowButton
                  colEnd={-2}
                  tabIndex={-1}
                  onClick={event => {
                    event.stopPropagation();
                    onClick();
                  }}
                >
                  {rowContent}
                </DataList.RowButton>
                <DataList.ActionsCell className="pl-2" onClick={stopPropagation}>
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
                </DataList.ActionsCell>
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
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <CircleSlashIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-heading text-foreground">Skills Not Configured</h2>
        <p className="mb-6 text-body text-muted-foreground">
          No skills are configured in the workspace. Add SKILL.md files to your skills directory to discover and manage
          agent skills.
        </p>
        <div className="flex gap-3">
          {onAddSkill && (
            <Button size="lg" variant="default" onClick={onAddSkill} icon={<Plus />}>
              Add Skill from skills.sh
            </Button>
          )}
          <Button
            size="lg"
            variant="default"
            render={<a href="https://mastra.ai/en/docs/workspace/skills" target="_blank" />}

            icon={<BookOpen />}
          >
            Learn about Skills
          </Button>
        </div>
      </div>
    </div>
  );
}

export { SkillsNotConfigured };
