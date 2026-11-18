import { Txt } from '@mastra/playground-ui/components/Txt';

import type { InstalledBoardInfo } from '../../../../../api/types';
import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { useFactorySkillsQuery } from '../../../../../hooks/useFactorySkills';
import { orderedBoards } from '../../../factory/boardCatalog';
import { boardSkillPath } from '../../boardConfigPaths';
import { FactorySkillsSkeleton } from './FactorySkillsSkeleton';
import { SkillCard } from './SkillCard';

/** Skills some board's settings already show: the ones its phases run. None while the boards are unknown. */
function boardSkillNames(boards: InstalledBoardInfo[] | undefined): Set<string> {
  return new Set((boards ?? []).flatMap(board => board.phases.flatMap(phase => (phase.skill ? [phase.skill] : []))));
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
      {loading && <FactorySkillsSkeleton />}
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
