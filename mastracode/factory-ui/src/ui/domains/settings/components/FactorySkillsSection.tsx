import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight, Code, FileText } from 'lucide-react';
import { useState } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useFactorySkillsQuery } from '../../../../hooks/useFactorySkills';
import type { FactorySkillInfo, InstalledBoardInfo } from '../../../../api/types';
import { orderedBoards } from '../../factory/boardCatalog';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { SettingsSubsection } from './SettingsSubsection';

interface DisplayedSkill {
  name: string;
  title: string;
}

const BUILT_IN_BOARD_SKILLS: Record<'work' | 'review', DisplayedSkill[]> = {
  work: [
    { name: 'factory-triage', title: 'Triage' },
    { name: 'factory-plan', title: 'Planning' },
  ],
  review: [
    { name: 'factory-review', title: 'Review' },
    { name: 'factory-rereview', title: 'Re-review' },
  ],
};

const DISPLAYED_SKILLS: DisplayedSkill[] = [...BUILT_IN_BOARD_SKILLS.work, ...BUILT_IN_BOARD_SKILLS.review];

function isBuiltInBoard(id: string): id is 'work' | 'review' {
  return id === 'work' || id === 'review';
}

function SkillContent({ content }: { content: string }) {
  const [raw, setRaw] = useState(false);

  return (
    <div className="group/content relative">
      <ScrollArea maxHeight="24rem" viewPortClassName="px-4 pb-4" revealScrollbarOnHover={false}>
        {raw ? (
          <pre className="text-ui-sm text-icon4 m-0 font-mono whitespace-pre-wrap">{content}</pre>
        ) : (
          <MarkdownRenderer className="text-ui-sm text-icon4">{content}</MarkdownRenderer>
        )}
      </ScrollArea>
      <Button
        size="icon-sm"
        tooltip={raw ? 'Show formatted' : 'Show raw'}
        onClick={() => setRaw(shown => !shown)}
        className="absolute top-1 right-4 opacity-0 transition-opacity group-hover/content:opacity-100 focus-visible:opacity-100"
      >
        {raw ? <FileText /> : <Code />}
      </Button>
    </div>
  );
}

function SkillCard({ title, skill }: { title: string; skill: FactorySkillInfo }) {
  return (
    <SettingsContainer>
      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 px-4 py-3 text-left">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Txt as="span" variant="ui-md" className="text-icon5">
              {title}
              <Txt as="span" variant="ui-sm" className="text-icon3 ml-2 font-mono">
                {skill.name}
              </Txt>
            </Txt>
            <Txt as="span" variant="ui-sm" className="text-icon3">
              {skill.description}
            </Txt>
          </div>
          <ChevronRight
            aria-hidden="true"
            className="text-icon3 size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SkillContent content={skill.content} />
        </CollapsibleContent>
      </Collapsible>
    </SettingsContainer>
  );
}

function SkillCards({ displayed, skills }: { displayed: DisplayedSkill[]; skills: FactorySkillInfo[] }) {
  return (
    <div className="flex flex-col gap-3">
      {displayed.flatMap(({ name, title }) => {
        const skill = skills.find(s => s.name === name);
        return skill ? [<SkillCard key={name} title={title} skill={skill} />] : [];
      })}
    </div>
  );
}

function CustomBoardRoles({ board }: { board: InstalledBoardInfo }) {
  const roles = [...new Set(board.phases.flatMap(phase => (phase.role ? [phase.role] : [])))];
  return (
    <SettingsContainer>
      <div className="flex flex-col gap-2 px-4 py-3">
        {roles.length === 0 ? (
          <Txt as="p" variant="ui-sm" className="text-icon3">
            This board declares no working roles.
          </Txt>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {roles.map(role => (
              <li key={role}>
                <Txt as="span" variant="ui-sm" className="text-icon4 font-mono">
                  {role}
                </Txt>
              </li>
            ))}
          </ul>
        )}
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Kickoff instructions for this board are defined in code by its board definition; there is no skill to show
          here.
        </Txt>
      </div>
    </SettingsContainer>
  );
}

function BoardGroup({ board, skills }: { board: InstalledBoardInfo; skills: FactorySkillInfo[] }) {
  return (
    <section aria-label={`${board.title} board`} className="flex flex-col gap-2">
      <Txt as="h4" variant="ui-md" className="text-icon5 m-0">
        {board.title}
      </Txt>
      {isBuiltInBoard(board.id) ? (
        <SkillCards displayed={BUILT_IN_BOARD_SKILLS[board.id]} skills={skills} />
      ) : (
        <CustomBoardRoles board={board} />
      )}
    </section>
  );
}

export function FactorySkillsSection({ factoryId }: { factoryId?: string }) {
  const skillsQuery = useFactorySkillsQuery();
  const catalog = useBoardCatalog(factoryId);
  const skills = skillsQuery.data ?? [];
  const boards = catalog.data === undefined ? undefined : orderedBoards(catalog.data);

  return (
    <SettingsSubsection
      scope="deployment"
      title="Factory skills"
      description="The built-in playbooks Factory agents follow when working your items, shipped with the server and read-only. Expand a skill to read the exact instructions the agent receives."
    >
      {skillsQuery.isPending && (
        <Txt as="p" variant="ui-sm" role="status" className="text-icon3">
          Loading skills…
        </Txt>
      )}
      {skillsQuery.error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {skillsQuery.error instanceof Error ? skillsQuery.error.message : 'Failed to load skills'}
        </Txt>
      )}
      {catalog.error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          Installed boards could not be loaded; showing built-in skills ungrouped.
        </Txt>
      )}
      {boards === undefined ? (
        <SkillCards displayed={DISPLAYED_SKILLS} skills={skills} />
      ) : boards.length === 0 ? (
        <Txt as="p" variant="ui-sm" className="text-icon3">
          No boards are installed, so no board skills apply.
        </Txt>
      ) : (
        <div className="flex flex-col gap-5">
          {boards.map(board => (
            <BoardGroup key={board.id} board={board} skills={skills} />
          ))}
        </div>
      )}
    </SettingsSubsection>
  );
}
