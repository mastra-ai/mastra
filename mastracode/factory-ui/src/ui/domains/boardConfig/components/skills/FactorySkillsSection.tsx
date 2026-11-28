import { useBoardCatalog } from '@mastra/react/hooks/factory';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsItem,
  SettingsListHeader,
  SettingsNoticeRow,
  SettingsSkeleton,
} from '@mastra/playground-ui/new/settings';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { Link } from 'react-router';

import type { FactorySkillInfo, InstalledBoardInfo } from '../../../../../api/types';
import { useFactorySkillsQuery } from '../../../../../hooks/useFactorySkills';
import { boardName, installedPhaseName } from '@mastra/playground-ui/domains/factory';
import { orderedBoards } from '../../../factory/boardCatalog';
import { SettingsSubsection } from '../../../settings/components/SettingsSubsection';
import { useSettingsLinkState } from '../../../settings/hooks/useSettingsOpen';
import { newSkillPath, skillPath } from '../../../settings/settingsSections';
import { boardConfigPath } from '../../boardConfigPaths';
import { SkillBadges } from '../../../boardCanvas/components/phasePanel/SkillBadges';

/** A board phase that runs a skill. */
type SkillUse = { boardId: string; board: string; phaseKey: string; phase: string };

/** The phases that run each skill, in board order. */
function skillUses(boards: readonly InstalledBoardInfo[]): Map<string, SkillUse[]> {
  const uses = new Map<string, SkillUse[]>();
  for (const board of orderedBoards(boards)) {
    for (const phase of board.phases) {
      if (!phase.skill) continue;
      const use = { boardId: board.id, board: boardName(board), phaseKey: phase.id, phase: installedPhaseName(phase) };
      uses.set(phase.skill, [...(uses.get(phase.skill) ?? []), use]);
    }
  }
  return uses;
}

const linkStyle = `rounded-sm hover:underline ${focusRing}`;

function SkillUses({ factoryId, uses }: { factoryId: string; uses: readonly SkillUse[] }) {
  if (uses.length === 0) {
    return (
      <Txt as="span" variant="meta" tone="muted">
        No phase runs it
      </Txt>
    );
  }
  return (
    <Txt as="span" variant="meta" tone="muted" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      Runs in
      {uses.map(use => (
        <Link
          key={`${use.boardId}/${use.phaseKey}`}
          to={boardConfigPath(factoryId, use.boardId, use.phaseKey)}
          className={`text-foreground ${linkStyle}`}
        >
          {use.board} › {use.phase}
        </Link>
      ))}
    </Txt>
  );
}

function SkillItem({
  factoryId,
  skill,
  uses,
  linkState,
}: {
  factoryId: string;
  skill: FactorySkillInfo;
  /** Undefined while the boards are unknown. */
  uses: readonly SkillUse[] | undefined;
  linkState: unknown;
}) {
  return (
    <SettingsItem
      title={
        <span className="flex min-w-0 items-center gap-2">
          <Link to={skillPath(factoryId, skill.name)} state={linkState} className={`truncate ${linkStyle}`}>
            {skill.name}
          </Link>
          {skill.error && <Badge variant="destructive">Failed to load</Badge>}
          <SkillBadges skill={skill} />
        </span>
      }
      description={
        skill.error ? (
          <span className="text-destructive-foreground">Agents cannot load this skill: {skill.error}</span>
        ) : (
          skill.description
        )
      }
    >
      {uses && <SkillUses factoryId={factoryId} uses={uses} />}
    </SettingsItem>
  );
}

/**
 * Every skill in the factory, each with the board phases that run it. Agents load any of them when they need it; a
 * phase runs the one picked for it on its board's canvas.
 */
export function FactorySkillsSection({ factoryId }: { factoryId: string }) {
  const skillsQuery = useFactorySkillsQuery(factoryId);
  const catalog = useBoardCatalog(factoryId);
  const linkState = useSettingsLinkState();
  const uses = catalog.data === undefined ? undefined : skillUses(catalog.data);
  const skills = skillsQuery.data?.skills ?? [];
  const newSkill = skillsQuery.data?.canEdit ? (
    <Button size="sm" icon={<IconPlusMedium />} render={<Link to={newSkillPath(factoryId)} state={linkState} />}>
      New skill
    </Button>
  ) : undefined;

  return (
    <SettingsSubsection
      scope="factory"
      title="Available to agents"
      description="Agents load a skill when they need it. A phase runs the skill picked for it on its board."
    >
      {skillsQuery.isPending ? (
        <SettingsContainer>
          <SettingsSkeleton variant="item" label="Loading skills" />
        </SettingsContainer>
      ) : skillsQuery.isError ? (
        <Notice variant="destructive">
          <Notice.Message>{skillsQuery.error.message || 'Failed to load skills'}</Notice.Message>
        </Notice>
      ) : skills.length === 0 ? (
        <SettingsContainer>
          <SettingsEmptyRow action={newSkill}>No skills</SettingsEmptyRow>
        </SettingsContainer>
      ) : (
        <SettingsContainer>
          <SettingsListHeader action={newSkill}>
            {skills.length === 1 ? '1 skill' : `${skills.length} skills`}
          </SettingsListHeader>
          <SettingsNoticeRow>
            {catalog.isError && (
              <Txt as="p" variant="caption" tone="muted">
                The boards could not be loaded, so which phases run each skill is not shown.
              </Txt>
            )}
          </SettingsNoticeRow>
          {skills.map(skill => (
            <SkillItem
              key={skill.name}
              factoryId={factoryId}
              skill={skill}
              uses={uses && (uses.get(skill.name) ?? [])}
              linkState={linkState}
            />
          ))}
        </SettingsContainer>
      )}
    </SettingsSubsection>
  );
}
