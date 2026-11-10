import { Badge } from '@mastra/playground-ui/components/Badge';
import { Code } from '@mastra/playground-ui/components/Code';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { useState } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useFactorySkillsQuery } from '../../../../hooks/useFactorySkills';
import type { FactorySkillInfo, InstalledBoardInfo } from '../../../../api/types';
import { orderedBoards } from '../../factory/boardCatalog';
import { FactorySkillEditorDialog } from '../../settings/components/FactorySkillEditorDialog';
import { IconCode } from '@mastra/playground-ui/icons/central/IconCode';
import { IconFileText } from '@mastra/playground-ui/icons/central/IconFileText';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';

/** Skills some board's settings already show: the ones its phases run. None while the boards are unknown. */
function boardSkillNames(boards: InstalledBoardInfo[] | undefined): Set<string> {
  return new Set((boards ?? []).flatMap(board => board.phases.flatMap(phase => (phase.skill ? [phase.skill] : []))));
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
        {raw ? <IconFileText /> : <IconCode />}
      </Button>
    </div>
  );
}

function SkillCard({ skill, factoryId, canEdit }: { skill: FactorySkillInfo; factoryId?: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const editable = factoryId !== undefined && canEdit;

  return (
    <SettingsContainer>
      <Collapsible>
        <div className="flex items-center gap-2 pr-4">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center justify-between gap-4 py-3 pl-4 text-left">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <Txt tone="ink" as="span" variant="body">
                  {skill.name}
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
            icon={editable ? <IconPencil /> : <IconFileText />}
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

/**
 * The skills no board phase runs. A skill a phase runs lives on that phase's page, so it isn't listed twice.
 */
export function FactorySkillsSection({ factoryId }: { factoryId?: string }) {
  const skillsQuery = useFactorySkillsQuery(factoryId);
  const catalog = useBoardCatalog(factoryId);
  const canEdit = skillsQuery.data?.canEdit ?? false;
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
        skills.map(skill => <SkillCard key={skill.name} skill={skill} factoryId={factoryId} canEdit={canEdit} />)}
    </div>
  );
}
