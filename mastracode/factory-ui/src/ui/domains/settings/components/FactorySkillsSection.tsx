import { Badge } from '@mastra/playground-ui/components/Badge';
import { Code } from '@mastra/playground-ui/components/Code';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Code as CodeIcon, FileText, Pencil } from 'lucide-react';
import { createContext, useContext, useState } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useFactorySkillsQuery } from '../../../../hooks/useFactorySkills';
import type { FactorySkillInfo, InstalledBoardInfo } from '../../../../api/types';
import { orderedBoards } from '../../factory/boardCatalog';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { FactorySkillEditorDialog } from './FactorySkillEditorDialog';
import { SettingsSubsection } from './SettingsSubsection';

/** Which Factory's copy of each skill the cards edit, and whether the viewer may. */
const SkillEditingContext = createContext<{ factoryId?: string; canEdit: boolean }>({ canEdit: false });

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
      <ScrollArea maxHeight="24rem" revealScrollbarOnHover={false}>
        <ScrollAreaViewport className="px-4 pb-4">
          {raw ? (
            <Code className="text-caption text-muted-foreground m-0 font-mono whitespace-pre-wrap" code={content} />
          ) : (
            <MarkdownRenderer className="text-muted-foreground text-caption">{content}</MarkdownRenderer>
          )}
        </ScrollAreaViewport>
      </ScrollArea>
      <Button
        size="icon-sm"
        tooltip={raw ? 'Show formatted' : 'Show raw'}
        onClick={() => setRaw(shown => !shown)}
        className="absolute top-1 right-4 opacity-0 transition-opacity group-hover/content:opacity-100 focus-visible:opacity-100"
      >
        {raw ? <FileText /> : <CodeIcon />}
      </Button>
    </div>
  );
}

function SkillCard({ title, skill }: { title: string; skill: FactorySkillInfo }) {
  const [editing, setEditing] = useState(false);
  const { factoryId, canEdit } = useContext(SkillEditingContext);
  const editable = factoryId !== undefined && canEdit;

  return (
    <SettingsContainer>
      <Collapsible>
        <div className="flex items-center gap-2 pr-4">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center justify-between gap-4 py-3 pl-4 text-left">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <Txt tone="ink" as="span" variant="body">
                  {title}
                  <Txt font="mono" tone="muted" as="span" variant="caption" className="ml-2">
                    {skill.name}
                  </Txt>
                </Txt>
                {skill.error && <Badge variant="destructive">Failed to load</Badge>}
                {skill.builtIn && skill.origin !== undefined && skill.origin !== 'bundled' && (
                  <Badge>Overridden by app</Badge>
                )}
                {skill.edited && <Badge>Edited</Badge>}
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
            <DisclosureChevron direction="right" className="text-muted-foreground size-4" />
          </CollapsibleTrigger>
          <Button
            size="sm"
            icon={editable ? <Pencil /> : <FileText />}
            aria-label={`${editable ? 'Edit' : 'View'} ${skill.name}`}
            onClick={() => setEditing(true)}
          >
            {editable ? 'Edit' : 'View'}
          </Button>
        </div>
        <CollapsibleContent>
          <SkillContent content={skill.content} />
        </CollapsibleContent>
      </Collapsible>
      {editing && (
        <FactorySkillEditorDialog
          skill={skill}
          factoryId={factoryId}
          canEdit={canEdit}
          onClose={() => setEditing(false)}
        />
      )}
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

/** A phase's skill while the skills catalog is loading or failed to load: we cannot tell whether it exists. */
function UncheckedSkillCard({ title, name }: { title: string; name: string }) {
  return (
    <SettingsContainer>
      <div className="px-4 py-3">
        <Txt tone="ink" as="span" variant="body">
          {title}
          <Txt font="mono" tone="muted" as="span" variant="caption" className="ml-2">
            {name}
          </Txt>
        </Txt>
      </div>
    </SettingsContainer>
  );
}

function MissingSkillCard({ title, name }: { title: string; name: string }) {
  return (
    <SettingsContainer>
      <div className="flex flex-col gap-0.5 px-4 py-3">
        <span className="flex items-center gap-2">
          <Txt tone="ink" as="span" variant="body">
            {title}
            <Txt font="mono" tone="muted" as="span" variant="caption" className="ml-2">
              {name}
            </Txt>
          </Txt>
          <Badge variant="destructive">Not found</Badge>
        </span>
        <Txt as="span" variant="caption" className="text-destructive-foreground">
          This phase runs a skill the server does not have, so cards entering it fail to start. Add it with
          MastraFactory(&#123; skills &#125;) or a factory-skills/{name}/SKILL.md file.
        </Txt>
      </div>
    </SettingsContainer>
  );
}

function CustomBoardPhases({
  board,
  skills,
  skillsLoaded,
}: {
  board: InstalledBoardInfo;
  skills: FactorySkillInfo[];
  skillsLoaded: boolean;
}) {
  const working = board.phases.filter(phase => phase.kind === 'working');
  const withSkill = working.flatMap(phase => (phase.skill ? [{ ...phase, skill: phase.skill }] : []));
  const roles = [
    ...new Set(
      working.flatMap(phase => {
        const role = phase.context ?? phase.role;
        return !phase.skill && role ? [role] : [];
      }),
    ),
  ];
  return (
    <div className="flex flex-col gap-3">
      {withSkill.map(phase => {
        const title = phase.name ?? phase.title;
        const skill = skills.find(s => s.name === phase.skill);
        if (skill) return <SkillCard key={phase.id} title={title} skill={skill} />;
        if (!skillsLoaded) return <UncheckedSkillCard key={phase.id} title={title} name={phase.skill} />;
        return <MissingSkillCard key={phase.id} title={title} name={phase.skill} />;
      })}
      {(withSkill.length === 0 || roles.length > 0) && (
        <SettingsContainer>
          <div className="flex flex-col gap-2 px-4 py-3">
            {roles.length === 0 ? (
              <Txt tone="muted" as="p" variant="caption">
                This board declares no working roles.
              </Txt>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {roles.map(role => (
                  <li key={role}>
                    <Txt font="mono" tone="muted" as="span" variant="caption">
                      {role}
                    </Txt>
                  </li>
                ))}
              </ul>
            )}
            {roles.length > 0 && (
              <Txt tone="muted" as="p" variant="caption">
                Phases in these roles run no skill; their kickoff instructions are defined in code by the board
                definition.
              </Txt>
            )}
          </div>
        </SettingsContainer>
      )}
    </div>
  );
}

function BoardGroup({
  board,
  skills,
  skillsLoaded,
}: {
  board: InstalledBoardInfo;
  skills: FactorySkillInfo[];
  skillsLoaded: boolean;
}) {
  return (
    <section aria-label={`${board.title} board`} className="flex flex-col gap-2">
      <Txt tone="ink" as="h4" variant="body" className="m-0">
        {board.title}
      </Txt>
      {isBuiltInBoard(board.id) ? (
        <SkillCards displayed={BUILT_IN_BOARD_SKILLS[board.id]} skills={skills} />
      ) : (
        <CustomBoardPhases board={board} skills={skills} skillsLoaded={skillsLoaded} />
      )}
    </section>
  );
}

/** App skills no board phase runs; agents can still load them, and users can invoke them. */
function OtherAppSkills({ skills, boards }: { skills: FactorySkillInfo[]; boards: InstalledBoardInfo[] }) {
  const used = new Set(boards.flatMap(board => board.phases.flatMap(phase => (phase.skill ? [phase.skill] : []))));
  const other = skills.filter(skill => skill.builtIn === false && !used.has(skill.name));
  if (other.length === 0) return null;
  return (
    <section aria-label="App skills" className="flex flex-col gap-2">
      <Txt tone="ink" as="h4" variant="body" className="m-0">
        App skills
      </Txt>
      <div className="flex flex-col gap-3">
        {other.map(skill => (
          <SkillCard key={skill.name} title={skill.name} skill={skill} />
        ))}
      </div>
    </section>
  );
}

export function FactorySkillsSection({ factoryId }: { factoryId?: string }) {
  const skillsQuery = useFactorySkillsQuery(factoryId);
  const catalog = useBoardCatalog(factoryId);
  const skills = skillsQuery.data?.skills ?? [];
  const canEdit = skillsQuery.data?.canEdit ?? false;
  const boards = catalog.data === undefined ? undefined : orderedBoards(catalog.data);

  return (
    <SkillEditingContext.Provider value={{ factoryId, canEdit }}>
      <SettingsSubsection
        scope="factory"
        title="Factory skills"
        description="The playbooks Factory agents follow when working your items: the built-in ones shipped with the server and your app's own skills. Expand a skill to read the exact instructions the agent receives. Organization admins can edit a skill for this Factory or revert it to the original."
      >
        {skillsQuery.isPending && (
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
            Installed boards could not be loaded; showing built-in skills ungrouped.
          </Txt>
        )}
        {boards === undefined ? (
          <SkillCards displayed={DISPLAYED_SKILLS} skills={skills} />
        ) : boards.length === 0 ? (
          <div className="flex flex-col gap-5">
            <Txt tone="muted" as="p" variant="caption">
              No boards are installed, so no board skills apply.
            </Txt>
            <OtherAppSkills skills={skills} boards={boards} />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {boards.map(board => (
              <BoardGroup key={board.id} board={board} skills={skills} skillsLoaded={skillsQuery.isSuccess} />
            ))}
            <OtherAppSkills skills={skills} boards={boards} />
          </div>
        )}
      </SettingsSubsection>
    </SkillEditingContext.Provider>
  );
}
