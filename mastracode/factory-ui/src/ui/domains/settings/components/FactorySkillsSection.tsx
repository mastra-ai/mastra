import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
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
import type { ReactNode } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useFactorySkillsQuery } from '../../../../hooks/useFactorySkills';
import type { FactorySkillInfo, InstalledBoardInfo } from '../../../../api/types';
import { orderedBoards } from '../../factory/boardCatalog';
import { SettingsContainer, SettingsEmptyRow, SettingsSkeleton } from '@mastra/playground-ui/new/settings';
import { FactorySkillEditorDialog } from './FactorySkillEditorDialog';
import { SettingsSubsection } from './SettingsSubsection';

const SKILLS_DESCRIPTION =
  "The playbooks Factory agents follow when working your items: the built-in ones shipped with the server and your app's own skills. Expand a skill to read the exact instructions the agent receives. Organization admins can edit a skill for this Factory or revert it to the original.";

/** Which Factory's copy of each skill the cards edit, and whether the viewer may. */
const SkillEditingContext = createContext<{ factoryId?: string; canEdit: boolean }>({ canEdit: false });

interface DisplayedSkill {
  name: string;
  title: string;
}

// The default board runs every built-in skill: its Review lane (`pr-review`) took over from the retired Review board.
const DISPLAYED_SKILLS: DisplayedSkill[] = [
  { name: 'factory-triage', title: 'Triage' },
  { name: 'factory-plan', title: 'Planning' },
  { name: 'factory-review', title: 'Review' },
  { name: 'factory-rereview', title: 'Re-review' },
];

function SkillContent({ content }: { content: string }) {
  const [raw, setRaw] = useState(false);

  return (
    <div className="group/content relative">
      <ScrollArea maxHeight="24rem" revealScrollbarOnHover={false}>
        <ScrollAreaViewport className="pt-3">
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
        className="absolute top-4 right-0 opacity-0 transition-opacity group-hover/content:opacity-100 focus-visible:opacity-100"
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
    <div>
      <Collapsible>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left">
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
    </div>
  );
}

function SkillCards({
  displayed,
  skills,
  loading = false,
}: {
  displayed: DisplayedSkill[];
  skills: FactorySkillInfo[];
  loading?: boolean;
}) {
  const cards = displayed.flatMap(({ name, title }) => {
    const skill = skills.find(s => s.name === name);
    return skill ? [<SkillCard key={name} title={title} skill={skill} />] : [];
  });
  if (loading && cards.length === 0) {
    return (
      <SettingsContainer>
        <SettingsSkeleton label="Loading skills" rows={displayed.length} />
      </SettingsContainer>
    );
  }
  // When none match, show no card rather than an empty one.
  if (cards.length === 0) return null;
  return <SettingsContainer>{cards}</SettingsContainer>;
}

/** A phase's skill while the skills catalog is loading or failed to load: we cannot tell whether it exists. */
function UncheckedSkillCard({ title, name }: { title: string; name: string }) {
  return (
    <div>
      <Txt tone="ink" as="span" variant="body">
        {title}
        <Txt font="mono" tone="muted" as="span" variant="caption" className="ml-2">
          {name}
        </Txt>
      </Txt>
    </div>
  );
}

function MissingSkillCard({ title, name }: { title: string; name: string }) {
  return (
    <div className="flex flex-col gap-0.5">
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
    <>
      {withSkill.map(phase => {
        const title = phase.name ?? phase.title;
        const skill = skills.find(s => s.name === phase.skill);
        if (skill) return <SkillCard key={phase.id} title={title} skill={skill} />;
        if (!skillsLoaded) return <UncheckedSkillCard key={phase.id} title={title} name={phase.skill} />;
        return <MissingSkillCard key={phase.id} title={title} name={phase.skill} />;
      })}
      {(withSkill.length === 0 || roles.length > 0) && (
        <div className="flex flex-col gap-2">
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
      )}
    </>
  );
}

function BoardGroup({
  board,
  skills,
  skillsLoaded,
  skillsLoading,
}: {
  board: InstalledBoardInfo;
  skills: FactorySkillInfo[];
  skillsLoaded: boolean;
  skillsLoading: boolean;
}) {
  return (
    <SettingsSubsection scope="factory" title={`${board.title} board`} description={SKILLS_DESCRIPTION}>
      {board.id === DEFAULT_BOARD_ID ? (
        <SkillCards displayed={DISPLAYED_SKILLS} skills={skills} loading={skillsLoading} />
      ) : (
        <SettingsContainer>
          <CustomBoardPhases board={board} skills={skills} skillsLoaded={skillsLoaded} />
        </SettingsContainer>
      )}
    </SettingsSubsection>
  );
}

/** App skills no board phase runs; agents can still load them, and users can invoke them. */
function OtherAppSkills({ skills, boards }: { skills: FactorySkillInfo[]; boards: InstalledBoardInfo[] }) {
  const used = new Set(boards.flatMap(board => board.phases.flatMap(phase => (phase.skill ? [phase.skill] : []))));
  const other = skills.filter(skill => skill.builtIn === false && !used.has(skill.name));
  if (other.length === 0) return null;
  return (
    <SettingsSubsection
      scope="factory"
      title="App skills"
      description="Your app's skills that no board phase runs. Agents can still load them, and you can invoke them."
    >
      <SettingsContainer>
        {other.map(skill => (
          <SkillCard key={skill.name} title={skill.name} skill={skill} />
        ))}
      </SettingsContainer>
    </SettingsSubsection>
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
      {(skillsQuery.error || catalog.error) && (
        <div className="flex flex-col gap-1 ps-2.5">
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
        </div>
      )}
      <FactorySkillGroups
        boards={boards}
        skills={skills}
        skillsLoaded={skillsQuery.isSuccess}
        skillsLoading={skillsQuery.isPending}
        catalogLoading={catalog.isPending}
      />
    </SkillEditingContext.Provider>
  );
}

function FactorySkillsSubsection({ children }: { children: ReactNode }) {
  return (
    <SettingsSubsection scope="factory" title="Factory skills" description={SKILLS_DESCRIPTION}>
      {children}
    </SettingsSubsection>
  );
}

/** Skills grouped by installed board, or ungrouped while the boards are unknown. */
function FactorySkillGroups({
  boards,
  skills,
  skillsLoaded,
  skillsLoading,
  catalogLoading,
}: {
  boards: InstalledBoardInfo[] | undefined;
  skills: FactorySkillInfo[];
  skillsLoaded: boolean;
  skillsLoading: boolean;
  catalogLoading: boolean;
}) {
  if (boards === undefined) {
    return (
      <FactorySkillsSubsection>
        <SkillCards displayed={DISPLAYED_SKILLS} skills={skills} loading={skillsLoading || catalogLoading} />
      </FactorySkillsSubsection>
    );
  }
  if (boards.length === 0) {
    return (
      <>
        <FactorySkillsSubsection>
          <SettingsContainer>
            <SettingsEmptyRow>No boards are installed, so no board skills apply.</SettingsEmptyRow>
          </SettingsContainer>
        </FactorySkillsSubsection>
        <OtherAppSkills skills={skills} boards={boards} />
      </>
    );
  }
  return (
    <>
      {boards.map(board => (
        <BoardGroup
          key={board.id}
          board={board}
          skills={skills}
          skillsLoaded={skillsLoaded}
          skillsLoading={skillsLoading}
        />
      ))}
      <OtherAppSkills skills={skills} boards={boards} />
    </>
  );
}
