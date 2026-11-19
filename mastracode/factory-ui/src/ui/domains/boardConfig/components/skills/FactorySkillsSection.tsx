import { Badge } from '@mastra/playground-ui/components/Badge';
import { CardContent, CardLink } from '@mastra/playground-ui/components/Card';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconChevronRightMedium } from '@mastra/playground-ui/icons/central/IconChevronRightMedium';

import type { FactorySkillInfo, InstalledBoardInfo } from '../../../../../api/types';
import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { useFactorySkillsQuery } from '../../../../../hooks/useFactorySkills';
import { HrefLink } from '../../../../ui/HrefLink';
import { orderedBoards } from '../../../factory/boardCatalog';
import { boardSkillPath } from '../../boardConfigPaths';
import { SkillBadges } from './SkillBadges';

/** Skills some board's settings already show: the ones its phases run. None while the boards are unknown. */
function boardSkillNames(boards: InstalledBoardInfo[] | undefined): Set<string> {
  return new Set((boards ?? []).flatMap(board => board.phases.flatMap(phase => (phase.skill ? [phase.skill] : []))));
}

function SkillCard({ skill, href }: { skill: FactorySkillInfo; href: string }) {
  return (
    <CardLink elevation="flat" href={href} LinkComponent={HrefLink}>
      <CardContent className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <Txt tone="ink" as="span" variant="body">
              {skill.name}
            </Txt>
            {skill.error && <Badge variant="destructive">Failed to load</Badge>}
            <SkillBadges skill={skill} />
          </span>
          {skill.error ? (
            <Txt as="span" variant="caption" className="text-destructive-foreground whitespace-pre-wrap">
              Agents cannot load this skill: {skill.error}
            </Txt>
          ) : (
            <Txt tone="muted" as="span" variant="caption">
              {skill.description}
            </Txt>
          )}
        </div>
        <IconChevronRightMedium aria-hidden className="text-muted-foreground size-icon-md shrink-0" />
      </CardContent>
    </CardLink>
  );
}

export function FactorySkillsSection({ factoryId, boardId }: { factoryId: string; boardId: string }) {
  const skillsQuery = useFactorySkillsQuery(factoryId);
  const catalog = useBoardCatalog(factoryId);
  const boards = catalog.data === undefined ? undefined : orderedBoards(catalog.data);
  const shownOnBoards = boardSkillNames(boards);
  const skills = (skillsQuery.data?.skills ?? []).filter(skill => !shownOnBoards.has(skill.name));
  const loading = skillsQuery.isPending || catalog.isLoading;

  return (
    <div className="flex flex-col gap-3">
      {loading && (
        <Txt tone="muted" as="p" variant="caption" role="status">
          Loading skills…
        </Txt>
      )}
      {skillsQuery.error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          {skillsQuery.error instanceof Error ? skillsQuery.error.message : 'Failed to load skills'}
        </Txt>
      )}
      {catalog.error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          Installed boards could not be loaded, so some of these skills may run in a board phase.
        </Txt>
      )}
      {!loading && skillsQuery.isSuccess && skills.length === 0 && (
        <Txt tone="muted" as="p" variant="caption">
          Every skill runs in a board phase.
        </Txt>
      )}
      {!loading &&
        skills.map(skill => (
          <SkillCard key={skill.name} skill={skill} href={boardSkillPath(factoryId, boardId, skill.name)} />
        ))}
    </div>
  );
}
