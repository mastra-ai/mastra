import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconBook } from '@mastra/playground-ui/icons/central/IconBook';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { FactorySkillInfo, StoredPhaseInfo } from '../../../../api/types';
import { DescriptionMarkdown } from '../../factory/components/DescriptionMarkdown';
import { DEFAULT_SESSION } from '../boardDraft';
import { boardConfigPath, boardSkillPath } from '../boardConfigPaths';
import { Muted } from './PhaseTimeline';
import { SkillBadges } from './skills/SkillBadges';

/**
 * The agent working a phase, as a chip naming its skill. Hovering or focusing it shows what the agent is told: the
 * skill's instructions, what this phase adds, its goal and session. The chip opens the skill, or the phase when the
 * agent has no skill.
 */
export function PhaseRunnerCard({
  factoryId,
  boardId,
  phase,
  skills,
}: {
  factoryId: string;
  boardId: string;
  phase: StoredPhaseInfo;
  /** Undefined until the factory's skills load, so a skill is never called missing early. */
  skills: FactorySkillInfo[] | undefined;
}) {
  const runner = phase.runner;
  if (!runner) return null;
  const skillName = runner.skill;
  const skill = skillName ? skills?.find(candidate => candidate.name === skillName) : undefined;
  const missing = skillName !== undefined && skills !== undefined && skill === undefined;
  const broken = missing || skill?.error !== undefined;
  const to =
    skillName && !missing
      ? boardSkillPath(factoryId, boardId, skillName)
      : boardConfigPath(factoryId, boardId, phase.key);
  const Icon = skillName ? IconBook : IconRobot;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={100}
        render={<Link to={to} />}
        className={cn(
          focusRing,
          'border-border bg-fill-subtle hover:bg-fill flex w-fit max-w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 transition-colors',
          broken && 'border-destructive-foreground text-destructive-foreground',
        )}
      >
        <Icon aria-hidden className="size-icon-sm shrink-0 opacity-70" />
        <span className="truncate">{skillName ?? 'Agent'}</span>
        {broken && <span className="sr-only">{missing ? ', skill not found' : ', skill failed to load'}</span>}
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        showArrow={false}
        className="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-3"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Icon aria-hidden className="text-muted-foreground size-icon-md shrink-0" />
          <Txt as="span" variant="label" tone="ink" className="truncate">
            {skillName ?? `${phase.name} agent`}
          </Txt>
          {skill && <SkillBadges skill={skill} />}
        </div>
        {missing ? (
          <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
            This factory has no {skillName} skill, so cards entering {phase.name} fail to start.
          </Txt>
        ) : skill?.error ? (
          <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
            Agents can't load this skill: {skill.error}
          </Txt>
        ) : (
          skill?.description && (
            <Txt as="p" variant="caption" tone="muted">
              {skill.description}
            </Txt>
          )
        )}
        {skillName && !skills && <Muted>Loading the skill…</Muted>}
        {skill?.content.trim() && (
          <Block title="Skill instructions">
            <DescriptionMarkdown titleLevel="h3">{skill.content}</DescriptionMarkdown>
          </Block>
        )}
        {runner.instructions?.trim() && (
          <Block title={`${phase.name} adds`}>
            <DescriptionMarkdown titleLevel="h3">{runner.instructions}</DescriptionMarkdown>
          </Block>
        )}
        {runner.goal?.objective && (
          <Block title={runner.goal.maxRuns ? `Goal, up to ${runner.goal.maxRuns} runs` : 'Goal'}>
            <Txt as="p" variant="body-sm" className="whitespace-pre-wrap">
              {runner.goal.objective}
            </Txt>
          </Block>
        )}
        <Txt as="p" variant="caption" tone="muted">
          Session {runner.context || DEFAULT_SESSION}, shared with phases that name it too.
        </Txt>
      </HoverCardContent>
    </HoverCard>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Txt as="span" variant="caption" tone="faint">
        {title}
      </Txt>
      <div className="bg-fill-subtle max-h-56 overflow-y-auto rounded-md px-2.5 py-2">{children}</div>
    </div>
  );
}
